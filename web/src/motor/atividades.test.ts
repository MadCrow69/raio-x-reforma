import Big from 'big.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import atividadesJson from './__fixtures__/simples-atividades-2027.json';
import { atividadesParaTipos, carregarAtividades, GRUPO_MERCADORIAS, GRUPO_SERVICOS, resolverAnexo } from './atividades';

afterEach(() => vi.restoreAllMocks());

const carregar = async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atividadesJson)));
  return carregarAtividades();
};

describe('atividades do Simples', () => {
  it('lê o catálogo com anexos, modo do Fator R e documentos admissíveis como números', async () => {
    const todas = await carregar();
    expect(todas.length).toBe(15);
    const a09 = todas.find((a) => a.codigo === '09')!;
    expect(a09).toMatchObject({ modoFatorR: 'OPCIONAL', anexoPrincipal: 'III', anexoFatorRBaixo: 'V', tpDocs: [91] });
    expect(todas.find((a) => a.codigo === '90')!.anexoPrincipal).toBeNull();
  });

  it('falha em português quando o motor não responde', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    await expect(carregarAtividades()).rejects.toThrow(/HTTP 500/);
  });

  it('filtra por grupo de documento e descarta atividade sem anexo', async () => {
    const todas = await carregar();
    expect(atividadesParaTipos(todas, GRUPO_MERCADORIAS).map((a) => a.codigo)).toEqual(['01', '02', '03', '04']);
    expect(atividadesParaTipos(todas, GRUPO_SERVICOS).map((a) => a.codigo)).toEqual(['07', '08', '09', '10', '11', '12', '13', '14']);
  });

  it('resolve o anexo: sem Fator R usa o principal; com Fator R, ≥ 28% da folha sobre o RBT12 → III, senão V', async () => {
    const todas = await carregar();
    const a01 = todas.find((a) => a.codigo === '01')!;
    const a09 = todas.find((a) => a.codigo === '09')!;
    expect(resolverAnexo(a01, Big(1_000_000), null)).toBe('I');
    expect(resolverAnexo(a09, Big(1_000_000), Big(280_000))).toBe('III');
    expect(resolverAnexo(a09, Big(1_000_000), Big('279999.99'))).toBe('V');
    expect(resolverAnexo(a09, Big(1_000_000), null)).toBeNull();
  });
});
