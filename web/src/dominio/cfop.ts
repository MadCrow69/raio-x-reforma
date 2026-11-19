/**
 * CFOP de saída que não é receita de venda: o item sai da nota da empresa, mas não entra no faturamento.
 *
 * Fonte: tabela de CFOP do Anexo do Convênio s/nº, de 15/12/1970 (SINIEF), na redação do Ajuste SINIEF 07/01
 * (efeitos a partir de 01/01/2003), conferida em https://www.confaz.fazenda.gov.br/legislacao/ajustes/2001/AJ_007_01:
 *  - grupos 5.150 / 6.150 "TRANSFERÊNCIAS DE PRODUÇÃO PRÓPRIA OU DE TERCEIROS" (5.151, 5.152, 5.155, 5.156…):
 *    remessa para outro estabelecimento da mesma empresa, sem venda;
 *  - grupos 5.900 / 6.900 / 7.900 "OUTRAS SAÍDAS DE MERCADORIAS OU PRESTAÇÕES DE SERVIÇOS": remessas (bonificação,
 *    brinde, amostra, demonstração, conserto, comodato, depósito…), retornos e o "simples faturamento" de venda para
 *    entrega futura (5.922; a receita vem na nota da entrega, 5.116/5.117).
 *
 * Exceção: x.933 "Prestação de serviço tributado pelo ISSQN" (incluído pelo Ajuste SINIEF 03/04, efeitos a partir de
 * 01/01/2005; redação do Ajuste SINIEF 06/05) é receita de serviço numa NF-e conjugada, apesar de estar no grupo 900.
 *
 * NFS-e não tem CFOP: os itens dela são sempre receita.
 */

/** Grupos (3 primeiros dígitos, sem o 1º) de saída sem receita: x.15x (transferência) e x.9xx (outras saídas). */
const PREFIXOS_SEM_RECEITA = ['15', '9'] as const;
/** Códigos dentro dos grupos acima que são receita (sem o dígito da origem/destino). */
const EXCECOES_COM_RECEITA = ['933'] as const;
/** 1º dígito dos CFOP de saída: 5 (estadual), 6 (interestadual), 7 (exterior). */
const PRIMEIRO_DIGITO_SAIDA = ['5', '6', '7'] as const;

/** O item de saída com este CFOP não é receita (transferência, remessa ou outra saída)? CFOP ausente → é receita. */
export function saidaSemReceita(cfop: string | undefined): boolean {
  const c = cfop?.replace(/\D/g, '') ?? '';
  if (c.length !== 4 || !(PRIMEIRO_DIGITO_SAIDA as readonly string[]).includes(c[0])) return false;
  const resto = c.slice(1);
  if ((EXCECOES_COM_RECEITA as readonly string[]).includes(resto)) return false;
  return PREFIXOS_SEM_RECEITA.some((p) => resto.startsWith(p));
}
