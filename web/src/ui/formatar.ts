import Big from 'big.js';

/** Formatação e leitura de texto para a interface (pt-BR). Valores monetários sempre em Big, nunca number. */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "1 nota lida" / "3 notas lidas". */
export function contar(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? singular : plural}`;
}

/** 'AAAA-MM…' → "mar/2026". */
function mesAno(iso: string): string {
  return `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
}

/** Período das datas ISO (com ou sem hora): "mar/2026" ou "mar/2026 a mai/2026"; vazio sem datas. */
export function formatarPeriodo(datasIso: string[]): string {
  if (datasIso.length === 0) return '';
  const meses = datasIso.map((d) => d.slice(0, 7)).sort();
  const [primeiro, ultimo] = [meses[0], meses[meses.length - 1]];
  return primeiro === ultimo ? mesAno(primeiro) : `${mesAno(primeiro)} a ${mesAno(ultimo)}`;
}

/** Big → "1.234,50" (2 casas, arredonda meio para cima como o Big). */
export function formatarNumeroBR(v: Big): string {
  const [inteiro, decimais] = v.toFixed(2).split('.');
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimais}`;
}

/** Big → "R$ 1.234,50". */
export const formatarMoeda = (v: Big): string => `R$ ${formatarNumeroBR(v)}`;

/**
 * Texto digitado em pt-BR ("R$ 3.600.000,00", "3600000", "12,5") → Big; null se vazio ou inválido.
 * Ponto é separador de milhar; vírgula, o decimal (até 2 casas). Sem sinal.
 */
export function parseNumeroBR(texto: string): Big | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '');
  if (limpo === '') return null;
  const normal = limpo.replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(normal) ? new Big(normal) : null;
}
