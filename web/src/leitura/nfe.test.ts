import { describe, expect, it } from 'vitest';
import { lerNFe } from './nfe.ts';
import type { Documento } from './tipos.ts';
import { xmlFixture } from './fixtures.ts';

function doc(nome: string): Documento {
  const r = lerNFe(xmlFixture(nome), nome);
  if (!('chave' in r)) throw new Error(`esperava Documento, veio ${r.motivo}`);
  return r;
}

describe('lerNFe', () => {
  it('NF-e 55 sem grupo IBSCBS: tipo, base do item e ibscbsNota indefinido', () => {
    const d = doc('nfe_sem_ibscbs.xml');
    expect(d.tipo).toBe('NFE');
    expect(d.tpDoc).toBe(55);
    expect(d.chave).toBe('41260311111111000111550010000000011100000019');
    expect(d.numero).toBe('1');
    expect(d.emissao).toBe('2026-03-10T10:30:00-03:00');
    // 100 + 10 + 2 + 3 - 5
    expect(d.itens[0].baseCalculo.toString()).toBe('110');
    expect(d.itens[0].ibscbsNota).toBeUndefined();
    expect(d.itens[0].valorIS.toString()).toBe('0');
    expect(d.itens[1].valorIS.toString()).toBe('4.5');
    expect(d.itens[0].ncm).toBe('22021000');
    expect(d.emitente).toMatchObject({ documento: '11111111000111', tipo: 'PJ', uf: 'PR', municipioIbge: '4113700', crt: '3' });
    expect(d.destinatario).toMatchObject({ documento: '22222222000122', tipo: 'PJ', uf: 'SP' });
  });

  it('NF-e 55 com grupo IBSCBS: preenche cClassTrib e vCBS', () => {
    const d = doc('nfe_com_ibscbs.xml');
    expect(d.itens[0].ibscbsNota?.cClassTrib).toBe('000001');
    expect(d.itens[0].ibscbsNota?.cst).toBe('000');
    expect(d.itens[0].ibscbsNota?.vCBS.toString()).toBe('0.9');
    expect(d.itens[0].ibscbsNota?.vIBSUF.toString()).toBe('0.1');
  });

  it('NFC-e 65: tipo NFCE e destinatário indefinido sem dest', () => {
    const d = doc('nfce.xml');
    expect(d.tipo).toBe('NFCE');
    expect(d.tpDoc).toBe(65);
    expect(d.destinatario).toBeUndefined();
  });

  it('procEventoNFe é ignorado como EVENTO', () => {
    const r = lerNFe(xmlFixture('evento_cancelamento.xml'), 'e.xml');
    expect(r).toMatchObject({ motivo: 'EVENTO' });
  });

  it('finNFe=4 é ignorado como DEVOLUCAO', () => {
    const r = lerNFe(xmlFixture('nfe_devolucao.xml'), 'd.xml');
    expect(r).toMatchObject({ motivo: 'DEVOLUCAO' });
  });
});
