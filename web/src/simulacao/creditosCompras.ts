import Big from 'big.js';
import type { Documento } from '../leitura/tipos';
import { emitidoAntesDoAnoSimulado } from '../motor/montarRequisicoes';
import { chaveItem, type ItemCalculado } from '../motor/tipos';

export interface CreditosCompras {
  creditos: Big;
  /** Itens de compra sem valor confiável: sem grupo na nota e não CALCULO_SIMULADO no motor (valem 0, o crédito pode estar subestimado). */
  itensSemCredito: number;
}

/**
 * Crédito de IBS/CBS das compras (R$) que alimenta `OrigemCompras` do tipo REAL. Por item: o grupo
 * IBSCBS da própria nota (vCBS + vIBSUF + vIBSMun) quando existe; senão o que o motor calculou no
 * cenário REGULAR_AUDITORIA, se o item ficou CALCULO_SIMULADO; senão 0 (sem valor confiável, não
 * se credita; o item é contado em `itensSemCredito`). Valores somados em Big, sem arredondar.
 * Nota emitida antes do ano simulado (2026): o grupo traz as alíquotas de teste, não as de 2027; vale só
 * o valor do motor (FORMULAS.md, item 5).
 */
export function somarCreditosCompras(compras: Documento[], calculadas: ItemCalculado[]): CreditosCompras {
  const porItem = new Map(calculadas.map((c) => [chaveItem(c.chave, c.numero), c]));
  let total = Big(0);
  let itensSemCredito = 0;
  for (const d of compras) {
    const grupoValido = !emitidoAntesDoAnoSimulado(d.emissao);
    for (const it of d.itens) {
      const g = grupoValido ? it.ibscbsNota : undefined;
      if (g) {
        total = total.plus(g.vCBS).plus(g.vIBSUF).plus(g.vIBSMun);
        continue;
      }
      const c = porItem.get(chaveItem(d.chave, it.numero));
      if (c?.estado === 'CALCULO_SIMULADO') total = total.plus(c.vCBS).plus(c.vIBSUF).plus(c.vIBSMun);
      else itensSemCredito++;
    }
  }
  return { creditos: total, itensSemCredito };
}
