import { describe, expect, it } from 'vitest';
import { lerNFSe } from './nfse.ts';
import { xmlFixture } from './fixtures.ts';

describe('lerNFSe', () => {
  it('NFS-e nacional: tipo NFSE, tpDoc 91 e item único com nbs', () => {
    const r = lerNFSe(xmlFixture('nfse_nacional.xml'), 'n.xml');
    if (!('chave' in r)) throw new Error(r.motivo);
    expect(r.tipo).toBe('NFSE');
    expect(r.tpDoc).toBe(91);
    expect(r.numero).toBe('228');
    expect(r.chave).toBe('41137002211111111000111000000000022826054848833960');
    expect(r.emissao).toBe('2026-05-18T18:20:52-03:00');
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].numero).toBe(1);
    expect(r.itens[0].nbs).toBe('115021000');
    // 1000 - 50 (incondicionado); o desconto condicionado não abate
    expect(r.itens[0].baseCalculo.toString()).toBe('950');
    expect(r.itens[0].ibscbsNota?.vCBS.toString()).toBe('8.55');
    expect(r.destinatario).toMatchObject({ documento: '22222222000122', tipo: 'PJ', municipioIbge: '3550308' });
    expect(r.emitente.opSimpNac).toBe('1');
  });

  it('NFS-e municipal (raiz diferente da nacional) é ignorada como NFSE_MUNICIPAL', () => {
    const r = lerNFSe(xmlFixture('nfse_municipal.xml'), 'm.xml');
    expect(r).toMatchObject({ motivo: 'NFSE_MUNICIPAL' });
  });
});
