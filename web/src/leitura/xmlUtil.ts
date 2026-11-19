import Big from 'big.js';
import type { Parte } from './tipos.ts';

/** Erro de layout/valor: vira XML_INVALIDO no chamador. */
export class ErroLeitura extends Error {}

/** Decodifica bytes de XML: remove BOM e usa o encoding declarado no prólogo (padrão UTF-8). */
export function decodificarXml(bytes: Uint8Array): string {
  let inicio = 0;
  let encoding = 'utf-8';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    inicio = 3;
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  const corpo = bytes.subarray(inicio);
  const prologo = new TextDecoder('latin1').decode(corpo.subarray(0, 200));
  const m = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(prologo);
  if (m) encoding = m[1].toLowerCase();
  try {
    return new TextDecoder(encoding).decode(corpo);
  } catch {
    return new TextDecoder('utf-8').decode(corpo);
  }
}

export function parseXml(texto: string): Document | null {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  const raiz = doc.documentElement;
  if (!raiz || raiz.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

/** Filhos diretos com o localName informado (ignora namespace). */
export function filhos(el: Element | null | undefined, nome: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => c.localName === nome);
}

export function filho(el: Element | null | undefined, ...caminho: string[]): Element | undefined {
  let atual: Element | undefined = el ?? undefined;
  for (const nome of caminho) {
    atual = filhos(atual, nome)[0];
    if (!atual) return undefined;
  }
  return atual;
}

/** Primeiro descendente (busca em profundidade) com o localName informado. */
export function descendente(el: Element | null | undefined, nome: string): Element | undefined {
  if (!el) return undefined;
  for (const c of Array.from(el.children)) {
    if (c.localName === nome) return c;
    const r = descendente(c, nome);
    if (r) return r;
  }
  return undefined;
}

export function texto(el: Element | undefined, ...caminho: string[]): string | undefined {
  const t = filho(el, ...caminho)?.textContent?.trim();
  return t ? t : undefined;
}

export function valor(el: Element | undefined, ...caminho: string[]): Big {
  const t = texto(el, ...caminho);
  if (t === undefined) return new Big(0);
  try {
    return new Big(t);
  } catch {
    throw new ErroLeitura(`Valor numérico inválido em <${caminho.join('/')}>: "${t}".`);
  }
}

/** Monta Parte a partir de emit/dest/toma (CNPJ → PJ, CPF → PF, idEstrangeiro/NIF → ESTRANGEIRO). */
export function lerParte(el: Element | undefined, endereco: Element | undefined): Parte | undefined {
  if (!el) return undefined;
  let documento: string | undefined;
  let tipo: Parte['tipo'] | undefined;
  const cnpj = texto(el, 'CNPJ');
  const cpf = texto(el, 'CPF');
  const estr = texto(el, 'idEstrangeiro') ?? texto(el, 'NIF');
  if (cnpj) [documento, tipo] = [cnpj, 'PJ'];
  else if (cpf) [documento, tipo] = [cpf, 'PF'];
  else if (estr) [documento, tipo] = [estr, 'ESTRANGEIRO'];
  if (!documento || !tipo) return undefined;
  return { documento, tipo, municipioIbge: texto(endereco, 'cMun'), uf: texto(endereco, 'UF') };
}
