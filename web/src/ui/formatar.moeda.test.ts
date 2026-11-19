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
    expect(parseNumeroBR('1234.56')).toBeNull();
    expect(parseNumeroBR('3600000.50')).toBeNull();
    expect(parseNumeroBR('1.2')).toBeNull();
    expect(parseNumeroBR('1.234.567,89')?.eq('1234567.89')).toBe(true);
    expect(parseNumeroBR('R$ 1.234.567,89')?.eq('1234567.89')).toBe(true);
  });

  it('formata com separador de milhar e vírgula', () => {
    expect(formatarMoeda(Big('3600000'))).toBe('R$ 3.600.000,00');
    expect(formatarMoeda(Big('1234.565'))).toBe('R$ 1.234,57');
    expect(formatarMoeda(Big('0'))).toBe('R$ 0,00');
    expect(formatarNumeroBR(Big('1234.5'))).toBe('1.234,50');
  });
  it('valor negativo leva o sinal antes do símbolo; zero arredondado não leva sinal', () => {
    expect(formatarMoeda(new Big('-1234.5'))).toBe('-R$ 1.234,50');
    expect(formatarMoeda(new Big('-0.001'))).toBe('R$ 0,00');
  });
});
