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

/** Meses 'AAAA-MM' (em qualquer ordem): "mar/2026", "mar–mai/2026" (mesmo ano) ou "nov/2025–fev/2026". */
export function formatarMeses(meses: string[]): string {
  if (meses.length === 0) return '';
  const ordenados = [...meses].sort();
  const [primeiro, ultimo] = [ordenados[0], ordenados[ordenados.length - 1]];
  if (primeiro === ultimo) return mesAno(primeiro);
  if (primeiro.slice(0, 4) === ultimo.slice(0, 4)) return `${MESES[Number(primeiro.slice(5, 7)) - 1]}–${mesAno(ultimo)}`;
  return `${mesAno(primeiro)}–${mesAno(ultimo)}`;
}

/** CNPJ (numérico ou alfanumérico) de 14 caracteres → "11.222.333/0001-81"; outro tamanho volta como veio. */
export function formatarCnpj(cnpj: string): string {
  const c = cnpj.toUpperCase();
  if (!/^[0-9A-Z]{14}$/.test(c)) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** Período das datas ISO (com ou sem hora): "mar/2026" ou "mar/2026 a mai/2026"; vazio sem datas. */
export function formatarPeriodo(datasIso: string[]): string {
  if (datasIso.length === 0) return '';
  const meses = datasIso.map((d) => d.slice(0, 7)).sort();
  const [primeiro, ultimo] = [meses[0], meses[meses.length - 1]];
  return primeiro === ultimo ? mesAno(primeiro) : `${mesAno(primeiro)} a ${mesAno(ultimo)}`;
}

/** Big → "1.234,50" (2 casas, arredonda meio para cima como o Big; o sinal acompanha o valor). */
export function formatarNumeroBR(v: Big): string {
  const [inteiro, decimais] = v.toFixed(2).split('.');
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimais}`;
}

/** Pontos percentuais → "8,8%", "0,05%", "7,33%": até `casas` decimais, sem zeros à direita. */
export function formatarPercentual(v: Big, casas = 2): string {
  const [inteiro, decimais = ''] = v.round(casas).toFixed(casas).split('.');
  const resto = decimais.replace(/0+$/, '');
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${resto ? `,${resto}` : ''}%`;
}

/** Big → "R$ 1.234,50"; negativo → "-R$ 1.234,50" (zero arredondado não leva sinal). */
export const formatarMoeda = (v: Big): string =>
  v.round(2).lt(0) ? `-R$ ${formatarNumeroBR(v.abs())}` : `R$ ${formatarNumeroBR(v.abs())}`;

/**
 * Texto digitado em pt-BR ("R$ 3.600.000,00", "3600000", "12,5") → Big; null se vazio ou inválido.
 * Ponto só vale como separador de milhar em agrupamento correto (1.234.567); "1234.56" é inválido
 * (seria lido como 123.456, erro de 100×). Vírgula é o decimal (até 2 casas). Sem sinal.
 */
export function parseNumeroBR(texto: string): Big | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpo) && !/^\d+(,\d{1,2})?$/.test(limpo)) return null;
  return new Big(limpo.replace(/\./g, '').replace(',', '.'));
}
