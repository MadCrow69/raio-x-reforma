import Big from 'big.js';
import { calc } from '../dominio/decimal';
import { participacaoPJ } from '../dominio/separar';
import type { Documento, TipoDocumento } from '../leitura/tipos';
import { emitidoAntesDoAnoSimulado } from '../motor/montarRequisicoes';
import { chaveItem, type ItemCalculado } from '../motor/tipos';
import type { AliquotasSimples } from '../regras/simples/aliquotaEfetiva';

/*
 * Comparação Simples (IBS/CBS dentro do DAS) × Simples com IBS/CBS por fora (regime regular desses
 * tributos). Fórmulas, dispositivos legais, premissas e limitações: ./FORMULAS.md. Valores em R$,
 * percentuais em pontos (10 = 10%), sem arredondamento (arredondar é papel da exibição).
 */

export type OrigemCompras =
  | { tipo: 'REAL'; creditos: Big }
  | { tipo: 'ESTIMADA'; percentualSobreFaturamento: Big; aliquotaNominalTotal: Big /* cbs+ibsEstadual+ibsMunicipal, em pontos */ };

export interface ResultadoCenario {
  impostoMes: Big;
  creditoClientePJMes: Big;
}

export type Veredito = 'REGULAR_TENDE_MELHOR' | 'SIMPLES_TENDE_MELHOR' | 'DEPENDE_DOS_CLIENTES' | 'EMPATE';

export interface ResultadoSimulacao {
  /** 'AAAA-MM' reais da emissão (não levados a 2027) das vendas com ao menos um item incluído. */
  meses: string[];
  faturamentoMes: Big;
  simples: ResultadoCenario;
  /** `impostoMes` pode ser negativo: créditos de compras maiores que os débitos (saldo credor). */
  regular: ResultadoCenario;
  /** simples.impostoMes − regular.impostoMes (positivo = regular mais barato). */
  diferencaMes: Big;
  veredito: Veredito;
  origemCompras: 'REAL' | 'ESTIMADA';
  percentualPJ: Big;
  notas2026Simuladas: boolean;
  /** Itens de venda fora da comparação: sem atividade/alíquota ou não CALCULO_SIMULADO nos dois cenários. */
  itensExcluidos: number;
}

export interface EntradaSimulacao {
  vendas: Documento[];
  /** Não lido aqui: os créditos `REAL` chegam já somados em `origemCompras.creditos` (FORMULAS.md, item 5). */
  compras: Documento[];
  /** Cenário SIMPLES_POR_DENTRO (motor do Simples). */
  porDentro: ItemCalculado[];
  /** Cenário SIMPLES_POR_FORA (motor do regime regular). */
  porFora: ItemCalculado[];
  /** cAtivSN de cada tipo de documento (mesmo parâmetro do cálculo do motor). */
  atividadePorTipo: Partial<Record<TipoDocumento, string>>;
  aliquotasPorAtividade: Record<string, AliquotasSimples>;
  origemCompras: OrigemCompras;
}

/** Diferença abaixo deste percentual (em pontos) do imposto do Simples = empate. */
export const EMPATE_PERCENTUAL = Big('0.5');

const total = (c: ItemCalculado) => c.vCBS.plus(c.vIBSUF).plus(c.vIBSMun);
const pontos = (v: Big, percentual: Big) => calc(v).times(percentual).div(100);
const porMes = (v: Big, meses: number) => Big(calc(v).div(meses));

function decidir(diferencaMes: Big, simples: ResultadoCenario, regular: ResultadoCenario): Veredito {
  const limite = pontos(simples.impostoMes, EMPATE_PERCENTUAL);
  if (diferencaMes.eq(0) || diferencaMes.abs().lt(limite)) return 'EMPATE';
  const diferencaCredito = regular.creditoClientePJMes.minus(simples.creditoClientePJMes);
  if (diferencaMes.gt(0)) return diferencaCredito.lt(0) ? 'DEPENDE_DOS_CLIENTES' : 'REGULAR_TENDE_MELHOR';
  return diferencaCredito.gt(0) ? 'DEPENDE_DOS_CLIENTES' : 'SIMPLES_TENDE_MELHOR';
}

