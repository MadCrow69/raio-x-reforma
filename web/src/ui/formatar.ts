/** Formatação de texto para a interface (pt-BR). */

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
