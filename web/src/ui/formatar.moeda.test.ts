import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import { formatarMoeda, formatarNumeroBR, parseNumeroBR } from './formatar';

describe('moeda pt-BR', () => {
  it('lê texto BR como Big, sem passar por number', () => {
    expect(parseNumeroBR('3.600.000,00')?.eq('3600000')).toBe(true);
    expect(parseNumeroBR('R$ 1.234,5')?.eq('1234.5')).toBe(true);
    expect(parseNumeroBR('3600000')?.eq('3600000')).toBe(true);
    expect(parseNumeroBR('0,1')?.eq('0.1')).toBe(true);
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('abc')).toBeNull();
    expect(parseNumeroBR('1,234')).toBeNull(); // mais de 2 casas
    expect(parseNumeroBR('-5')).toBeNull();
  });

  it('formata com separador de milhar e vírgula', () => {
    expect(formatarMoeda(Big('3600000'))).toBe('R$ 3.600.000,00');
    expect(formatarMoeda(Big('1234.565'))).toBe('R$ 1.234,57');
    expect(formatarMoeda(Big('0'))).toBe('R$ 0,00');
    expect(formatarNumeroBR(Big('1234.5'))).toBe('1.234,50');
  });
});
