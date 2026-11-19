import { describe, expect, it } from 'vitest';
import Big from 'big.js';
import { contar, formatarCnpj, formatarMeses, formatarPercentual, formatarPeriodo } from './formatar';

describe('formatar', () => {
  it('contar usa singular só para 1 e separa milhar', () => {
    expect(contar(1, 'nota lida', 'notas lidas')).toBe('1 nota lida');
    expect(contar(0, 'nota lida', 'notas lidas')).toBe('0 notas lidas');
    expect(contar(1200, 'nota lida', 'notas lidas')).toBe('1.200 notas lidas');
  });

  it('formatarPeriodo junta o primeiro e o último mês, em ordem', () => {
    expect(formatarPeriodo([])).toBe('');
    expect(formatarPeriodo(['2026-03-10T10:00:00-03:00', '2026-03-31T23:00:00-03:00'])).toBe('mar/2026');
    expect(formatarPeriodo(['2027-05-02', '2026-12-01T08:00:00-03:00', '2027-01-15'])).toBe('dez/2026 a mai/2027');
  });
  it('formatarMeses: um mês, intervalo no mesmo ano e entre anos', () => {
    expect(formatarMeses([])).toBe('');
    expect(formatarMeses(['2026-03'])).toBe('mar/2026');
    expect(formatarMeses(['2026-05', '2026-03', '2026-04'])).toBe('mar–mai/2026');
    expect(formatarMeses(['2025-11', '2026-02'])).toBe('nov/2025–fev/2026');
  });

  it('formatarCnpj aplica a máscara de 14 caracteres (numérico ou alfanumérico)', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(formatarCnpj('123')).toBe('123');
  });

  it('formatarPercentual: vírgula, até 2 casas (ou as pedidas), sem zeros à direita', () => {
    expect(formatarPercentual(Big('8.8'))).toBe('8,8%');
    expect(formatarPercentual(Big('0.05'))).toBe('0,05%');
    expect(formatarPercentual(Big('7.33456'))).toBe('7,33%');
    expect(formatarPercentual(Big('2.75'), 4)).toBe('2,75%');
    expect(formatarPercentual(Big('0.12345'), 4)).toBe('0,1235%');
    expect(formatarPercentual(Big(100))).toBe('100%');
  });
});
