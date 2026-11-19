/**
 * CNPJ numérico e alfanumérico (em vigor desde jul/2026).
 * DV oficial: módulo 11, valor do caractere = código ASCII − 48 (0-9 → 0-9, A → 17 … Z → 42),
 * pesos 2..9 cíclicos da direita para a esquerda; resto 0 ou 1 → DV 0, senão 11 − resto.
 * Fonte: Receita Federal, "CNPJ Alfanumérico – Perguntas e Respostas"
 * https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf
 * (exemplo oficial: 12.ABC.345/01DE-35). CNPJ numérico é subconjunto: mesmo algoritmo clássico.
 */

export function normalizarCnpj(valor: string): string {
  return valor.replace(/[.\/\-\s]/g, '').toUpperCase();
}

function calcularDv(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(cnpj: string): boolean {
  const c = normalizarCnpj(cnpj);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false;
  const dv1 = calcularDv(c.slice(0, 12));
  const dv2 = calcularDv(c.slice(0, 12) + dv1);
  return c.slice(12) === `${dv1}${dv2}`;
}
