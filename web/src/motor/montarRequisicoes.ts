import Big from 'big.js';
import { identificarGrupo } from '../classificacao/sugestoes';
import type { Documento, ItemDocumento } from '../leitura/tipos';
import type { AliquotasNominais, Cenario, ErroMotor, ItemCalculado, ParametrosCalculo } from './tipos';

/*
 * Qual motor atende cada cenário (decisão documentada em docs/spike-motores.md, seções
 * "Cenário IBS/CBS por fora" e "municipio / uf"):
 *  - SIMPLES_POR_DENTRO  → motor do Simples (CRT=1, sem tpRegimeIBSCBS): IBS/CBS dentro do DAS.
 *  - SIMPLES_POR_FORA    → motor do REGIME REGULAR, com alíquotas nominais de 2027 e o cst/cClassTrib
 *    confirmado. O motor do Simples com CRT=3/tpRegimeIBSCBS=2 apenas repete o pCBSSN como valor
 *    pendente (vIBSPendSusp/vCBSPendSusp) e não calcula o tributo regular completo.
 *  - REGULAR_AUDITORIA   → mesmo motor e mesmo formato de corpo (compras e auditoria de notas).
 */
export const URL_SIMPLES = '/motor/simples/api/calculadora/observabilidade/simples-nacional';
export const URL_REGULAR = '/motor/regular/api/calculadora/observabilidade/regime-geral';

const VERSAO_SIMPLES = '2.0.0';
const VERSAO_REGULAR = '1.0.0';
/** Ano de vigência simulado (primeiro ano da cobrança de CBS/IBS-teste da LC 214/2025: 2027, ver spike). */
const ANO_SIMULADO = '2027';
/** Casas máximas dos percentuais pCBSSN/pIBSSN enviados ao Simples (o motor aceita string decimal). */
const CASAS_PERCENTUAL = 4;
/** O motor regular exige quantidade/unidade para itens com NCM (como nos exemplos do spike); item de nota não as carrega aqui. */
const QUANTIDADE_PADRAO = 1;
const UNIDADE_PADRAO = 'UN';

export const ERRO_SEM_ATIVIDADE: Pick<ErroMotor, 'code' | 'title'> = {
  code: 'RXR-001',
  title: 'Atividade do Simples não informada para este tipo de nota',
};
export const ERRO_SEM_CLASSIFICACAO: Pick<ErroMotor, 'code' | 'title'> = {
  code: 'RXR-002',
  title: 'Classificação não confirmada para este item',
};
export const ERRO_SEM_MUNICIPIO: Pick<ErroMotor, 'code' | 'title'> = {
  code: 'RXR-003',
  title: 'Município da operação não identificado no documento',
};

/** Mesmo dia/mês em 2027; 29/02 → 28/02 (2027 não é bissexto). */
export function dataEm2027(emissaoIso: string): string {
  const em2027 = ANO_SIMULADO + emissaoIso.slice(4);
  return em2027.startsWith(`${ANO_SIMULADO}-02-29`) ? `${ANO_SIMULADO}-02-28${em2027.slice(10)}` : em2027;
}

/** Local da operação para o motor regular: destinatário (tomador na NFS-e) se tiver município e UF; senão o emitente. */
export function localDaOperacao(doc: Documento): { municipio: string; uf: string } | undefined {
  for (const parte of [doc.destinatario, doc.emitente]) {
    if (parte?.municipioIbge && parte.uf) return { municipio: parte.municipioIbge, uf: parte.uf };
  }
  return undefined;
}

const dinheiro = (v: Big) => v.toFixed(2);
const percentual = (v: Big) => v.round(CASAS_PERCENTUAL).toString();

function naoCalculado(doc: Documento, item: ItemDocumento, erro: Pick<ErroMotor, 'code' | 'title'>, detalhe: string): ItemCalculado {
  return {
    chave: doc.chave,
    numero: item.numero,
    estado: 'NAO_CALCULADO',
    vCBS: Big(0),
    vIBSUF: Big(0),
    vIBSMun: Big(0),
    erros: [{ ...erro, detail: detalhe }],
    memoria: '',
  };
}

