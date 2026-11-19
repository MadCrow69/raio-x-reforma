import { unzipSync } from 'fflate';
import { lerNFe } from './nfe.ts';
import { lerNFSe } from './nfse.ts';
import type { Documento, DocumentoIgnorado, ResultadoLeitura } from './tipos.ts';
import { decodificarXml, parseXml } from './xmlUtil.ts';

const MB = 1024 * 1024;
/** Teto de um XML (solto ou descompactado): um XML de NF-e real raramente passa de 1 MB. */
export const TAMANHO_MAXIMO_XML = 20 * MB;
/** Teto do total descompactado de um envio (todos os ZIPs, inclusive os aninhados): protege contra "ZIP bomb". */
export const TAMANHO_MAXIMO_TOTAL = 300 * MB;
/** Níveis de ZIP dentro de ZIP que são abertos (o ZIP enviado é o nível 0). */
const NIVEIS_ZIP_ANINHADO = 1;

const emMb = (bytes: number) => `${Math.round(bytes / MB)} MB`;

interface Entrada {
  nome: string;
  bytes: Uint8Array;
}

/** Quanto ainda pode ser descompactado neste envio. */
interface Orcamento {
  restante: number;
}

function ehZip(nome: string, bytes: Uint8Array): boolean {
  const assinatura = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return nome.toLowerCase().endsWith('.zip') || assinatura;
}

const grandeDemais = (arquivo: string, detalhe: string): DocumentoIgnorado => ({ arquivo, motivo: 'MUITO_GRANDE', detalhe });

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

/**
 * Abre um ZIP (e os ZIPs dentro dele, até NIVEIS_ZIP_ANINHADO). Só descompacta o que cabe nos tetos, pelo tamanho
 * descompactado declarado no próprio ZIP (o fflate não escreve além dele). Nada some em silêncio: o que não é XML
 * nem ZIP vira TIPO_NAO_SUPORTADO e o que passa dos tetos vira MUITO_GRANDE.
 */
function abrirZip(nome: string, bytes: Uint8Array, nivel: number, orcamento: Orcamento, entradas: Entrada[], ignorados: DocumentoIgnorado[]) {
  const pulados: DocumentoIgnorado[] = [];
  const zipsInternos: string[] = [];
  let conteudo: Record<string, Uint8Array>;
  try {
    conteudo = unzipSync(bytes, {
      filter: (f) => {
        // Pastas e metadados do macOS não são arquivos do usuário.
        if (f.name.endsWith('/') || f.name.startsWith('__MACOSX/')) return false;
        const caminho = `${nome}/${f.name}`;
        const minusculo = f.name.toLowerCase();
        const xml = minusculo.endsWith('.xml');
        const zip = minusculo.endsWith('.zip');
        if (!xml && !zip) {
          pulados.push({ arquivo: caminho, motivo: 'TIPO_NAO_SUPORTADO', detalhe: 'Só arquivos .xml e .zip são lidos.' });
          return false;
        }
        if (zip && nivel >= NIVEIS_ZIP_ANINHADO) {
          pulados.push({ arquivo: caminho, motivo: 'TIPO_NAO_SUPORTADO', detalhe: 'Só um nível de ZIP dentro de ZIP é aberto.' });
          return false;
        }
        if (xml && f.originalSize > TAMANHO_MAXIMO_XML) {
          pulados.push(grandeDemais(caminho, `XML com mais de ${emMb(TAMANHO_MAXIMO_XML)} descompactado.`));
          return false;
        }
        if (f.originalSize > orcamento.restante) {
          pulados.push(grandeDemais(caminho, `O total descompactado do envio passaria de ${emMb(TAMANHO_MAXIMO_TOTAL)}.`));
          return false;
        }
        orcamento.restante -= f.originalSize;
        if (zip) zipsInternos.push(f.name);
        return true;
      },
    });
  } catch {
    ignorados.push({ arquivo: nome, motivo: 'XML_INVALIDO', detalhe: 'ZIP corrompido ou ilegível.' });
    return;
  }
  ignorados.push(...pulados);
  for (const [caminho, dados] of Object.entries(conteudo)) {
    if (zipsInternos.includes(caminho)) abrirZip(`${nome}/${caminho}`, dados, nivel + 1, orcamento, entradas, ignorados);
    else entradas.push({ nome: `${nome}/${caminho}`, bytes: dados });
  }
}

/** Lê XMLs soltos e ZIPs (com subpastas e um nível de ZIP aninhado); deduplica pela chave de acesso e tira as canceladas. */
export async function lerArquivos(arquivos: File[]): Promise<ResultadoLeitura> {
  const entradas: Entrada[] = [];
  const ignorados: DocumentoIgnorado[] = [];
  const orcamento: Orcamento = { restante: TAMANHO_MAXIMO_TOTAL };

  for (const arquivo of arquivos) {
    // O tamanho do File é conhecido sem ler o conteúdo: nada grande demais chega à memória.
    const pareceZip = arquivo.name.toLowerCase().endsWith('.zip');
    if (arquivo.size > (pareceZip ? TAMANHO_MAXIMO_TOTAL : TAMANHO_MAXIMO_XML)) {
      ignorados.push(grandeDemais(arquivo.name, `Arquivo com mais de ${emMb(pareceZip ? TAMANHO_MAXIMO_TOTAL : TAMANHO_MAXIMO_XML)}.`));
      continue;
    }
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (ehZip(arquivo.name, bytes)) {
      abrirZip(arquivo.name, bytes, 0, orcamento, entradas, ignorados);
      continue;
    }
    if (bytes.length > orcamento.restante) {
      ignorados.push(grandeDemais(arquivo.name, `O total do envio passaria de ${emMb(TAMANHO_MAXIMO_TOTAL)}.`));
      continue;
    }
    orcamento.restante -= bytes.length;
    entradas.push({ nome: arquivo.name, bytes });
  }

  const documentos: Documento[] = [];
  const vistos = new Map<string, string>();
  for (const entrada of entradas) {
    let r: Documento | DocumentoIgnorado;
    try {
      r = lerDocumento(entrada);
    } catch (e) {
      // Um arquivo patológico (ex.: aninhamento que estoura a pilha) não pode derrubar o lote inteiro.
      const motivo = e instanceof Error ? e.message : String(e);
      r = { arquivo: entrada.nome, motivo: 'XML_INVALIDO', detalhe: `Não foi possível ler o arquivo (${motivo}).` };
    }
    if (!('chave' in r)) {
      ignorados.push(r);
    } else if (vistos.has(r.chave)) {
      ignorados.push({ arquivo: r.arquivo, motivo: 'DUPLICADO', detalhe: `Mesma chave de acesso de ${vistos.get(r.chave)}.` });
    } else {
      vistos.set(r.chave, r.arquivo);
      documentos.push(r);
    }
  }

  // Nota cancelada por evento presente no lote não é operação: sai da análise (o par é pela chave de acesso).
  const canceladaPor = new Map<string, string>();
  for (const i of ignorados) for (const chave of i.chavesCanceladas ?? []) canceladaPor.set(chave, i.arquivo);
  const validos = documentos.filter((d) => {
    const evento = canceladaPor.get(d.chave);
    if (evento) ignorados.push({ arquivo: d.arquivo, motivo: 'CANCELADA', detalhe: `Cancelada pelo evento em ${evento}.` });
    return !evento;
  });
  return { documentos: validos, ignorados };
}
