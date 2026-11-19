import Big from 'big.js';
import type { Documento } from '../leitura/tipos';
import { dataEm2027, localDaOperacao, montarRequisicao, URL_SIMPLES } from './montarRequisicoes';
import type {
  AliquotasNominais,
  Cenario,
  ErroMotor,
  ErroMotorJson,
  EstadoItem,
  ItemCalculado,
  ObjetoRegularJson,
  ObjetoSimplesJson,
  ParametrosCalculo,
  ProblemaJson,
  RespostaRegularJson,
  RespostaSimplesJson,
} from './tipos';

export type { AliquotasNominais, Cenario, ErroMotor, EstadoItem, ItemCalculado, ParametrosCalculo } from './tipos';
export { dataEm2027, montarRequisicao } from './montarRequisicoes';

/** Máximo de documentos em voo ao mesmo tempo (os motores são JVMs de ~500 MiB). */
export const LIMITE_CONCORRENCIA = 4;

/**
 * Alíquotas de referência de 2027 (pontos percentuais) usadas quando as rotas de dados abertos não
 * respondem (elas dão 404 de 2027 em diante: docs/spike-motores.md). Fonte: LC 214/2025, transição
 * de 2027 (CBS 8,8%; IBS 0,05% estadual + 0,05% municipal) — os mesmos valores dos exemplos do
 * próprio motor (docs/exemplos.md) e das fixtures do spike.
 */
export const ALIQUOTAS_REFERENCIA_2027: Readonly<AliquotasNominais> = {
  cbs: Big('8.8'),
  ibsEstadual: Big('0.05'),
  ibsMunicipal: Big('0.05'),
};

const BASE_DADOS_ABERTOS = '/motor/regular/api/calculadora/dados-abertos';
/** Código IBGE da UF (2 primeiros dígitos do município) — as rotas de dados abertos pedem `codigoUf`. */
const DIGITOS_UF_IBGE = 2;

const cacheAliquotas = new Map<string, Promise<AliquotasNominais>>();
export const limparCacheAliquotas = () => cacheAliquotas.clear();

async function aliquotaReferencia(url: string): Promise<Big> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = (await resp.json()) as { aliquotaReferencia?: number | string };
  if (json.aliquotaReferencia === undefined || json.aliquotaReferencia === null) throw new Error('Resposta sem aliquotaReferencia');
  return Big(json.aliquotaReferencia);
}

/** `data` no formato AAAA-MM-DD. Cache por (uf, município, data) durante a sessão. */
export function buscarAliquotasNominais(uf: string, municipioIbge: string, data: string): Promise<AliquotasNominais> {
  const chave = `${uf}|${municipioIbge}|${data}`;
  let pendente = cacheAliquotas.get(chave);
  if (!pendente) {
    const codigoUf = municipioIbge.slice(0, DIGITOS_UF_IBGE);
    pendente = Promise.all([
      aliquotaReferencia(`${BASE_DADOS_ABERTOS}/aliquota-uniao?data=${data}`),
      aliquotaReferencia(`${BASE_DADOS_ABERTOS}/aliquota-uf?codigoUf=${codigoUf}&data=${data}`),
      aliquotaReferencia(`${BASE_DADOS_ABERTOS}/aliquota-municipio?codigoMunicipio=${municipioIbge}&data=${data}`),
    ])
      .then(([cbs, ibsEstadual, ibsMunicipal]) => ({ cbs, ibsEstadual, ibsMunicipal }))
      .catch(() => ({ ...ALIQUOTAS_REFERENCIA_2027 }));
    cacheAliquotas.set(chave, pendente);
  }
  return pendente;
}

const ERRO_TECNICO: Pick<ErroMotor, 'code' | 'title'> = { code: 'RXR-900', title: 'Falha técnica ao consultar o motor de cálculo' };

const zero = () => Big(0);
const dec = (v: string | undefined) => (v === undefined || v === '' ? zero() : Big(v));

function item(
  doc: Documento,
  numero: number,
  estado: EstadoItem,
  erros: ErroMotor[],
  extra: Partial<Pick<ItemCalculado, 'vCBS' | 'vIBSUF' | 'vIBSMun' | 'memoria'>> = {},
): ItemCalculado {
  return { chave: doc.chave, numero, estado, vCBS: zero(), vIBSUF: zero(), vIBSMun: zero(), erros, memoria: '', ...extra };
}

const paraErro = (e: ErroMotorJson): ErroMotor => ({
  code: e.code,
  title: e.title,
  ...(e.pointer ? { pointer: e.pointer } : {}),
  detail: e.detail ?? '',
});

/** O Simples devolve CALCULADO; no modelo do app é o mesmo que CALCULO_SIMULADO. Estado desconhecido → NAO_IMPLEMENTADO. */
function normalizarEstado(estado: string): EstadoItem {
  if (estado === 'CALCULADO' || estado === 'CALCULO_SIMULADO') return 'CALCULO_SIMULADO';
  if (['INCONSISTENCIA_ENTRADA', 'FALHA_TECNICA', 'NAO_IMPLEMENTADO', 'NAO_CALCULADO'].includes(estado)) return estado as EstadoItem;
  return 'NAO_IMPLEMENTADO';
}

/**
 * O motor do Simples só devolve a parcela de IBS total (vIBSSN), sem separar UF/município:
 * o total vai em vIBSUF e vIBSMun fica 0. Ele também não devolve memoriaCalculo; a memória é
 * montada a partir dos percentuais e valores da resposta.
 */
