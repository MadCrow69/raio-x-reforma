import { describe, expect, it, vi } from 'vitest';
import { arquivoFixture } from './fixtures.ts';

// Leitor de NF-e que estoura com um erro que não é ErroLeitura (ex.: pilha estourada por aninhamento patológico).
vi.mock('./nfe.ts', async (original) => {
  const real = await original<typeof import('./nfe.ts')>();
  return {
    ...real,
    lerNFe: (xml: Document, arquivo: string) => {
      if (arquivo === 'explode.xml') throw new RangeError('Maximum call stack size exceeded');
      return real.lerNFe(xml, arquivo);
    },
  };
});

const { lerArquivos } = await import('./lerArquivos.ts');

describe('lerArquivos com erro inesperado num arquivo', () => {
  it('o erro não derruba o lote: o arquivo vira XML inválido com o detalhe e os demais são lidos', async () => {
    const r = await lerArquivos([arquivoFixture('nfe_sem_ibscbs.xml', 'explode.xml'), arquivoFixture('nfce.xml')]);
    expect(r.documentos.map((d) => d.tipo)).toEqual(['NFCE']);
    expect(r.ignorados).toEqual([
      { arquivo: 'explode.xml', motivo: 'XML_INVALIDO', detalhe: 'Não foi possível ler o arquivo (Maximum call stack size exceeded).' },
    ]);
  });
});
