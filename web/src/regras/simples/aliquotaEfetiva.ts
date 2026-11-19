import Big from 'big.js';
import dados from './anexos-2027.json';

/**
 * Alíquota efetiva do Simples Nacional e parcelas de CBS e IBS (pCBSSN/pIBSSN) para 2027–2028.
 * Fontes e regras transcritas: ./FONTES.md. Percentuais em pontos (4.00 = 4%), sem arredondamento
 * (arredondar é papel da exibição).
 */

export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V';

/** Teto de 5% do ISS na 5ª faixa (nota (*) dos Anexos III e IV). */
export interface TetoIss {
  aliquotaEfetivaAcimaDe: Big;
  issFixo: Big;
  /** Percentuais aplicados sobre (efetiva − issFixo). */
  reparticaoDoExcedente: Record<string, Big>;
}

export interface Faixa {
  ate: Big;
  aliquotaNominal: Big;
  parcelaDeduzir: Big;
  /** Inclui sempre as chaves 'CBS' e 'IBS' ('-' na tabela oficial = 0). */
  reparticao: Record<string, Big>;
  tetoIss?: TetoIss;
}

export interface TabelaAnexo {
  fonte: string;
  vigencia: { inicio: string; fim: string };
  faixas: Faixa[];
}

/** Percentuais em pontos (ex.: 2.75). */
export interface AliquotasSimples {
  anexo: Anexo;
  faixa: number;
  efetivaTotal: Big;
  pCBSSN: Big;
  pIBSSN: Big;
  dasSemCbsIbs: Big;
}

export type ErroRbt12 = 'RBT12_INVALIDO' | 'ACIMA_LIMITE_SIMPLES';

/** Sublimite de ICMS, ISS e IBS (LC 123, art. 13-A, art. 19; Res. CGSN 140, art. 9º). */
export const SUBLIMITE = Big(3_600_000);
/** Limite de receita bruta da EPP (LC 123, art. 3º, II). */
export const LIMITE_SIMPLES = Big(4_800_000);
/** Fator R mínimo para o anexo "com Fator R" (LC 123, art. 18, §§ 5º-J e 5º-M). */
const FATOR_R_MINIMO = Big('0.28');

/**
 * Tributos cuja parcela, na 6ª faixa, é calculada pela fórmula da 5ª faixa, para a parcela de receita
 * que não exceder o sublimite (Res. CGSN 140/2018, art. 21, IV, na redação da Res. CGSN 190/2026).
 */
const TRIBUTOS_DO_SUBLIMITE = ['ICMS', 'ISS', 'IBS'] as const;

/**
 * Percentual efetivo máximo do ISS, em pontos: LC 123/2006, art. 18, § 1º-B, I (redação da LC 214/2025,
 * art. 517, e da LC 227/2026) e Res. CGSN 140/2018, art. 21, III (redação da Res. CGSN 190/2026):
 * "o percentual efetivo máximo destinado ao ISS será de 5%, e eventual diferença será transferida, de
 * forma proporcional, aos tributos federais e IBS da mesma faixa de receita bruta anual".
 */
const ISS_MAXIMO = Big(5);

/**
 * Construtor com casas decimais próprias para as divisões deste módulo, independente do Big.DP
 * global. 40 casas: as divisões por RBT12 podem não terminar; o erro fica abaixo de 1e-38 ponto.
 */
const BigCalc = Big();
BigCalc.DP = 40;
const calc = (v: Big) => new BigCalc(v);

const ANEXOS: readonly Anexo[] = ['I', 'II', 'III', 'IV', 'V'];

type ReparticaoBruta = Record<string, string>;
interface FaixaBruta {
  ate: string;
  aliquotaNominal: string;
  parcelaDeduzir: string;
  reparticao: ReparticaoBruta;
  tetoIss?: { aliquotaEfetivaAcimaDe: string; issFixo: string; reparticaoDoExcedente: ReparticaoBruta };
}
interface AnexoBruto {
  fonte: string;
  vigencia: { inicio: string; fim: string };
  faixas: FaixaBruta[];
}

function paraBig(r: ReparticaoBruta): Record<string, Big> {
  const out: Record<string, Big> = {};
  for (const [k, v] of Object.entries(r)) out[k] = Big(v);
  return out;
}

function carregar(bruto: AnexoBruto): TabelaAnexo {
  return {
    fonte: bruto.fonte,
    vigencia: bruto.vigencia,
    faixas: bruto.faixas.map((f) => ({
      ate: Big(f.ate),
      aliquotaNominal: Big(f.aliquotaNominal),
      parcelaDeduzir: Big(f.parcelaDeduzir),
      reparticao: { CBS: Big(0), IBS: Big(0), ...paraBig(f.reparticao) },
      tetoIss: f.tetoIss && {
        aliquotaEfetivaAcimaDe: Big(f.tetoIss.aliquotaEfetivaAcimaDe),
        issFixo: Big(f.tetoIss.issFixo),
        reparticaoDoExcedente: paraBig(f.tetoIss.reparticaoDoExcedente),
      },
    })),
  };
}

const brutos = dados as Record<Anexo, AnexoBruto>;
export const ANEXOS_2027: Readonly<Record<Anexo, TabelaAnexo>> = Object.fromEntries(
  ANEXOS.map((a) => [a, carregar(brutos[a])]),
) as Record<Anexo, TabelaAnexo>;

/** [(RBT12 × nominal) − PD] / RBT12, em pontos: nominal − PD × 100 / RBT12. */
function efetiva(rbt12: Big, f: Faixa): Big {
  return calc(f.parcelaDeduzir).times(100).div(rbt12).times(-1).plus(f.aliquotaNominal);
}

