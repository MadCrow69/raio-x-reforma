import { unzipSync } from 'fflate';
import { lerNFe } from './nfe.ts';
import { lerNFSe } from './nfse.ts';
import type { Documento, DocumentoIgnorado, ResultadoLeitura } from './tipos.ts';
import { decodificarXml, parseXml } from './xmlUtil.ts';

interface Entrada {
  nome: string;
  bytes: Uint8Array;
}

function ehZip(nome: string, bytes: Uint8Array): boolean {
  const assinatura = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return nome.toLowerCase().endsWith('.zip') || assinatura;
}

function lerDocumento(entrada: Entrada): Documento | DocumentoIgnorado {
  let doc: Document | null;
  try {
    doc = parseXml(decodificarXml(entrada.bytes));
  } catch {
    doc = null;
  }
  if (!doc) return { arquivo: entrada.nome, motivo: 'XML_INVALIDO', detalhe: 'O arquivo não é um XML válido.' };
  return /nfse/i.test(doc.documentElement.localName) ? lerNFSe(doc, entrada.nome) : lerNFe(doc, entrada.nome);
}

/** Lê XMLs soltos e ZIPs (com subpastas); deduplica pela chave de acesso. */
export async function lerArquivos(arquivos: File[]): Promise<ResultadoLeitura> {
  const entradas: Entrada[] = [];
  const ignorados: DocumentoIgnorado[] = [];

  for (const arquivo of arquivos) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (!ehZip(arquivo.name, bytes)) {
      entradas.push({ nome: arquivo.name, bytes });
      continue;
    }
    try {
      const conteudo = unzipSync(bytes, {
        filter: (f) => f.name.toLowerCase().endsWith('.xml') && !f.name.startsWith('__MACOSX/'),
      });
      for (const [caminho, dados] of Object.entries(conteudo)) {
        entradas.push({ nome: `${arquivo.name}/${caminho}`, bytes: dados });
      }
    } catch {
      ignorados.push({ arquivo: arquivo.name, motivo: 'XML_INVALIDO', detalhe: 'ZIP corrompido ou ilegível.' });
    }
  }

  const documentos: Documento[] = [];
  const vistos = new Map<string, string>();
  for (const entrada of entradas) {
    const r = lerDocumento(entrada);
    if (!('chave' in r)) {
      ignorados.push(r);
    } else if (vistos.has(r.chave)) {
      ignorados.push({ arquivo: r.arquivo, motivo: 'DUPLICADO', detalhe: `Mesma chave de acesso de ${vistos.get(r.chave)}.` });
    } else {
      vistos.set(r.chave, r.arquivo);
      documentos.push(r);
    }
  }
  return { documentos, ignorados };
}
