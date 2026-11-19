import Big from 'big.js';
import type { Documento, DocumentoIgnorado } from '../leitura/tipos';
import { normalizarCnpj } from './cnpj';
import { calc } from './decimal';

export interface Separacao {
  vendas: Documento[];
  compras: Documento[];
  ignorados: DocumentoIgnorado[];
}

/** CNPJ emitente mais frequente (normalizado); empate → o primeiro visto. */
export function detectarEmpresa(docs: Documento[]): string | null {
  const contagem = new Map<string, number>();
  for (const d of docs) {
    const c = normalizarCnpj(d.emitente.documento);
    contagem.set(c, (contagem.get(c) ?? 0) + 1);
  }
  let melhor: string | null = null;
  let max = 0;
  for (const [c, n] of contagem) {
    if (n > max) {
      melhor = c;
      max = n;
    }
  }
  return melhor;
}

/** tpNF da nota de entrada: emitida pela própria empresa, não é venda (ex.: entrada de importação, compra de PF). */
const TPNF_ENTRADA = '0';

/** Cada documento termina em vendas, compras ou ignorados (nenhum some). */
export function separar(docs: Documento[], cnpjEmpresa: string): Separacao {
  const empresa = normalizarCnpj(cnpjEmpresa);
  const r: Separacao = { vendas: [], compras: [], ignorados: [] };
  for (const d of docs) {
    if (normalizarCnpj(d.emitente.documento) === empresa) {
      if (d.tpNF === TPNF_ENTRADA) {
        r.ignorados.push({
          arquivo: d.arquivo,
          motivo: 'ENTRADA_PROPRIA',
          detalhe: 'Nota de entrada (tpNF=0) emitida pela própria empresa: não é venda.',
        });
      } else r.vendas.push(d);
    } else if (d.destinatario && normalizarCnpj(d.destinatario.documento) === empresa) {
      r.compras.push(d);
    } else {
      r.ignorados.push({
        arquivo: d.arquivo,
        motivo: 'OUTRA_EMPRESA',
        detalhe: 'Documento não emitido nem recebido pela empresa analisada.',
      });
    }
  }
  return r;
}

/** Soma da baseCalculo por tipo de destinatário; percentualPJ em pontos (60 = 60%). */
export function participacaoPJ(vendas: Documento[]): { pj: Big; pf: Big; percentualPJ: Big } {
  let pj = new Big(0);
  let pf = new Big(0);
  for (const v of vendas) {
    const total = v.itens.reduce((s, i) => s.plus(i.baseCalculo), new Big(0));
    if (v.destinatario?.tipo === 'PJ') pj = pj.plus(total);
    else pf = pf.plus(total);
  }
  const todo = pj.plus(pf);
  const percentualPJ = todo.eq(0) ? new Big(0) : Big(calc(pj).div(todo).times(100));
  return { pj, pf, percentualPJ };
}