/** Percentual efetivo de cada tributo numa faixa 1–5, com o teto de ISS quando houver. */
function percentuaisDaFaixa(ef: Big, f: Faixa): Record<string, Big> {
  const out: Record<string, Big> = {};
  if (f.tetoIss && ef.gt(f.tetoIss.aliquotaEfetivaAcimaDe)) {
    const excedente = ef.minus(f.tetoIss.issFixo);
    for (const [t, p] of Object.entries(f.tetoIss.reparticaoDoExcedente)) out[t] = calc(excedente).times(p).div(100);
    out.ISS = f.tetoIss.issFixo;
    return out;
  }
  for (const [t, p] of Object.entries(f.reparticao)) out[t] = calc(ef).times(p).div(100);
  return out;
}

/**
 * Teto de 5% do ISS na 6ª faixa (ISS calculado pela fórmula da 5ª faixa, art. 21, IV). Se passar de
 * 5 pontos, o ISS fica em 5 e o excedente vai aos tributos federais da 6ª faixa e ao IBS,
 * proporcionalmente aos percentuais de repartição de cada um (federais: os da 6ª faixa; IBS: o da
 * 5ª faixa, que é o usado para o IBS na 6ª). Base: ISS_MAXIMO. INTERPRETAÇÃO pendente de ratificação
 * humana: a nota da 6ª faixa da Res. CGSN 190 traz a fórmula do ISS sem o teto (ver FONTES.md).
 */
function limitarIssNaSextaFaixa(percentuais: Record<string, Big>, sexta: Faixa, quinta: Faixa): void {
  const iss = percentuais.ISS;
  if (!iss || iss.lte(ISS_MAXIMO)) return;
  const pesos: Record<string, Big> = {};
  for (const [t, p] of Object.entries(sexta.reparticao)) if (!p.eq(0) && t !== 'IBS') pesos[t] = p;
  if (!quinta.reparticao.IBS.eq(0)) pesos.IBS = quinta.reparticao.IBS;
  const somaPesos = Object.values(pesos).reduce((a, b) => a.plus(b), Big(0));
  const excedente = calc(iss).minus(ISS_MAXIMO);
  for (const [t, p] of Object.entries(pesos)) {
    percentuais[t] = (percentuais[t] ?? Big(0)).plus(excedente.times(p).div(somaPesos));
  }
  percentuais.ISS = ISS_MAXIMO;
}

/** Percentual efetivo (pontos) de cada tributo, já com o teto de ISS; soma = efetiva total. */
export interface PercentuaisPorTributo {
  faixa: number;
  percentuais: Record<string, Big>;
}

export function percentuaisPorTributo(anexo: Anexo, rbt12: Big): PercentuaisPorTributo | { erro: ErroRbt12 } {
  if (rbt12.lte(0)) return { erro: 'RBT12_INVALIDO' };
  if (rbt12.gt(LIMITE_SIMPLES)) return { erro: 'ACIMA_LIMITE_SIMPLES' };

  const faixas = ANEXOS_2027[anexo].faixas;
  const indice = faixas.findIndex((f) => rbt12.lte(f.ate));
  const faixa = faixas[indice];
  const ef = efetiva(rbt12, faixa);

  let percentuais: Record<string, Big>;
  if (faixa.ate.gt(SUBLIMITE)) {
    // 6ª faixa: tributos federais pela própria faixa; ICMS, ISS e IBS pela fórmula da 5ª faixa
    // (Res. CGSN 140, art. 21, IV), com o teto de 5% do ISS (art. 21, III).
    const quinta = faixas[indice - 1];
    const ef5 = efetiva(rbt12, quinta);
    percentuais = percentuaisDaFaixa(ef, faixa);
    for (const t of TRIBUTOS_DO_SUBLIMITE) {
      const p = quinta.reparticao[t];
      if (p && !p.eq(0)) percentuais[t] = calc(ef5).times(p).div(100);
    }
    limitarIssNaSextaFaixa(percentuais, faixa, quinta);
  } else {
    percentuais = percentuaisDaFaixa(ef, faixa);
  }

  // Big(...) devolve tudo no construtor global (BigCalc é só para as divisões internas).
  const out: Record<string, Big> = {};
  for (const [t, v] of Object.entries(percentuais)) out[t] = Big(v);
  return { faixa: indice + 1, percentuais: out };
}

export function aliquotasSimples(anexo: Anexo, rbt12: Big): AliquotasSimples | { erro: ErroRbt12 } {
  const r = percentuaisPorTributo(anexo, rbt12);
  if ('erro' in r) return r;
  const efetivaTotal = Object.values(r.percentuais).reduce((a, b) => a.plus(b), Big(0));
  const pCBSSN = r.percentuais.CBS ?? Big(0);
  const pIBSSN = r.percentuais.IBS ?? Big(0);
  return {
    anexo,
    faixa: r.faixa,
    efetivaTotal,
    pCBSSN,
    pIBSSN,
    dasSemCbsIbs: efetivaTotal.minus(pCBSSN).minus(pIBSSN),
  };
}

/** Anexo pela razão folha de salários (12 meses) / RBT12: r ≥ 28% → anexo com Fator R. */
export function anexoPorFatorR(anexoSemFatorR: Anexo, anexoComFatorR: Anexo, folha12: Big, rbt12: Big): Anexo {
  if (rbt12.lte(0)) throw new RangeError('O RBT12 precisa ser maior que zero para calcular o Fator R.');
  if (folha12.lt(0)) throw new RangeError('A folha de salários não pode ser negativa.');
  // folha12 / rbt12 ≥ 0,28  ⇔  folha12 ≥ 0,28 × rbt12 (rbt12 > 0), sem divisão.
  return folha12.gte(rbt12.times(FATOR_R_MINIMO)) ? anexoComFatorR : anexoSemFatorR;
}
