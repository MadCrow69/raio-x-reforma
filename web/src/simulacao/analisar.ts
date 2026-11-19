import { auditar, type LinhaAuditoria } from '../auditoria/auditar';
import type { Documento } from '../leitura/tipos';
import { calcular as calcularNoMotor } from '../motor/cliente';
import type { ItemCalculado, ParametrosCalculo } from '../motor/tipos';
import { somarCreditosCompras } from './creditosCompras';
import { simular, type OrigemCompras, type ResultadoSimulacao } from './simular';

/** Os motores não responderam para nenhum item de uma rodada (rede, servidor fora do ar). */
export class FalhaDoMotor extends Error {
  constructor(mensagem = 'Não foi possível consultar os motores de cálculo. Verifique sua conexão e tente de novo.') {
    super(mensagem);
    this.name = 'FalhaDoMotor';
  }
}

export interface EntradaAnalise {
  vendas: Documento[];
  compras: Documento[];
  parametros: ParametrosCalculo;
  /** Vinda do passo 2; em `REAL`, `creditos` chega zerado e é preenchido aqui com a soma das compras. */
  origemCompras: OrigemCompras;
}

export interface ResultadoAnalise {
  auditoria: LinhaAuditoria[];
  simulacao: ResultadoSimulacao;
  /** Só em compras REAL: itens de compra sem crédito calculável (crédito possivelmente subestimado). */
  comprasSemCredito: number;
}

type Calcular = typeof calcularNoMotor;

/** Alguma atividade efetivamente usada nas vendas está na 6ª faixa do Simples (pede a nota de interpretação). */
export function usaSextaFaixa({ atividadePorTipo, aliquotasSimples }: ParametrosCalculo): boolean {
  return Object.values(atividadePorTipo).some((cod) => cod !== undefined && aliquotasSimples[cod]?.faixa === 6);
}

/**
 * Único lugar que orquestra o passo 3: calcula as vendas nos dois cenários do Simples e as compras
 * no regime regular (se houver), audita e simula. As rodadas são sequenciais para respeitar o
 * limite de concorrência do cliente. `aoProgredir(feitos, total)` conta documentos de todas as
 * rodadas (total = vendas × 2 + compras). Lança `FalhaDoMotor` se uma rodada inteira falhar
 * tecnicamente e deixa passar o `RangeError` do `simular` (falta de base para comparar).
 */
export async function analisar(
  { vendas, compras, parametros, origemCompras }: EntradaAnalise,
  aoProgredir?: (feitos: number, total: number) => void,
  calcular: Calcular = calcularNoMotor,
): Promise<ResultadoAnalise> {
  const total = vendas.length * 2 + compras.length;
  let concluidos = 0;
  aoProgredir?.(0, total);

  const rodada = async (docs: Documento[], cenario: Parameters<Calcular>[1]): Promise<ItemCalculado[]> => {
    const base = concluidos;
    const itens = await calcular(docs, cenario, parametros, (feitos) => aoProgredir?.(base + feitos, total));
    concluidos = base + docs.length;
    if (itens.length > 0 && itens.every((i) => i.estado === 'FALHA_TECNICA')) throw new FalhaDoMotor();
    return itens;
  };

  const porDentro = await rodada(vendas, 'SIMPLES_POR_DENTRO');
  const porFora = await rodada(vendas, 'SIMPLES_POR_FORA');
  const comprasCalculadas = compras.length > 0 ? await rodada(compras, 'REGULAR_AUDITORIA') : [];

  const somados = origemCompras.tipo === 'REAL' ? somarCreditosCompras(compras, comprasCalculadas) : null;
  const origem: OrigemCompras = somados ? { tipo: 'REAL', creditos: somados.creditos } : origemCompras;

  const simulacao = simular({
    vendas,
    compras,
    porDentro,
    porFora,
    atividadePorTipo: parametros.atividadePorTipo,
    aliquotasPorAtividade: parametros.aliquotasSimples,
    origemCompras: origem,
  });
  const auditoria = auditar(vendas, compras, [...porDentro, ...comprasCalculadas], parametros.classificacoes);
  return { auditoria, simulacao, comprasSemCredito: somados?.itensSemCredito ?? 0 };
}
