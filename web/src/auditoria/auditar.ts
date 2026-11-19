import Big from 'big.js';
import { identificarGrupo, type Classificacoes } from '../classificacao/sugestoes';
import type { Documento, TipoDocumento } from '../leitura/tipos';
import type { EstadoItem, ErroMotor, ItemCalculado } from '../motor/tipos';
import type { Achado } from './rotulos';

export type { Achado } from './rotulos';

export interface LinhaAuditoria {
  chave: string;
  numeroNota: string;
  papel: 'VENDA' | 'COMPRA';
  tipo: TipoDocumento;
  item: number;
  descricao: string;
  ncmOuNbs: string;
  cst: string;
  cClassTrib: string;
  estado: EstadoItem;
  achado: Achado;
  erros: ErroMotor[];
  vNota?: Big;
  vMotor: Big;
  diferenca?: Big;
  memoria: string;
}

export const TOLERANCIA = Big('0.01'); // por tributo, em R$

const chaveItem = (chave: string, numero: number) => `${chave}\u0000${numero}`;

function linhasDe(docs: Documento[], papel: 'VENDA' | 'COMPRA', porItem: Map<string, ItemCalculado>, classificacoes: Classificacoes): LinhaAuditoria[] {
  const linhas: LinhaAuditoria[] = [];
  for (const d of docs) {
    for (const it of d.itens) {
      const c = porItem.get(chaveItem(d.chave, it.numero));
      const g = it.ibscbsNota;
      const confirmada = classificacoes[identificarGrupo(it).chave];
      const vMotor = c ? c.vCBS.plus(c.vIBSUF).plus(c.vIBSMun) : Big(0);
      const vNota = g ? g.vCBS.plus(g.vIBSUF).plus(g.vIBSMun) : undefined;
      let achado: Achado;
      let diferenca: Big | undefined;
      if (!c) achado = 'NAO_CALCULADO';
      else if (c.estado !== 'CALCULO_SIMULADO') achado = c.erros.length > 0 ? 'ERRO_MOTOR' : 'NAO_CALCULADO';
      else if (!g) achado = 'SEM_GRUPO_NA_NOTA';
      else {
        const difs = [g.vCBS.minus(c.vCBS), g.vIBSUF.minus(c.vIBSUF), g.vIBSMun.minus(c.vIBSMun)];
        const maior = difs.reduce((a, b) => (b.abs().gt(a.abs()) ? b : a));
        if (maior.abs().gt(TOLERANCIA)) {
          achado = 'VALOR_DIVERGENTE';
          diferenca = maior;
        } else achado = 'OK';
      }
      linhas.push({
        chave: d.chave,
        numeroNota: d.numero,
        papel,
        tipo: d.tipo,
        item: it.numero,
        descricao: it.descricao,
        ncmOuNbs: it.ncm ?? it.nbs ?? '',
        cst: confirmada?.cst ?? g?.cst ?? '',
        cClassTrib: confirmada?.cClassTrib ?? g?.cClassTrib ?? '',
        estado: c?.estado ?? 'NAO_CALCULADO',
        achado,
        erros: c?.erros ?? [],
        vNota,
        vMotor,
        diferenca,
        memoria: c?.memoria ?? '',
      });
    }
  }
  return linhas;
}

export function auditar(
  vendas: Documento[],
  compras: Documento[],
  calculados: ItemCalculado[],
  classificacoes: Classificacoes = {},
): LinhaAuditoria[] {
  const porItem = new Map(calculados.map((c) => [chaveItem(c.chave, c.numero), c]));
  return [...linhasDe(vendas, 'VENDA', porItem, classificacoes), ...linhasDe(compras, 'COMPRA', porItem, classificacoes)];
}
