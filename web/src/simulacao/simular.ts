import Big from 'big.js';
import { saidaSemReceita } from '../dominio/cfop';
import { calc } from '../dominio/decimal';
import { participacaoPJ } from '../dominio/separar';
import type { Documento, TipoDocumento } from '../leitura/tipos';
import { emitidoAntesDoAnoSimulado } from '../motor/montarRequisicoes';
import { chaveItem, type AliquotasNominais, type ItemCalculado, type OrigemAliquotasNominais } from '../motor/tipos';
import type { AliquotasSimples } from '../regras/simples/aliquotaEfetiva';

/*
 * Comparação Simples (IBS/CBS dentro do DAS) × Simples com IBS/CBS por fora (regime regular desses
 * tributos). Fórmulas, dispositivos legais, premissas e limitações: ./FORMULAS.md. Valores em R$,
 * percentuais em pontos (10 = 10%), sem arredondamento (arredondar é papel da exibição).
 */

export type OrigemCompras =
  | { tipo: 'REAL'; creditos: Big; /** 'AAAA-MM' distintos da emissão das compras (divisor da média mensal dos créditos). */ meses: string[] }
  | {
      tipo: 'ESTIMADA';
      percentualSobreFaturamento: Big;
      /** cbs + ibsEstadual + ibsMunicipal, em pontos. */
      aliquotaNominalTotal: Big;
      /** De onde veio a alíquota nominal (só informativo, para o Resumo). */
      origemAliquota: OrigemAliquotasNominais;
    };

/** Atividade do Simples efetivamente usada (com receita incluída) e os tipos de nota em que foi usada. */
export interface AtividadeUsada {
  cAtivSN: string;
  tipos: TipoDocumento[];
  aliquotas: AliquotasSimples;
}

export interface ResultadoCenario {
  impostoMes: Big;
  creditoClientePJMes: Big;
}

export type Veredito = 'REGULAR_TENDE_MELHOR' | 'SIMPLES_TENDE_MELHOR' | 'DEPENDE_DOS_CLIENTES' | 'EMPATE';

export interface ResultadoSimulacao {
  /** 'AAAA-MM' reais da emissão (não levados a 2027) das vendas com ao menos um item incluído. */
  meses: string[];
  /** Só em compras REAL: 'AAAA-MM' da emissão das compras (divisor da média mensal dos créditos). */
  mesesCompras: string[];
  /** Compras REAL com meses diferentes dos das vendas: o Resumo avisa da conversão em média mensal. */
  periodoComprasDiferente: boolean;
  /** Créditos das compras por mês, já proporcionalizados (FORMULAS.md, item 5). */
  creditosMes: Big;
  /** Só em compras REAL: receita incluída ÷ receita de todos os itens de venda (fração dos créditos usada). */
  proporcaoCreditos?: Big;
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
  /** Itens de saída sem receita (CFOP de transferência/remessa, `dominio/cfop.ts`): fora do faturamento e de tudo mais. */
  itensSemReceita: number;
  /** Atividades do Simples com receita incluída, na ordem em que aparecem nas vendas. */
  atividades: AtividadeUsada[];
  /** Conjuntos distintos de alíquotas nominais usados no cenário por fora (com a origem de cada um). */
  aliquotasNominais: AliquotasNominais[];
  /** Só em compras ESTIMADA: os parâmetros da estimativa (Resumo, "Como chegamos aqui"). */
  estimativa?: Omit<Extract<OrigemCompras, { tipo: 'ESTIMADA' }>, 'tipo'>;
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
  let itensSemReceita = 0;
  const vendasIncluidas: Documento[] = [];
  const mesesIncluidos = new Set<string>();
  const atividades = new Map<string, AtividadeUsada>();
  const nominaisUsadas = new Map<string, AliquotasNominais>();

  for (const v of vendas) {
    const cAtivSN = atividadePorTipo[v.tipo];
    const aliquotas = cAtivSN ? aliquotasPorAtividade[cAtivSN] : undefined;
    const itens = v.itens.filter((it) => {
      if (saidaSemReceita(it.cfop)) {
        itensSemReceita++;
        return false;
      }
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
      const usada = atividades.get(cAtivSN!) ?? { cAtivSN: cAtivSN!, tipos: [], aliquotas };
      if (!usada.tipos.includes(v.tipo)) usada.tipos.push(v.tipo);
      atividades.set(cAtivSN!, usada);
      if (f.aliquotasNominais) {
        const n = f.aliquotasNominais;
        nominaisUsadas.set([n.cbs, n.ibsEstadual, n.ibsMunicipal, n.origem].join('|'), n);
      }
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
  // Créditos REAL vêm de todas as compras; só a fração da receita que entrou na comparação é usada, dividida pelos
  // meses das COMPRAS: o total é do período das compras, que pode ser diferente do das vendas.
  let mesesCompras: string[] = [];
  let proporcaoCreditos: Big | undefined;
  let creditosMes: Big;
  if (origemCompras.tipo === 'REAL') {
    mesesCompras = [...new Set(origemCompras.meses)].sort();
    proporcaoCreditos = Big(calc(receita).div(receitaTotal));
    const creditosProporcionais = Big(calc(origemCompras.creditos).times(receita).div(receitaTotal));
    creditosMes = mesesCompras.length === 0 ? Big(0) : porMes(creditosProporcionais, mesesCompras.length);
  } else {
    creditosMes = Big(pontos(pontos(faturamentoMes, origemCompras.percentualSobreFaturamento), origemCompras.aliquotaNominalTotal));
  }
  const periodoComprasDiferente = mesesCompras.length > 0 && mesesCompras.join() !== meses.join();

  const simples: ResultadoCenario = { impostoMes: porMes(dasCompleto, n), creditoClientePJMes: porMes(creditoPJDentro, n) };
  const regular: ResultadoCenario = {
    impostoMes: porMes(dasSemCbsIbs.plus(debitosPorFora), n).minus(creditosMes),
    creditoClientePJMes: porMes(creditoPJFora, n),
  };
  const diferencaMes = simples.impostoMes.minus(regular.impostoMes);

  return {
    meses,
    mesesCompras,
    periodoComprasDiferente,
    creditosMes,
    proporcaoCreditos,
    faturamentoMes,
    simples,
    regular,
    diferencaMes,
    veredito: decidir(diferencaMes, simples, regular),
    origemCompras: origemCompras.tipo,
    percentualPJ: participacaoPJ(vendasIncluidas).percentualPJ,
    notas2026Simuladas: vendas.some((v) => emitidoAntesDoAnoSimulado(v.emissao)),
    itensExcluidos,
    itensSemReceita,
    atividades: [...atividades.values()],
    ...(origemCompras.tipo === 'ESTIMADA'
      ? {
          estimativa: {
            percentualSobreFaturamento: origemCompras.percentualSobreFaturamento,
            aliquotaNominalTotal: origemCompras.aliquotaNominalTotal,
            origemAliquota: origemCompras.origemAliquota,
          },
        }
      : {}),
    aliquotasNominais: [...nominaisUsadas.values()],
  };
}