function mapearSimples(doc: Documento, o: ObjetoSimplesJson): ItemCalculado {
  const estado = normalizarEstado(o.estadoItem);
  const erros = (o.erros ?? []).map(paraErro);
  const t = o.tribCalc;
  if (estado !== 'CALCULO_SIMULADO' || !t) return item(doc, o.nObj, estado, erros);
  const vIBSUF = t.vIBSUF !== undefined ? dec(t.vIBSUF) : dec(t.vIBSSN);
  const memoria =
    `Simples Nacional, IBS/CBS por dentro: CBS ${t.pCBSSN ?? '0'}% = R$ ${t.vCBSSN ?? '0.00'}; ` +
    `IBS ${t.pIBSSN ?? '0'}% = R$ ${t.vIBSSN ?? '0.00'} sobre a base de R$ ${t.vBC ?? '0.00'}.`;
  return item(doc, o.nObj, estado, erros, { vCBS: dec(t.vCBSSN), vIBSUF, vIBSMun: dec(t.vIBSMun), memoria });
}

function mapearRegular(doc: Documento, o: ObjetoRegularJson): ItemCalculado {
  const estado = normalizarEstado(o.estadoItem);
  const erros = (o.erros ?? []).map(paraErro);
  const g = o.tribCalc?.IBSCBS?.gIBSCBS;
  if (!g) return item(doc, o.nObj, estado, erros);
  const memoria = [...new Set([g.gCBS?.memoriaCalculo, g.gIBSUF?.memoriaCalculo, g.gIBSMun?.memoriaCalculo].filter(Boolean))].join('\n');
  return item(doc, o.nObj, estado, erros, {
    vCBS: dec(g.gCBS?.vCBS),
    vIBSUF: dec(g.gIBSUF?.vIBSUF),
    vIBSMun: dec(g.gIBSMun?.vIBSMun),
    memoria,
  });
}

async function calcularDocumento(doc: Documento, cenario: Cenario, p: ParametrosCalculo): Promise<ItemCalculado[]> {
  let nominais: AliquotasNominais = { ...ALIQUOTAS_REFERENCIA_2027 };
  if (cenario !== 'SIMPLES_POR_DENTRO') {
    const local = localDaOperacao(doc);
    if (local) nominais = await buscarAliquotasNominais(local.uf, local.municipio, dataEm2027(doc.emissao).slice(0, 10));
  }
  const req = montarRequisicao(doc, cenario, p, nominais);
  if (req.numerosEnviados.length === 0) return req.naoEnviados;

  const falhaTecnica = (detalhe: string) =>
    req.numerosEnviados.map((n) => item(doc, n, 'FALHA_TECNICA', [{ ...ERRO_TECNICO, detail: detalhe }]));

  try {
    const resp = await fetch(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req.corpo),
    });
    if (resp.status === 422) {
      const problema = (await resp.json()) as ProblemaJson;
      const erros: ErroMotor[] = problema.errors?.length
        ? problema.errors.map(paraErro)
        : [{ code: 'RXR-422', title: problema.title, detail: problema.detail ?? '' }];
      return [...req.numerosEnviados.map((n) => item(doc, n, 'INCONSISTENCIA_ENTRADA', erros)), ...req.naoEnviados];
    }
    if (!resp.ok) return [...falhaTecnica(`HTTP ${resp.status}`), ...req.naoEnviados];

    const json = (await resp.json()) as RespostaSimplesJson | RespostaRegularJson;
    const simples = req.url === URL_SIMPLES;
    const calculados = req.numerosEnviados.map((n) => {
      const o = json.objetos.find((x) => x.nObj === n);
      if (!o) return item(doc, n, 'FALHA_TECNICA', [{ ...ERRO_TECNICO, detail: 'Resposta do motor sem este item' }]);
      return simples ? mapearSimples(doc, o as ObjetoSimplesJson) : mapearRegular(doc, o as ObjetoRegularJson);
    });
    return [...calculados, ...req.naoEnviados];
  } catch (e) {
    return [...falhaTecnica(e instanceof Error ? e.message : String(e)), ...req.naoEnviados];
  }
}

/** Calcula todos os documentos (até LIMITE_CONCORRENCIA em paralelo); `aoProgredir` conta documentos concluídos. */
export async function calcular(
  docs: Documento[],
  cenario: Cenario,
  p: ParametrosCalculo,
  aoProgredir?: (feitos: number, total: number) => void,
): Promise<ItemCalculado[]> {
  const resultados: ItemCalculado[][] = new Array(docs.length);
  let proximo = 0;
  let feitos = 0;
  const trabalhador = async () => {
    while (proximo < docs.length) {
      const i = proximo++;
      try {
        resultados[i] = (await calcularDocumento(docs[i], cenario, p)).sort((a, b) => a.numero - b.numero);
      } catch (e) {
        const detalhe = e instanceof Error ? e.message : String(e);
        resultados[i] = docs[i].itens.map((it) => item(docs[i], it.numero, 'FALHA_TECNICA', [{ ...ERRO_TECNICO, detail: detalhe }]));
      }
      feitos += 1;
      aoProgredir?.(feitos, docs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMITE_CONCORRENCIA, docs.length) }, trabalhador));
  return resultados.flat();
}
