import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { arquivoFixture, bytesFixture } from './fixtures.ts';
import { lerArquivos } from './lerArquivos.ts';

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

  it('ZIP com subpastas lê todos os .xml e ignora o resto', async () => {
    const r = await lerArquivos([
      zip({
        'a/b/nfe_sem_ibscbs.xml': bytesFixture('nfe_sem_ibscbs.xml'),
        'c/nfce.xml': bytesFixture('nfce.xml'),
        'nfse_nacional.xml': bytesFixture('nfse_nacional.xml'),
        'leia-me.txt': new TextEncoder().encode('oi'),
      }),
    ]);
    expect(r.documentos.map((d) => d.tipo).sort()).toEqual(['NFCE', 'NFE', 'NFSE']);
    expect(r.ignorados).toEqual([]);
  });

  it('mistura eventos e NFS-e municipal nos ignorados', async () => {
    const r = await lerArquivos([arquivoFixture('evento_cancelamento.xml'), arquivoFixture('nfse_municipal.xml')]);
    expect(r.ignorados.map((i) => i.motivo).sort()).toEqual(['EVENTO', 'NFSE_MUNICIPAL']);
  });
});
