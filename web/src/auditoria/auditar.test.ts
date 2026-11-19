import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento, ItemDocumento } from '../leitura/tipos';
import type { ItemCalculado } from '../motor/tipos';
import { auditar } from './auditar';

function item(numero: number, nota?: [string, string, string]): ItemDocumento {
  return {
    numero,
    descricao: `Item ${numero}`,
    ncm: '12345678',
    baseCalculo: Big(100),
    valorIS: Big(0),
    ibscbsNota: nota && {
      cst: '000',
      cClassTrib: '000001',
      vBC: Big(100),
      vCBS: Big(nota[0]),
      vIBSUF: Big(nota[1]),
      vIBSMun: Big(nota[2]),
    },
  };
}
function doc(itens: ItemDocumento[], chave = 'C1'): Documento {
  return {
    chave, numero: '10', tipo: 'NFE', tpDoc: 55, emissao: '2027-01-01T00:00:00-03:00',
    emitente: { documento: '1', tipo: 'PJ' }, itens, arquivo: 'a.xml',
  };
}
function calc(numero: number, v: [string, string, string], extra: Partial<ItemCalculado> = {}): ItemCalculado {
  return {
    chave: 'C1', numero, estado: 'CALCULO_SIMULADO',
    vCBS: Big(v[0]), vIBSUF: Big(v[1]), vIBSMun: Big(v[2]), erros: [], memoria: 'mem', ...extra,
  };
}

describe('auditar', () => {
  it('OK quando nota == motor', () => {
    const [l] = auditar([doc([item(1, ['0.9', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])]);
    expect(l.achado).toBe('OK');
    expect(l.papel).toBe('VENDA');
    expect(l.vNota?.toString()).toBe('1');
    expect(l.vMotor.toString()).toBe('1');
    expect(l.ncmOuNbs).toBe('12345678');
    expect(l.cst).toBe('000');
  });
  it('R$ 0,02 em vCBS diverge', () => {
    const [l] = auditar([doc([item(1, ['0.92', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])]);
    expect(l.achado).toBe('VALOR_DIVERGENTE');
    expect(l.diferenca?.toString()).toBe('0.02');
  });
  it('R$ 0,01 é tolerado e diferença negativa mantém sinal', () => {
    const [a] = auditar([doc([item(1, ['0.91', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])]);
    expect(a.achado).toBe('OK');
    const [b] = auditar([doc([item(1, ['0.5', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])]);
    expect(b.diferenca?.toString()).toBe('-0.4');
  });
  it('erro do motor', () => {
    const erros = [{ code: 'REG-011', title: 't', detail: 'd' }];
    const [l] = auditar([], [doc([item(1, ['0', '0', '0'])])], [calc(1, ['0', '0', '0'], { estado: 'INCONSISTENCIA_ENTRADA', erros })]);
    expect(l.achado).toBe('ERRO_MOTOR');
    expect(l.papel).toBe('COMPRA');
  });
  it('estado não simulado sem erros é NAO_CALCULADO', () => {
    const [l] = auditar([doc([item(1)])], [], [calc(1, ['0', '0', '0'], { estado: 'NAO_CALCULADO' })]);
    expect(l.achado).toBe('NAO_CALCULADO');
  });
  it('sem grupo na nota', () => {
    const [l] = auditar([doc([item(1)])], [], [calc(1, ['0.9', '0.1', '0'])]);
    expect(l.achado).toBe('SEM_GRUPO_NA_NOTA');
    expect(l.vNota).toBeUndefined();
    expect(l.diferenca).toBeUndefined();
    expect(l.cst).toBe('');
  });
  it('item sem calculado vira NAO_CALCULADO e não some', () => {
    const ls = auditar([doc([item(1), item(2)])], [], [calc(1, ['0', '0', '0'])]);
    expect(ls).toHaveLength(2);
    expect(ls[1].achado).toBe('NAO_CALCULADO');
    expect(ls[1].vMotor.toString()).toBe('0');
  });
});
