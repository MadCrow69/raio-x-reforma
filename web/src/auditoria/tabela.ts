import type Big from 'big.js';
import type { LinhaAuditoria } from './auditar';
import type { OrdemTabela } from '../ui/componentes/ordem';
import { ROTULO_ACHADO, ROTULO_PAPEL, ROTULO_TIPO } from './rotulos';

/** Dimensões de filtro da Auditoria (padrão de interface §8: uma lista por dimensão). */
export type Dimensao = 'achado' | 'erro' | 'papel' | 'tipo';
export const DIMENSOES: Dimensao[] = ['achado', 'erro', 'papel', 'tipo'];

export type Filtros = Record<Dimensao, string[]>;
export const SEM_FILTROS: Filtros = { achado: [], erro: [], papel: [], tipo: [] };

export type ColunaId =
  | 'nota' | 'papelTipo' | 'item' | 'descricao' | 'ncmOuNbs' | 'cst' | 'cClassTrib'
  | 'achado' | 'erro' | 'vNota' | 'vMotor' | 'diferenca';

export type Ordem = OrdemTabela<ColunaId>;

export const TAMANHOS_PAGINA = [20, 50, 100] as const;
export const TAMANHO_PADRAO = 20;

/** Tudo o que a tela da Auditoria lembra ao trocar de aba (filtros persistem ao voltar). */
export interface EstadoAuditoria {
  busca: string;
  filtros: Filtros;
  ordem: Ordem | null;
  tamanho: number;
  pagina: number;
}

export const ESTADO_AUDITORIA_INICIAL: EstadoAuditoria = {
  busca: '',
  filtros: SEM_FILTROS,
  ordem: null,
  tamanho: TAMANHO_PADRAO,
  pagina: 1,
};

/** Achados de itens que o motor não calculou (valor do motor não é um valor calculado). */
export const ACHADOS_SEM_CALCULO: LinhaAuditoria['achado'][] = ['NAO_CALCULADO', 'ERRO_MOTOR'];

export const semCalculo = (l: LinhaAuditoria) => ACHADOS_SEM_CALCULO.includes(l.achado);

/** Minúsculas e sem acento, para busca tolerante. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Valores que a linha assume numa dimensão (o erro pode ser mais de um). */
export function valoresDe(l: LinhaAuditoria, d: Dimensao): string[] {
  switch (d) {
    case 'achado': return [l.achado];
    case 'erro': return l.erros.map((e) => e.code);
    case 'papel': return [l.papel];
    case 'tipo': return [l.tipo];
  }
}

export function corresponde(l: LinhaAuditoria, busca: string): boolean {
  const q = normalizar(busca.trim());
  if (!q) return true;
  return [l.numeroNota, l.descricao, l.ncmOuNbs, l.cClassTrib].some((t) => normalizar(t).includes(q));
}

/** Aplica busca e filtros (OU dentro da dimensão, E entre dimensões). `ignorar` serve à contagem por opção. */
export function filtrar(linhas: LinhaAuditoria[], busca: string, filtros: Filtros, ignorar?: Dimensao): LinhaAuditoria[] {
  return linhas.filter(
    (l) =>
      corresponde(l, busca) &&
      DIMENSOES.every((d) => d === ignorar || filtros[d].length === 0 || valoresDe(l, d).some((v) => filtros[d].includes(v))),
  );
}

export interface Opcao {
  valor: string;
  rotulo: string;
  contagem: number;
}

/** Opções de uma dimensão, com a contagem sobre as linhas que passam pelos DEMAIS filtros. */
export function opcoesDe(linhas: LinhaAuditoria[], busca: string, filtros: Filtros, d: Dimensao): Opcao[] {
  const base = filtrar(linhas, busca, filtros, d);
  const contagens = new Map<string, number>();
  for (const l of base) for (const v of new Set(valoresDe(l, d))) contagens.set(v, (contagens.get(v) ?? 0) + 1);

  let todas: { valor: string; rotulo: string }[];
  if (d === 'achado') todas = Object.entries(ROTULO_ACHADO).map(([valor, rotulo]) => ({ valor, rotulo }));
  else if (d === 'papel') todas = Object.entries(ROTULO_PAPEL).map(([valor, rotulo]) => ({ valor, rotulo }));
  else if (d === 'tipo') todas = Object.entries(ROTULO_TIPO).map(([valor, rotulo]) => ({ valor, rotulo }));
  else {
    const titulos = new Map<string, string>();
    for (const l of linhas) for (const e of l.erros) if (!titulos.has(e.code)) titulos.set(e.code, e.title);
    todas = [...titulos].sort(([a], [b]) => COLETOR.compare(a, b)).map(([valor, t]) => ({ valor, rotulo: t ? `${valor} · ${t}` : valor }));
  }
  const presentes = new Set(linhas.flatMap((l) => valoresDe(l, d)));
  const selecionados = new Set(filtros[d]);
  return todas
    .filter((o) => presentes.has(o.valor) || selecionados.has(o.valor))
    .map((o) => ({ ...o, contagem: contagens.get(o.valor) ?? 0 }));
}

// ---- Ordenação ----

/** pt-BR, tolerante a acento e a caixa; "10" depois de "9" (numeric) para notas e códigos. */
export const COLETOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

type Chave = string | number | Big | undefined;

const CHAVES: Record<ColunaId, (l: LinhaAuditoria) => Chave> = {
  nota: (l) => l.numeroNota,
  papelTipo: (l) => papelTipo(l),
  item: (l) => l.item,
  descricao: (l) => l.descricao,
  ncmOuNbs: (l) => l.ncmOuNbs,
  cst: (l) => l.cst,
  cClassTrib: (l) => l.cClassTrib,
  achado: (l) => ROTULO_ACHADO[l.achado],
  erro: (l) => l.erros.map((e) => e.code).join(' '),
  vNota: (l) => l.vNota,
  // Item não calculado não tem valor do motor: fica sempre por último, como "sem valor".
  vMotor: (l) => (semCalculo(l) ? undefined : l.vMotor),
  diferenca: (l) => l.diferenca,
};

function comparar(a: Chave, b: Chave): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return COLETOR.compare(a, b);
  return (a as Big).cmp(b as Big);
}

/** Ordenação estável; colunas numéricas e de dinheiro comparam como número (Big); vazios ficam sempre por último. */
export function ordenar(linhas: LinhaAuditoria[], ordem: Ordem | null): LinhaAuditoria[] {
  if (!ordem) return linhas;
  const chave = CHAVES[ordem.coluna];
  const sinal = ordem.direcao === 'asc' ? 1 : -1;
  return linhas
    .map((l, i) => ({ l, i, k: chave(l) }))
    .sort((x, y) => {
      if (x.k === undefined || y.k === undefined) return x.k === y.k ? x.i - y.i : x.k === undefined ? 1 : -1;
      return sinal * comparar(x.k, y.k) || x.i - y.i;
    })
    .map((x) => x.l);
}

/** Linha identificada para abrir a Memória de cálculo (nota + item; a chave da nota sozinha repete por item). */
export interface FocoMemoria {
  chave: string;
  item: number;
}
export const mesmoFoco = (l: LinhaAuditoria, f: FocoMemoria | null) => !!f && l.chave === f.chave && l.item === f.item;
/** "Venda · NF-e": papel e tipo numa coluna só (os filtros continuam separados). */
export const papelTipo = (l: LinhaAuditoria) => `${ROTULO_PAPEL[l.papel]} · ${ROTULO_TIPO[l.tipo]}`;
export const idLinha = (l: LinhaAuditoria) => `${l.papel}:${l.chave}:${l.item}`;
