import Big from 'big.js';

/**
 * Casas decimais das divisões das regras próprias (alíquota efetiva, simulação), independente do
 * Big.DP global. 40 casas: divisões por RBT12 ou por número de meses podem não terminar; o erro fica
 * abaixo de 1e-38. Nada é arredondado aqui — arredondar é papel da exibição.
 */
export const CASAS_DIVISAO = 40;

const BigCalc = Big();
BigCalc.DP = CASAS_DIVISAO;

/** Cópia de `v` num construtor cujas divisões usam CASAS_DIVISAO casas. */
export const calc = (v: Big | number | string) => new BigCalc(v);
