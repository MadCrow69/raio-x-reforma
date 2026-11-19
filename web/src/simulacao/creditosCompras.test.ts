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

const compra = (chave: string, itens: ItemDocumento[], emissao = '2027-01-10T10:00:00-03:00', crt = '3'): Documento => ({
  chave,
  numero: chave,
  tipo: 'NFE',
  tpDoc: 55,
  emissao,
  emitente: { documento: '11444777000161', tipo: 'PJ', crt },
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
    expect(somarCreditosCompras(c, [calculado('c1', 1, ['80', '1', '1'])]).creditos.toString()).toBe('10');
  });

  it('sem grupo na nota usa o valor do motor (CALCULO_SIMULADO)', () => {
    const c = [compra('c1', [item(1)])];
    expect(somarCreditosCompras(c, [calculado('c1', 1, ['8.8', '0.05', '0.05'])]).creditos.toString()).toBe('8.9');
  });

  it('sem grupo e sem cálculo válido vale zero (item não calculado ou ausente)', () => {
    const c = [compra('c1', [item(1), item(2), item(3)])];
    const calc = [calculado('c1', 1, ['5', '5', '5'], 'FALHA_TECNICA'), calculado('c1', 2, ['5', '5', '5'], 'INCONSISTENCIA_ENTRADA')];
    expect(somarCreditosCompras(c, calc).creditos.toString()).toBe('0');
  });

  it('soma itens e notas, sem erro de ponto flutuante', () => {
    const c = [compra('c1', [item(1, grupo('0.1', '0', '0')), item(2)]), compra('c2', [item(1, grupo('0.2', '0', '0'))])];
    expect(somarCreditosCompras(c, [calculado('c1', 2, ['1', '1', '1'])]).creditos.toString()).toBe('3.3');
  });

  it('sem compras não há crédito', () => {
    expect(somarCreditosCompras([], []).creditos.toString()).toBe('0');
  });

  it('conta itens sem crédito confiável: sem grupo e sem CALCULO_SIMULADO (ausente, falha técnica, inconsistência)', () => {
    const c = [compra('c1', [item(1), item(2), item(3), item(4, grupo('1', '0', '0')), item(5)])];
    const calc = [
      calculado('c1', 1, ['5', '5', '5'], 'FALHA_TECNICA'),
      calculado('c1', 2, ['5', '5', '5'], 'INCONSISTENCIA_ENTRADA'),
      calculado('c1', 5, ['1', '0', '0']),
    ];
    const r = somarCreditosCompras(c, calc);
    expect(r.itensSemCredito).toBe(3); // 1 (falha), 2 (inconsistência), 3 (sem cálculo); 4 tem grupo, 5 foi calculado
    expect(r.creditos.toString()).toBe('2');
  });

  it('item com grupo na nota nunca conta como sem crédito, mesmo com o motor falhando', () => {
    const c = [compra('c1', [item(1, grupo('1', '0', '0'))])];
    expect(somarCreditosCompras(c, [calculado('c1', 1, ['0', '0', '0'], 'FALHA_TECNICA')]).itensSemCredito).toBe(0);
  });

  describe('notas anteriores a 2027 (grupo com alíquotas de teste de 2026)', () => {
    const em2026 = '2026-05-10T10:00:00-03:00';

    it('ignora o grupo da nota e usa o valor do motor (alíquotas de 2027)', () => {
      const c = [compra('c1', [item(1, grupo('0.9', '0.1', '0'))], em2026)];
      const r = somarCreditosCompras(c, [calculado('c1', 1, ['88', '0.5', '0.5'])]);
      expect(r.creditos.toString()).toBe('89');
      expect(r.itensSemCredito).toBe(0);
    });

    it('sem cálculo do motor o item conta como sem crédito, mesmo com grupo na nota', () => {
      const c = [compra('c1', [item(1, grupo('0.9', '0.1', '0'))], em2026)];
      const r = somarCreditosCompras(c, [calculado('c1', 1, ['88', '0.5', '0.5'], 'INCONSISTENCIA_ENTRADA')]);
      expect(r.creditos.toString()).toBe('0');
      expect(r.itensSemCredito).toBe(1);
    });

    it('nota de 2027 continua usando o grupo da própria nota', () => {
      const c = [compra('c1', [item(1, grupo('88', '0.5', '0.5'))], '2027-01-02T10:00:00-03:00')];
      expect(somarCreditosCompras(c, [calculado('c1', 1, ['1', '0', '0'])]).creditos.toString()).toBe('89');
    });
  });

  it('meses distintos da emissão das compras (data original), em ordem', () => {
    const c = [
      compra('c1', [item(1)], '2026-06-10T10:00:00-03:00'),
      compra('c2', [item(1)], '2026-04-02T10:00:00-03:00'),
      compra('c3', [item(1)], '2026-06-20T10:00:00-03:00'),
    ];
    expect(somarCreditosCompras(c, []).meses).toEqual(['2026-04', '2026-06']);
  });

  describe('fornecedor do Simples Nacional (LC 214, art. 47, § 9º, II)', () => {
    it('CRT 1, 2 ou 4 sem grupo na nota: crédito 0 e conta como sem crédito, mesmo com o motor calculando', () => {
      for (const crt of ['1', '2', '4']) {
        const c = [compra('c1', [item(1)], '2027-01-10T10:00:00-03:00', crt)];
        const r = somarCreditosCompras(c, [calculado('c1', 1, ['88', '0.5', '0.5'])]);
        expect(r.creditos.toString(), crt).toBe('0');
        expect(r.itensSemCredito, crt).toBe(1);
      }
    });
    it('CRT 1 em nota de 2026 (grupo de teste ignorado) também vale 0', () => {
      const c = [compra('c1', [item(1, grupo('0.9', '0.1', '0'))], '2026-05-10T10:00:00-03:00', '1')];
      expect(somarCreditosCompras(c, [calculado('c1', 1, ['88', '0.5', '0.5'])]).itensSemCredito).toBe(1);
    });
    it('CRT 1 com grupo válido na nota usa o valor informado pelo fornecedor', () => {
      const c = [compra('c1', [item(1, grupo('3', '1', '0'))], '2027-01-10T10:00:00-03:00', '1')];
      expect(somarCreditosCompras(c, [calculado('c1', 1, ['88', '0.5', '0.5'])]).creditos.toString()).toBe('4');
    });
    it('NFS-e de prestador optante (opSimpNac 2 ou 3) sem grupo vale 0; não optante (1) usa o motor', () => {
      const nfse = (opSimpNac: string): Documento => ({
        ...compra('s1', [item(1)]),
        tipo: 'NFSE',
        tpDoc: 91,
        emitente: { documento: '11444777000161', tipo: 'PJ', opSimpNac },
      });
      const calc = [calculado('s1', 1, ['88', '0.5', '0.5'])];
      expect(somarCreditosCompras([nfse('3')], calc).itensSemCredito).toBe(1);
      expect(somarCreditosCompras([nfse('2')], calc).itensSemCredito).toBe(1);
      expect(somarCreditosCompras([nfse('1')], calc).creditos.toString()).toBe('89');
    });
  });
});
