import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { LinhaAuditoria } from './auditar';
import { paraCsv } from './csv';

const base: LinhaAuditoria = {
  chave: 'C1', numeroNota: '10', papel: 'VENDA', tipo: 'NFE', item: 1, descricao: 'Açúcar; "refinado"',
  ncmOuNbs: '1701', cst: '000', cClassTrib: '000001', estado: 'CALCULO_SIMULADO', achado: 'VALOR_DIVERGENTE',
  erros: [{ code: 'A', title: '', detail: '' }, { code: 'B', title: '', detail: '' }],
  vNota: Big('1234.56'), vMotor: Big('1234.5'), diferenca: Big('0.06'), memoria: '',
};

describe('paraCsv', () => {
  const csv = paraCsv([base, { ...base, vNota: undefined, diferenca: undefined, erros: [], papel: 'COMPRA', tipo: 'NFSE' }]);
  const linhas = csv.split('\r\n');
  it('BOM, cabeçalho acentuado, CRLF', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas[0]).toBe('\uFEFFNota;Papel;Tipo;Item;Descrição;NCM/NBS;CST;cClassTrib;Estado;Achado;Códigos de erro;Valor na nota;Valor do motor;Diferença');
  });
  it('formata valores, quoting e rótulos', () => {
    expect(linhas[1]).toBe('10;Venda;NF-e;1;"Açúcar; ""refinado""";1701;000;000001;Cálculo simulado;Valor divergente;A | B;1234,56;1234,50;0,06');
    expect(linhas[2]).toContain(';Compra;NFS-e;');
    expect(linhas[2].endsWith(';;1234,50;')).toBe(true);
  });
  it('neutraliza injeção de fórmula só em texto', () => {
    const c = paraCsv([{ ...base, descricao: '=HYPERLINK("x")', ncmOuNbs: '@a', vNota: Big('-5') }]).split('\r\n')[1];
    expect(c).toContain(`;"'=HYPERLINK(""x"")";'@a;`);
    expect(c).toContain(';-5,00;');
  });
  it('item sem cálculo do motor (não calculado / erro do motor) deixa "Valor do motor" vazio, na mesma coluna', () => {
    const naoCalc = paraCsv([{ ...base, descricao: 'Açúcar', achado: 'NAO_CALCULADO', estado: 'NAO_CALCULADO', vMotor: Big(0), vNota: undefined, diferenca: undefined }]).split('\r\n')[1];
    expect(naoCalc.split(';')).toHaveLength(14);
    expect(naoCalc.endsWith(';;;')).toBe(true);
    const erro = paraCsv([{ ...base, achado: 'ERRO_MOTOR', estado: 'INCONSISTENCIA_ENTRADA', vMotor: Big(0), diferenca: undefined }]).split('\r\n')[1];
    expect(erro.endsWith(';1234,56;;')).toBe(true);
    // venda que o Simples calculou e o regular recusou mantém o valor do Simples (como na tela)
    const vendaRecusada = paraCsv([{ ...base, achado: 'ERRO_MOTOR', diferenca: undefined }]).split('\r\n')[1];
    expect(vendaRecusada.endsWith(';1234,56;1234,50;')).toBe(true);
  });
});
