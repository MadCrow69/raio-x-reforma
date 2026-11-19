import Big from 'big.js';
import { emitenteDoSimples } from '../dominio/simplesNacional';
import type { Documento } from '../leitura/tipos';
import { emitidoAntesDoAnoSimulado } from '../motor/montarRequisicoes';
import { chaveItem, type ItemCalculado } from '../motor/tipos';

export interface CreditosCompras {
  creditos: Big;
  /** Itens de compra sem valor confiável (valem 0, o crédito pode estar subestimado): ver `somarCreditosCompras`. */
  itensSemCredito: number;
  /** 'AAAA-MM' distintos da emissão original das compras, em ordem: divisor da média mensal dos créditos (FORMULAS.md, item 5). */
  meses: string[];
}

/**
 * Crédito de IBS/CBS das compras (R$) que alimenta `OrigemCompras` do tipo REAL. Por item:
 *  1. o grupo IBSCBS da própria nota (vCBS + vIBSUF + vIBSMun), se existe e a nota é do ano simulado em diante
 *     (nota de 2026 traz as alíquotas de teste, não as de 2027);
 *  2. senão, fornecedor optante pelo Simples: 0, e o item conta em `itensSemCredito` — o crédito fica limitado ao que
 *     o fornecedor recolheu no Simples (LC 214, art. 47, § 9º, II), valor que a nota não informa;
 *  3. senão, o que o motor calculou no cenário REGULAR_AUDITORIA, se o item ficou CALCULO_SIMULADO;
 *  4. senão 0 (sem valor confiável, não se credita), e o item conta em `itensSemCredito`.
 * Valores somados em Big, sem arredondar.
 */
export function somarCreditosCompras(compras: Documento[], calculadas: ItemCalculado[]): CreditosCompras {
  const porItem = new Map(calculadas.map((c) => [chaveItem(c.chave, c.numero), c]));
  let total = Big(0);
  let itensSemCredito = 0;
  const meses = new Set<string>();
  for (const d of compras) {
    meses.add(d.emissao.slice(0, 7));
    const grupoValido = !emitidoAntesDoAnoSimulado(d.emissao);
    const doSimples = emitenteDoSimples(d);
    for (const it of d.itens) {
      const g = grupoValido ? it.ibscbsNota : undefined;
      if (g) {
        total = total.plus(g.vCBS).plus(g.vIBSUF).plus(g.vIBSMun);
        continue;
      }
      if (doSimples) {
        itensSemCredito++;
        continue;
      }
      const c = porItem.get(chaveItem(d.chave, it.numero));
      if (c?.estado === 'CALCULO_SIMULADO') total = total.plus(c.vCBS).plus(c.vIBSUF).plus(c.vIBSMun);
      else itensSemCredito++;
    }
  }
  return { creditos: total, itensSemCredito, meses: [...meses].sort() };
}
