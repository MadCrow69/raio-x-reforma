import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento, Parte } from '../leitura/tipos';
import { detectarEmpresa, participacaoPJ, separar } from './separar';

const A = '12.ABC.345/01DE-35';
const B = '22222222000122';

function doc(
  n: string,
  emit: string,
  dest?: Parte,
  base: string[] = ['100'],
): Documento {
  return {
    chave: `chave${n}`,
    numero: n,
    tipo: 'NFE',
    tpDoc: 55,
    emissao: '2026-01-10T10:00:00-03:00',
    emitente: { documento: emit, tipo: 'PJ' },
    destinatario: dest,
    itens: base.map((b, i) => ({
      numero: i + 1,
      descricao: 'x',
      baseCalculo: new Big(b),
      valorIS: new Big(0),
    })),
    arquivo: `${n}.xml`,
  };
}
const pj = (d: string): Parte => ({ documento: d, tipo: 'PJ' });
const pf: Parte = { documento: '12345678909', tipo: 'PF' };

describe('detectarEmpresa', () => {
  it('retorna o emitente mais frequente (normalizado)', () => {
    const docs = [doc('1', A), doc('2', '12abc34501de35'), doc('3', A), doc('4', B)];
    expect(detectarEmpresa(docs)).toBe('12ABC34501DE35');
  });
  it('empate → primeiro visto; vazio → null', () => {
    expect(detectarEmpresa([doc('1', B), doc('2', A)])).toBe(B);
    expect(detectarEmpresa([])).toBeNull();
  });
});

describe('separar', () => {
  it('classifica venda, compra e outra empresa sem perder nenhum documento', () => {
    const venda = doc('1', A, pf);
    const compra = doc('2', B, pj('12.ABC.345/01DE-35'));
    const terceiro = doc('3', B, pj('33333333000133'));
    const ambos = doc('4', A, pj(A));
    const r = separar([venda, compra, terceiro, ambos], '12ABC34501DE35');
    expect(r.vendas).toEqual([venda, ambos]);
    expect(r.compras).toEqual([compra]);
    expect(r.ignorados).toHaveLength(1);
    expect(r.ignorados[0]).toMatchObject({ arquivo: '3.xml', motivo: 'OUTRA_EMPRESA' });
    expect(r.ignorados[0].detalhe).toMatch(/empresa/i);
    expect(r.vendas.length + r.compras.length + r.ignorados.length).toBe(4);
  });
  it('nota de entrada (tpNF=0) emitida pela empresa não é venda: ENTRADA_PROPRIA', () => {
    const entrada = { ...doc('6', A, pj(B)), tpNF: '0' };
    const saida = { ...doc('7', A, pj(B)), tpNF: '1' };
    const r = separar([entrada, saida], A);
    expect(r.vendas).toEqual([saida]);
    expect(r.compras).toEqual([]);
    expect(r.ignorados).toEqual([expect.objectContaining({ arquivo: '6.xml', motivo: 'ENTRADA_PROPRIA' })]);
  });
  it('NFC-e sem destinatário emitida pela empresa é venda', () => {
    const d = doc('5', A);
    expect(separar([d], A).vendas).toEqual([d]);
  });
});

describe('participacaoPJ', () => {
  it('600 PJ + 400 PF → 60%', () => {
    const r = participacaoPJ([
      doc('1', A, pj(B), ['400', '200']),
      doc('2', A, pf, ['300']),
      doc('3', A, undefined, ['100']),
      doc('4', A, { documento: 'X', tipo: 'ESTRANGEIRO' }, []),
    ]);
    expect(r.pj.toString()).toBe('600');
    expect(r.pf.toString()).toBe('400');
    expect(r.percentualPJ.toString()).toBe('60');
  });
  it('total zero → 0', () => {
    expect(participacaoPJ([]).percentualPJ.toString()).toBe('0');
  });
});