export function simular(entrada: EntradaSimulacao): ResultadoSimulacao {
  const { vendas, porDentro, porFora, atividadePorTipo, aliquotasPorAtividade, origemCompras } = entrada;
  if (vendas.length === 0) throw new RangeError('Não há notas de venda para simular: sem mês para calcular a média mensal.');

  const dentro = new Map(porDentro.map((c) => [chaveItem(c.chave, c.numero), c]));
  const fora = new Map(porFora.map((c) => [chaveItem(c.chave, c.numero), c]));

  let receita = Big(0);
  let receitaTotal = Big(0);
  let dasCompleto = Big(0);
  let dasSemCbsIbs = Big(0);
  let debitosPorFora = Big(0);
  let creditoPJDentro = Big(0);
  let creditoPJFora = Big(0);
  let itensExcluidos = 0;
  const vendasIncluidas: Documento[] = [];
  const mesesIncluidos = new Set<string>();

  for (const v of vendas) {
    const cAtivSN = atividadePorTipo[v.tipo];
    const aliquotas = cAtivSN ? aliquotasPorAtividade[cAtivSN] : undefined;
    const itens = v.itens.filter((it) => {
      receitaTotal = receitaTotal.plus(it.baseCalculo);
      const d = dentro.get(chaveItem(v.chave, it.numero));
      const f = fora.get(chaveItem(v.chave, it.numero));
      // `!aliquotas` é caminho defensivo, inalcançável pela interface: Confirmar só libera "Calcular" quando todo tipo de
      // nota presente nas vendas tem atividade (e alíquota) resolvida (ver o teste de Confirmar). Por isso o atalho "Ver na
      // Auditoria" dos excluídos bate com `itensExcluidos`.
      if (!aliquotas || d?.estado !== 'CALCULO_SIMULADO' || f?.estado !== 'CALCULO_SIMULADO') {
        itensExcluidos++;
        return false;
      }
      receita = receita.plus(it.baseCalculo);
      dasCompleto = dasCompleto.plus(pontos(it.baseCalculo, aliquotas.efetivaTotal));
      dasSemCbsIbs = dasSemCbsIbs.plus(pontos(it.baseCalculo, aliquotas.dasSemCbsIbs));
      debitosPorFora = debitosPorFora.plus(total(f));
      if (v.destinatario?.tipo === 'PJ') {
        creditoPJDentro = creditoPJDentro.plus(total(d));
        creditoPJFora = creditoPJFora.plus(total(f));
      }
      return true;
    });
    vendasIncluidas.push({ ...v, itens });
    // Mês real da emissão: levar a 2027 juntaria meses iguais de anos diferentes (nov/2025 e nov/2026).
    if (itens.length > 0) mesesIncluidos.add(v.emissao.slice(0, 7));
  }
  if (receita.eq(0)) throw new RangeError('Nenhum item foi calculado nos dois cenários; não há base para comparar.');

  const meses = [...mesesIncluidos].sort();
  const n = meses.length;
  const faturamentoMes = porMes(receita, n);
  // Créditos REAL vêm de todas as compras; só a fração da receita que entrou na comparação é usada.
  const creditosMes =
    origemCompras.tipo === 'REAL'
      ? porMes(Big(calc(origemCompras.creditos).times(receita).div(receitaTotal)), n)
      : Big(pontos(pontos(faturamentoMes, origemCompras.percentualSobreFaturamento), origemCompras.aliquotaNominalTotal));

  const simples: ResultadoCenario = { impostoMes: porMes(dasCompleto, n), creditoClientePJMes: porMes(creditoPJDentro, n) };
  const regular: ResultadoCenario = {
    impostoMes: porMes(dasSemCbsIbs.plus(debitosPorFora), n).minus(creditosMes),
    creditoClientePJMes: porMes(creditoPJFora, n),
  };
  const diferencaMes = simples.impostoMes.minus(regular.impostoMes);

  return {
    meses,
    faturamentoMes,
    simples,
    regular,
    diferencaMes,
    veredito: decidir(diferencaMes, simples, regular),
    origemCompras: origemCompras.tipo,
    percentualPJ: participacaoPJ(vendasIncluidas).percentualPJ,
    notas2026Simuladas: vendas.some((v) => emitidoAntesDoAnoSimulado(v.emissao)),
    itensExcluidos,
  };
}
