/** ids que ligam aba e painel do Segmentado no modo `abas` (arquivo separado: o componente só exporta componente). */

/** id da aba `valor` — use no `aria-labelledby` do painel. */
export const idAba = (idBase: string, valor: string) => `${idBase}-aba-${valor}`;

/** id do painel da aba `valor` — use no `id` do painel (`role="tabpanel"`). */
export const idPainel = (idBase: string, valor: string) => `${idBase}-painel-${valor}`;
