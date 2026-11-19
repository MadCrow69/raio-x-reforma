import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento, ItemDocumento } from '../leitura/tipos';
import type { ItemCalculado } from '../motor/tipos';
import { identificarGrupo } from '../classificacao/sugestoes';
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
function doc(itens: ItemDocumento[], chave = 'C1', emissao = '2027-01-01T00:00:00-03:00'): Documento {
  return {
    chave, numero: '10', tipo: 'NFE', tpDoc: 55, emissao,
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
  it('propaga a origem da memória do item calculado (e não inventa uma)', () => {
    const d = [doc([item(1, ['0.9', '0.1', '0'])])];
    expect(auditar(d, [], [calc(1, ['0.9', '0.1', '0'], { origemMemoria: 'COMPOSTA' })])[0].origemMemoria).toBe('COMPOSTA');
    expect(auditar(d, [], [calc(1, ['0.9', '0.1', '0'], { origemMemoria: 'MOTOR' })])[0].origemMemoria).toBe('MOTOR');
    expect(auditar(d, [], [calc(1, ['0.9', '0.1', '0'])])[0].origemMemoria).toBeUndefined();
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
  it('CST/cClassTrib: classificação confirmada prevalece sobre a da nota', () => {
    const op = { cst: '200', cClassTrib: '200003', descricao: '', reducaoCbs: Big(0), reducaoIbs: Big(0) };
    const semGrupo = doc([item(1)]);
    const chave1 = identificarGrupo(semGrupo.itens[0]).chave;
    const [a] = auditar([semGrupo], [], [calc(1, ['0', '0', '0'])], { [chave1]: op });
    expect([a.cst, a.cClassTrib]).toEqual(['200', '200003']);
    const comGrupo = doc([item(1, ['0.9', '0.1', '0'])]);
    const chave2 = identificarGrupo(comGrupo.itens[0]).chave;
    const [b] = auditar([comGrupo], [], [calc(1, ['0.9', '0.1', '0'])], { [chave2]: op });
    expect([b.cst, b.cClassTrib]).toEqual(['200', '200003']);
  });

  describe('validação do regime regular nas vendas (porFora)', () => {
    const erros = [{ code: 'REG-011', title: 'NCM não vinculada', detail: 'd' }];
    const recusado = (extra: Partial<ItemCalculado> = {}) =>
      calc(1, ['0', '0', '0'], { estado: 'INCONSISTENCIA_ENTRADA', erros, ...extra });

    it('venda com REG-011 só no porFora vira ERRO_MOTOR, com o código e o valor do Simples', () => {
      const [l] = auditar([doc([item(1, ['0.9', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'], { origemMemoria: 'COMPOSTA' })], {}, [recusado()]);
      expect(l.achado).toBe('ERRO_MOTOR');
      expect(l.erros.map((e) => e.code)).toEqual(['REG-011']);
      expect(l.estado).toBe('CALCULO_SIMULADO');
      expect(l.vMotor.toString()).toBe('1');
      expect(l.origemMemoria).toBe('COMPOSTA');
    });
    it('venda que o regular não calculou e sem erro vira NAO_CALCULADO', () => {
      const [l] = auditar([doc([item(1)])], [], [calc(1, ['0.9', '0.1', '0'])], {}, [calc(1, ['0', '0', '0'], { estado: 'FALHA_TECNICA' })]);
      expect(l.achado).toBe('NAO_CALCULADO');
    });
    it('venda validada nos dois motores segue pela comparação de valores', () => {
      const [l] = auditar([doc([item(1, ['0.9', '0.1', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])], {}, [calc(1, ['9', '1', '0'])]);
      expect(l.achado).toBe('OK');
    });
    it('compras não mudam: a validação só vale para vendas', () => {
      const [l] = auditar([], [doc([item(1, ['0.9', '0.1', '0'])])], [calc(1, ['0.9', '0.1', '0'])], {}, [recusado()]);
      expect(l.achado).toBe('OK');
    });
  });

  describe('notas anteriores a 2027 (alíquotas de teste)', () => {
    const em2026 = '2026-05-10T10:00:00-03:00';

    it('compra de 2026 com grupo não é comparada: NOTA_ALIQUOTA_TESTE, sem diferença', () => {
      const [l] = auditar([], [doc([item(1, ['0.9', '0.1', '0'])], 'C1', em2026)], [calc(1, ['8.8', '0.05', '0.05'])]);
      expect(l.achado).toBe('NOTA_ALIQUOTA_TESTE');
      expect(l.diferenca).toBeUndefined();
      expect(l.vNota?.toString()).toBe('1');
      expect(l.vMotor.toString()).toBe('8.9');
    });
    it('venda de 2026 com grupo também não é comparada', () => {
      const [l] = auditar([doc([item(1, ['0.9', '0.1', '0'])], 'C1', em2026)], [], [calc(1, ['5', '1', '0'])], {}, [calc(1, ['8.8', '0.05', '0.05'])]);
      expect(l.achado).toBe('NOTA_ALIQUOTA_TESTE');
    });
    it('erro do motor continua prevalecendo', () => {
      const erros = [{ code: 'REG-011', title: 't', detail: 'd' }];
      const [l] = auditar([], [doc([item(1, ['0.9', '0.1', '0'])], 'C1', em2026)], [calc(1, ['0', '0', '0'], { estado: 'INCONSISTENCIA_ENTRADA', erros })]);
      expect(l.achado).toBe('ERRO_MOTOR');
    });
    it('nota de 2026 sem grupo segue SEM_GRUPO_NA_NOTA', () => {
      const [l] = auditar([], [doc([item(1)], 'C1', em2026)], [calc(1, ['8.8', '0.05', '0.05'])]);
      expect(l.achado).toBe('SEM_GRUPO_NA_NOTA');
    });
  });

  describe('saída sem receita (CFOP de transferência/remessa)', () => {
    const comCfop = (cfop: string, nota?: [string, string, string]) => ({ ...item(1, nota), cfop });

    it('venda com CFOP de transferência vira SAIDA_SEM_RECEITA, sem comparar valores', () => {
      const [l] = auditar([doc([comCfop('5152', ['1', '0', '0'])])], [], [calc(1, ['0.9', '0.1', '0'])]);
      expect(l.achado).toBe('SAIDA_SEM_RECEITA');
      expect(l.diferenca).toBeUndefined();
    });
    it('prevalece sobre erro do motor, para a contagem bater com o aviso do Resumo (o erro continua na linha)', () => {
      const erros = [{ code: 'REG-011', title: 't', detail: 'd' }];
      const [l] = auditar([doc([comCfop('5949')])], [], [calc(1, ['0', '0', '0'], { estado: 'INCONSISTENCIA_ENTRADA', erros })]);
      expect(l.achado).toBe('SAIDA_SEM_RECEITA');
      expect(l.erros.map((e) => e.code)).toEqual(['REG-011']);
    });
    it('compra com o mesmo CFOP não muda (a regra é da receita da empresa)', () => {
      const [l] = auditar([], [doc([comCfop('5152', ['0.9', '0.1', '0'])])], [calc(1, ['0.9', '0.1', '0'])]);
      expect(l.achado).toBe('OK');
    });
  });
});
