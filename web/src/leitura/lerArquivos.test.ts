import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { arquivoFixture, bytesFixture } from './fixtures.ts';
import { lerArquivos, TAMANHO_MAXIMO_TOTAL, TAMANHO_MAXIMO_XML } from './lerArquivos.ts';

function zip(entradas: Record<string, Uint8Array>, nome = 'lote.zip'): File {
  return new File([zipSync(entradas) as BlobPart], nome);
}

describe('lerArquivos', () => {
  it('mesma chave em procNFe solto e NFe dentro de ZIP: 1 documento + 1 DUPLICADO', async () => {
    const r = await lerArquivos([
      arquivoFixture('nfe_sem_ibscbs.xml'),
      zip({ 'x/nfe_sem_ibscbs.xml': bytesFixture('nfe_sem_ibscbs.xml') }),
    ]);
    expect(r.documentos).toHaveLength(1);
    expect(r.ignorados).toHaveLength(1);
    expect(r.ignorados[0].motivo).toBe('DUPLICADO');
  });

  it('XML ISO-8859-1 com BOM e acentos preserva a descrição', async () => {
    const r = await lerArquivos([arquivoFixture('nfe_iso8859.xml')]);
    expect(r.ignorados).toEqual([]);
    expect(r.documentos[0].itens[0].descricao).toBe('AÇÚCAR REFINADO');
  });

  it('arquivo não-XML vira XML_INVALIDO', async () => {
    const r = await lerArquivos([new File(['isto não é xml'], 'lixo.txt')]);
    expect(r.documentos).toEqual([]);
    expect(r.ignorados[0]).toMatchObject({ arquivo: 'lixo.txt', motivo: 'XML_INVALIDO' });
  });

  it('ZIP com subpastas lê todos os .xml e lista o que não é XML como não suportado', async () => {
    const r = await lerArquivos([
      zip({
        'a/b/nfe_sem_ibscbs.xml': bytesFixture('nfe_sem_ibscbs.xml'),
        'c/nfce.xml': bytesFixture('nfce.xml'),
        'nfse_nacional.xml': bytesFixture('nfse_nacional.xml'),
        'leia-me.txt': new TextEncoder().encode('oi'),
        '__MACOSX/c/._nfce.xml': new TextEncoder().encode('metadados'),
      }),
    ]);
    expect(r.documentos.map((d) => d.tipo).sort()).toEqual(['NFCE', 'NFE', 'NFSE']);
    expect(r.ignorados).toEqual([expect.objectContaining({ arquivo: 'lote.zip/leia-me.txt', motivo: 'TIPO_NAO_SUPORTADO' })]);
  });

  it('abre um nível de ZIP dentro de ZIP; o segundo nível fica como não suportado', async () => {
    const interno2 = zipSync({ 'nfce.xml': bytesFixture('nfce.xml') });
    const interno = zipSync({ 'nfe.xml': bytesFixture('nfe_sem_ibscbs.xml'), 'mais.zip': interno2 });
    const r = await lerArquivos([zip({ 'mes/marco.zip': interno, 'nfse.xml': bytesFixture('nfse_nacional.xml') })]);
    expect(r.documentos.map((d) => d.tipo).sort()).toEqual(['NFE', 'NFSE']);
    expect(r.documentos.find((d) => d.tipo === 'NFE')?.arquivo).toBe('lote.zip/mes/marco.zip/nfe.xml');
    expect(r.ignorados).toEqual([expect.objectContaining({ arquivo: 'lote.zip/mes/marco.zip/mais.zip', motivo: 'TIPO_NAO_SUPORTADO' })]);
  });

  it('XML descompactado acima do teto fica de fora como grande demais, sem ser descompactado', async () => {
    const grande = new Uint8Array(TAMANHO_MAXIMO_XML + 1).fill(0x20);
    const r = await lerArquivos([zip({ 'enorme.xml': grande, 'nfe.xml': bytesFixture('nfe_sem_ibscbs.xml') })]);
    expect(r.documentos).toHaveLength(1);
    expect(r.ignorados).toEqual([expect.objectContaining({ arquivo: 'lote.zip/enorme.xml', motivo: 'MUITO_GRANDE' })]);
  });

  it('XML solto acima do teto fica de fora sem ser lido', async () => {
    const r = await lerArquivos([new File([new Uint8Array(TAMANHO_MAXIMO_XML + 1)], 'solto.xml')]);
    expect(r.ignorados).toEqual([expect.objectContaining({ arquivo: 'solto.xml', motivo: 'MUITO_GRANDE' })]);
  });

  it('total descompactado do envio tem teto: o que passaria dele fica de fora', async () => {
    // Cada entrada fica abaixo do teto por XML, mas a soma passa do teto do envio.
    const porEntrada = TAMANHO_MAXIMO_XML - 1;
    const quantas = Math.floor(TAMANHO_MAXIMO_TOTAL / porEntrada) + 1;
    const bloco = new Uint8Array(porEntrada).fill(0x20);
    const entradas: Record<string, Uint8Array> = {};
    for (let i = 0; i < quantas; i++) entradas[`b${String(i).padStart(3, '0')}.xml`] = bloco;
    const r = await lerArquivos([zip(entradas)]);
    const grandes = r.ignorados.filter((i) => i.motivo === 'MUITO_GRANDE');
    expect(grandes.length).toBeGreaterThanOrEqual(1);
    expect(grandes[0].detalhe).toMatch(/300 MB/);
  }, 60_000);
  it('mistura eventos e NFS-e municipal nos ignorados', async () => {
    const r = await lerArquivos([arquivoFixture('evento_cancelamento.xml'), arquivoFixture('nfse_municipal.xml')]);
    expect(r.ignorados.map((i) => i.motivo).sort()).toEqual(['EVENTO', 'NFSE_MUNICIPAL']);
  });
});
