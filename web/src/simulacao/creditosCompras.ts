import Big from 'big.js';
import type { Documento } from '../leitura/tipos';
import { chaveItem, type ItemCalculado } from '../motor/tipos';

/**
 * Crédito de IBS/CBS das compras (R$) que alimenta `OrigemCompras` do tipo REAL. Por item: o grupo
 * IBSCBS da própria nota (vCBS + vIBSUF + vIBSMun) quando existe; senão o que o motor calculou no
 * cenário REGULAR_AUDITORIA, se o item ficou CALCULO_SIMULADO; senão 0 (sem valor confiável, não
 * se credita). Valores somados em Big, sem arredondar.
 */
export function somarCreditosCompras(compras: Documento[], calculadas: ItemCalculado[]): Big {
  const porItem = new Map(calculadas.map((c) => [chaveItem(c.chave, c.numero), c]));
  let total = Big(0);
  for (const d of compras) {
    for (const it of d.itens) {
      const g = it.ibscbsNota;
      if (g) {
        total = total.plus(g.vCBS).plus(g.vIBSUF).plus(g.vIBSMun);
        continue;
      }
      const c = porItem.get(chaveItem(d.chave, it.numero));
      if (c?.estado === 'CALCULO_SIMULADO') total = total.plus(c.vCBS).plus(c.vIBSUF).plus(c.vIBSMun);
    }
  }
  return total;
}
