import type { GrupoClassificacao, OpcaoClassificacao } from '../classificacao/sugestoes';

/** Escolha vigente do grupo: a trocada pela pessoa (chave do grupo → cClassTrib) ou, sem troca, a sugerida. */
export function opcaoEscolhida(grupo: GrupoClassificacao, trocas: Record<string, string>): OpcaoClassificacao {
  const troca = trocas[grupo.chave];
  return (troca && grupo.opcoes.find((o) => o.cClassTrib === troca)) || grupo.sugerida;
}
