import { describe, expect, it } from 'vitest';
import { cnpjValido, normalizarCnpj } from './cnpj';

describe('normalizarCnpj', () => {
  it('remove máscara e põe em maiúsculas', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizarCnpj(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ numérico válido (com e sem máscara)', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
  });
  it('rejeita numérico com DV errado, tamanho errado e repetidos', () => {
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  it('aceita CNPJ alfanumérico do exemplo oficial da Receita (12ABC34501DE35)', () => {
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
  });
  it('rejeita alfanumérico com DV errado ou DV não numérico', () => {
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
    expect(cnpjValido('12ABC34501DEAB')).toBe(false);
  });
});
