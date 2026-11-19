import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function bytesFixture(nome: string): Uint8Array {
  return new Uint8Array(readFileSync(join(import.meta.dirname, '__fixtures__', nome)));
}

export function arquivoFixture(nome: string, comoNome = nome): File {
  return new File([bytesFixture(nome) as BlobPart], comoNome);
}

export function xmlFixture(nome: string): Document {
  const texto = new TextDecoder('utf-8').decode(bytesFixture(nome));
  return new DOMParser().parseFromString(texto, 'application/xml');
}
