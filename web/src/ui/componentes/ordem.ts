/** Ordenação de tabela: coluna e sentido. Genérico no id da coluna (arquivo separado: o componente só exporta componente). */
export interface OrdemTabela<C extends string = string> {
  coluna: C;
  direcao: 'asc' | 'desc';
}

/** Primeiro clique: crescente; segundo na mesma coluna: decrescente; coluna nova volta a crescente. */
export function proximaOrdem<C extends string>(atual: OrdemTabela<C> | null, coluna: C): OrdemTabela<C> {
  return atual?.coluna === coluna && atual.direcao === 'asc' ? { coluna, direcao: 'desc' } : { coluna, direcao: 'asc' };
}
