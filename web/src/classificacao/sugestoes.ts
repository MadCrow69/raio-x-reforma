import Big from 'big.js';
import type { ItemDocumento } from '../leitura/tipos';

export interface OpcaoClassificacao {
  cst: string;
  cClassTrib: string;
  descricao: string;
  reducaoCbs: Big;
  reducaoIbs: Big;
}

export interface TabelaSugestoes {
  ncm: Record<string, OpcaoClassificacao[]>;
  nbs: Record<string, OpcaoClassificacao[]>;
  /** código (ou prefixo) excetuado → cClassTrib da linha aplicável que NÃO vale para ele */
  excecoes: { ncm: Record<string, string[]>; nbs: Record<string, string[]> };
  padrao: OpcaoClassificacao;
}

export interface GrupoClassificacao {
  chave: string;
  /** SEM_CODIGO: itens sem NCM e sem NBS (um grupo só, para também receberem cClassTrib confirmado) */
  tipo: 'NCM' | 'NBS' | 'SEM_CODIGO';
  codigo: string;
  itens: number;
  valor: Big;
  opcoes: OpcaoClassificacao[];
  sugerida: OpcaoClassificacao;
  origem: 'NOTA' | 'TABELA' | 'PADRAO';
}

/** chave do grupo → escolha confirmada */
export type Classificacoes = Record<string, OpcaoClassificacao>;

/** Local do JSON gerado no build da imagem (motores/exportar-sugestoes.sql). */
export const URL_SUGESTOES = '/dados/sugestoes-classificacao.json';

interface OpcaoJson {
  cst: string;
  cClassTrib: string;
  descricao: string;
  reducaoCbs: string;
  reducaoIbs: string;
}
interface TabelaJson {
  ncm: Record<string, OpcaoJson[]>;
  nbs: Record<string, OpcaoJson[]>;
  excecoes: { ncm: Record<string, string[]>; nbs: Record<string, string[]> };
  padrao: OpcaoJson;
}

const paraOpcao = (o: OpcaoJson): OpcaoClassificacao => ({
  cst: o.cst,
  cClassTrib: o.cClassTrib,
  descricao: o.descricao,
  reducaoCbs: new Big(o.reducaoCbs),
  reducaoIbs: new Big(o.reducaoIbs),
});

const converterMapa = (m: Record<string, OpcaoJson[]>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map(paraOpcao)]));

export async function carregarSugestoes(): Promise<TabelaSugestoes> {
  const resp = await fetch(URL_SUGESTOES);
  if (!resp.ok) throw new Error(`Falha ao carregar sugestões de classificação (HTTP ${resp.status})`);
  const json = (await resp.json()) as TabelaJson;
  return { ncm: converterMapa(json.ncm), nbs: converterMapa(json.nbs), excecoes: json.excecoes, padrao: paraOpcao(json.padrao) };
}

/** Opções cujo código na tabela é igual ou prefixo de `codigo`; a de prefixo mais longo vem primeiro. */
function opcoesPorPrefixo(
  mapa: Record<string, OpcaoClassificacao[]>,
  excecoes: Record<string, string[]>,
  codigo: string,
): OpcaoClassificacao[] {
  const excecoesDoCodigo = Object.entries(excecoes).filter(([e]) => codigo.startsWith(e));
  // exceção só retira opções vindas de uma linha aplicável mais genérica (prefixo menor) que a exceção
  const excetuada = (prefixo: string, cClassTrib: string) =>
    excecoesDoCodigo.some(([e, lista]) => e.length > prefixo.length && lista.includes(cClassTrib));
  const vistas = new Set<string>();
  const resultado: OpcaoClassificacao[] = [];
  const prefixos = Object.keys(mapa)
    .filter((p) => codigo.startsWith(p))
    .sort((a, b) => b.length - a.length);
  for (const p of prefixos) {
    for (const o of mapa[p]) {
      if (vistas.has(o.cClassTrib) || excetuada(p, o.cClassTrib)) continue;
      vistas.add(o.cClassTrib);
      resultado.push(o);
    }
  }
  return resultado;
}

function localizarNaTabela(tabela: TabelaSugestoes, cClassTrib: string): OpcaoClassificacao | undefined {
  for (const mapa of [tabela.ncm, tabela.nbs]) {
    for (const opcoes of Object.values(mapa)) {
      const achada = opcoes.find((o) => o.cClassTrib === cClassTrib);
      if (achada) return achada;
    }
  }
  return undefined;
}

/** Identificação do grupo de classificação de um item (fonte única da chave: usada também pelo cliente dos motores). */
export function identificarGrupo(item: ItemDocumento): { chave: string; tipo: GrupoClassificacao['tipo']; codigo: string } {
  const ncm = item.ncm?.replace(/\D/g, '');
  const nbs = item.nbs?.replace(/\D/g, '');
  const tipo: GrupoClassificacao['tipo'] = ncm ? 'NCM' : nbs ? 'NBS' : 'SEM_CODIGO';
  const codigo = (tipo === 'NCM' ? ncm : tipo === 'NBS' ? nbs : '') as string;
  const nota = item.ibscbsNota;
  const base = tipo === 'SEM_CODIGO' ? tipo : `${tipo}:${codigo}`;
  return { chave: nota ? `${base}:${nota.cClassTrib}` : base, tipo, codigo };
}

export function agruparParaConfirmacao(itens: ItemDocumento[], tabela: TabelaSugestoes): GrupoClassificacao[] {
  const grupos = new Map<string, GrupoClassificacao>();

  for (const item of itens) {
    const { chave, tipo, codigo } = identificarGrupo(item);
    const nota = item.ibscbsNota;

    let grupo = grupos.get(chave);
    if (!grupo) {
      const doTipo =
        tipo === 'NCM' ? opcoesPorPrefixo(tabela.ncm, tabela.excecoes.ncm, codigo)
        : tipo === 'NBS' ? opcoesPorPrefixo(tabela.nbs, tabela.excecoes.nbs, codigo)
        : [];
      if (nota) {
        const conhecida = localizarNaTabela(tabela, nota.cClassTrib);
        const sugerida: OpcaoClassificacao = conhecida
          ? { ...conhecida, cst: nota.cst }
          : {
              cst: nota.cst,
              cClassTrib: nota.cClassTrib,
              descricao: `cClassTrib ${nota.cClassTrib}`,
              reducaoCbs: new Big(0),
              reducaoIbs: new Big(0),
            };
        const opcoes = [sugerida, ...doTipo.filter((o) => o.cClassTrib !== nota.cClassTrib)];
        grupo = { chave, tipo, codigo, itens: 0, valor: new Big(0), opcoes, sugerida, origem: 'NOTA' };
      } else if (doTipo.length > 0) {
        grupo = { chave, tipo, codigo, itens: 0, valor: new Big(0), opcoes: doTipo, sugerida: doTipo[0], origem: 'TABELA' };
      } else {
        grupo = {
          chave, tipo, codigo, itens: 0, valor: new Big(0),
          opcoes: [tabela.padrao], sugerida: tabela.padrao, origem: 'PADRAO',
        };
      }
      grupos.set(chave, grupo);
    }
    grupo.itens += 1;
    grupo.valor = grupo.valor.plus(item.baseCalculo);
  }

  return [...grupos.values()].sort((a, b) => b.valor.cmp(a.valor));
}