export interface RequisicaoMotor {
  url: string;
  corpo: unknown;
  /** Itens que não foram ao motor (sem atividade, sem classificação confirmada, sem município). */
  naoEnviados: ItemCalculado[];
  /** Números dos itens presentes no corpo. */
  numerosEnviados: number[];
}

export function montarRequisicao(
  doc: Documento,
  cenario: Cenario,
  p: ParametrosCalculo,
  nominais: AliquotasNominais,
): RequisicaoMotor {
  const dataIso = dataEm2027(doc.emissao);
  const naoEnviados: ItemCalculado[] = [];
  const numerosEnviados: number[] = [];

  if (cenario === 'SIMPLES_POR_DENTRO') {
    const cAtivSN = p.atividadePorTipo[doc.tipo];
    const aliquotas = cAtivSN ? p.aliquotasSimples[cAtivSN] : undefined;
    const itens: unknown[] = [];
    for (const item of doc.itens) {
      if (!cAtivSN || !aliquotas) {
        naoEnviados.push(naoCalculado(doc, item, ERRO_SEM_ATIVIDADE, `Tipo de documento ${doc.tipo}`));
        continue;
      }
      const classificacao = p.classificacoes[identificarGrupo(item).chave];
      if (!classificacao) {
        naoEnviados.push(naoCalculado(doc, item, ERRO_SEM_CLASSIFICACAO, `Grupo ${identificarGrupo(item).chave}`));
        continue;
      }
      numerosEnviados.push(item.numero);
      itens.push({
        numero: item.numero,
        cAtivSN,
        cClassTrib: classificacao.cClassTrib,
        baseCalculo: dinheiro(item.baseCalculo),
        valorImpostoSeletivo: dinheiro(item.valorIS),
        pCBSSN: percentual(aliquotas.pCBSSN),
        pIBSSN: percentual(aliquotas.pIBSSN),
      });
    }
    return {
      url: URL_SIMPLES,
      corpo: { id: doc.chave, versao: VERSAO_SIMPLES, data: dataIso.slice(0, 10), tpDoc: String(doc.tpDoc), CRT: '1', itens },
      naoEnviados,
      numerosEnviados,
    };
  }

  const local = localDaOperacao(doc);
  const aliquotasNominais = {
    cbs: nominais.cbs.toNumber(),
    ibsEstadual: nominais.ibsEstadual.toNumber(),
    ibsMunicipal: nominais.ibsMunicipal.toNumber(),
  };
  const itens: unknown[] = [];
  for (const item of doc.itens) {
    if (!local) {
      naoEnviados.push(naoCalculado(doc, item, ERRO_SEM_MUNICIPIO, 'Nem o destinatário nem o emitente informam município e UF'));
      continue;
    }
    const { chave } = identificarGrupo(item);
    const classificacao = p.classificacoes[chave];
    if (!classificacao) {
      naoEnviados.push(naoCalculado(doc, item, ERRO_SEM_CLASSIFICACAO, `Grupo ${chave}`));
      continue;
    }
    const ncm = item.ncm?.replace(/\D/g, '');
    const nbs = item.nbs?.replace(/\D/g, '');
    numerosEnviados.push(item.numero);
    itens.push({
      numero: item.numero,
      ...(ncm ? { ncm } : nbs ? { nbs } : {}),
      cst: classificacao.cst,
      cClassTrib: classificacao.cClassTrib,
      baseCalculo: dinheiro(item.baseCalculo),
      ...(ncm ? { quantidade: QUANTIDADE_PADRAO, unidade: UNIDADE_PADRAO } : {}),
      aliquotasNominais,
    });
  }
  return {
    url: URL_REGULAR,
    corpo: {
      id: doc.chave,
      versao: VERSAO_REGULAR,
      dhFatoGerador: dataIso,
      municipio: Number(local?.municipio ?? 0),
      uf: local?.uf ?? '',
      tpDoc: doc.tpDoc,
      itens,
    },
    naoEnviados,
    numerosEnviados,
  };
}
