import Big from 'big.js';
import { identificarGrupo, type Classificacoes } from '../classificacao/sugestoes';
import type { Documento, TipoDocumento } from '../leitura/tipos';
import { chaveItem, type EstadoItem, type ErroMotor, type ItemCalculado, type OrigemMemoria } from '../motor/tipos';
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
  /** Quem escreveu a memória; ausente = sem origem declarada (a tela não rotula). */
  origemMemoria?: OrigemMemoria;
}

export const TOLERANCIA = Big('0.01'); // por tributo, em R$

/**
 * `validacao` (só nas vendas): o resultado do regime regular para o mesmo item. Os valores da linha seguem vindo de
 * `porItem` (Simples), mas o motor regular é quem valida CST × cClassTrib × NCM/NBS: se ele recusou o item, o erro entra
 * na linha e o achado vira ERRO_MOTOR; se não o calculou e sem erro, o achado vira NAO_CALCULADO.
 */
function linhasDe(
  docs: Documento[],
  papel: 'VENDA' | 'COMPRA',
  porItem: Map<string, ItemCalculado>,
  classificacoes: Classificacoes,
  validacao?: Map<string, ItemCalculado>,
): LinhaAuditoria[] {
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
      const v = validacao?.get(chaveItem(d.chave, it.numero));
      const errosValidacao = validacao && c?.estado === 'CALCULO_SIMULADO' ? (v?.erros ?? []) : [];
      const validacaoSemCalculo = validacao !== undefined && c?.estado === 'CALCULO_SIMULADO' && v?.estado !== 'CALCULO_SIMULADO';
      if (errosValidacao.length > 0) achado = 'ERRO_MOTOR';
      else if (validacaoSemCalculo) achado = 'NAO_CALCULADO';
      else if (!c) achado = 'NAO_CALCULADO';
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
        erros: [...(c?.erros ?? []), ...errosValidacao],
        vNota,
        vMotor,
        diferenca,
        memoria: c?.memoria ?? '',
        origemMemoria: c?.origemMemoria,
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
  /** Resultado do regime regular para as vendas (porFora): valida NCM × cClassTrib, que o motor do Simples não valida. */
  validacaoVendas?: ItemCalculado[],
): LinhaAuditoria[] {
  const porItem = new Map(calculados.map((c) => [chaveItem(c.chave, c.numero), c]));
  const validacao = validacaoVendas && new Map(validacaoVendas.map((c) => [chaveItem(c.chave, c.numero), c]));
  return [...linhasDe(vendas, 'VENDA', porItem, classificacoes, validacao), ...linhasDe(compras, 'COMPRA', porItem, classificacoes)];
}
