import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento, GrupoIbsCbsNota, ItemDocumento } from '../leitura/tipos';
import type { EstadoItem, ItemCalculado } from '../motor/tipos';
import { somarCreditosCompras } from './creditosCompras';

const grupo = (cbs: string, uf: string, mun: string): GrupoIbsCbsNota => ({
  cst: '000',
  cClassTrib: '000001',
  vBC: Big(1000),
  vCBS: Big(cbs),
  vIBSUF: Big(uf),
  vIBSMun: Big(mun),
});

const item = (numero: number, ibscbsNota?: GrupoIbsCbsNota): ItemDocumento => ({
  numero,
  descricao: `Item ${numero}`,
  baseCalculo: Big(1000),
  valorIS: Big(0),
  ibscbsNota,
});

const compra = (chave: string, itens: ItemDocumento[]): Documento => ({
  chave,
  numero: chave,
  tipo: 'NFE',
  tpDoc: 55,
  emissao: '2027-01-10T10:00:00-03:00',
  emitente: { documento: '11444777000161', tipo: 'PJ' },
  destinatario: { documento: '11222333000181', tipo: 'PJ' },
  itens,
  arquivo: `${chave}.xml`,
});

const calculado = (chave: string, numero: number, v: [string, string, string], estado: EstadoItem = 'CALCULO_SIMULADO'): ItemCalculado => ({
  chave,
  numero,
  estado,
  vCBS: Big(v[0]),
  vIBSUF: Big(v[1]),
  vIBSMun: Big(v[2]),
  erros: [],
  memoria: '',
});

describe('somarCreditosCompras', () => {
  it('usa o grupo IBS/CBS da nota quando existe, mesmo que o motor tenha outro valor', () => {
    const c = [compra('c1', [item(1, grupo('9', '0.5', '0.5'))])];
    expect(somarCreditosCompras(c, [calculado('c1', 1, ['80', '1', '1'])]).toString()).toBe('10');
  });

  it('sem grupo na nota usa o valor do motor (CALCULO_SIMULADO)', () => {
    const c = [compra('c1', [item(1)])];
    expect(somarCreditosCompras(c, [calculado('c1', 1, ['8.8', '0.05', '0.05'])]).toString()).toBe('8.9');
  });

  it('sem grupo e sem cálculo válido vale zero (item não calculado ou ausente)', () => {
    const c = [compra('c1', [item(1), item(2), item(3)])];
    const calc = [calculado('c1', 1, ['5', '5', '5'], 'FALHA_TECNICA'), calculado('c1', 2, ['5', '5', '5'], 'INCONSISTENCIA_ENTRADA')];
    expect(somarCreditosCompras(c, calc).toString()).toBe('0');
  });

  it('soma itens e notas, sem erro de ponto flutuante', () => {
    const c = [compra('c1', [item(1, grupo('0.1', '0', '0')), item(2)]), compra('c2', [item(1, grupo('0.2', '0', '0'))])];
    expect(somarCreditosCompras(c, [calculado('c1', 2, ['1', '1', '1'])]).toString()).toBe('3.3');
  });

  it('sem compras não há crédito', () => {
    expect(somarCreditosCompras([], []).toString()).toBe('0');
  });
});
