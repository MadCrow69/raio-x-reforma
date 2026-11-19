import { describe, expect, it } from 'vitest';
import { contar, formatarPeriodo } from './formatar';

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
});
