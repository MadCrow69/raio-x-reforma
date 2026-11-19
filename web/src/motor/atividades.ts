import type Big from 'big.js';
import type { TipoDocumento } from '../leitura/tipos';
import { anexoPorFatorR, type Anexo } from '../regras/simples/aliquotaEfetiva';
import { ANO_SIMULADO } from './montarRequisicoes';

/** Data de referência do catálogo (a simulação é sempre de 2027). */
export const DATA_CATALOGO = `${ANO_SIMULADO}-01-01`;
export const URL_ATIVIDADES = `/motor/simples/api/calculadora/simples-nacional/atividades?data=${DATA_CATALOGO}`;

export type ModoFatorR = 'NAO_APLICAVEL' | 'OBRIGATORIO' | 'OPCIONAL' | 'INDISPONIVEL';

export interface AtividadeSimples {
  /** cAtivSN */
  codigo: string;
  descricao: string;
  /** Anexo da atividade; nas sujeitas ao Fator R, o do Fator R atingido (≥ 28%: III). Null = atividade sem anexo (90). */
  anexoPrincipal: Anexo | null;
  /** Só nas sujeitas ao Fator R: anexo quando a folha fica abaixo de 28% do RBT12 (V). */
  anexoFatorRBaixo: Anexo | null;
  /** "III ou V", como o motor rotula. */
  rotuloAnexo: string;
  modoFatorR: ModoFatorR;
  disponivel: boolean;
  /** Modelos de documento fiscal (tpDoc) em que a atividade é admitida. */
  tpDocs: number[];
}

interface AtividadeJson {
  codigo: string;
  descricao: string;
  anexoSemFatorR: string | null;
  anexoComFatorR: string | null;
  rotuloAnexo: string;
  disponivel: boolean;
  modoFatorR: string;
  tpDocsAdmissiveis: string[];
}

/** Tipos de nota que dividem o mesmo seletor: NF-e e NFC-e (mercadorias) × NFS-e (serviços). */
export const GRUPO_MERCADORIAS: TipoDocumento[] = ['NFE', 'NFCE'];
export const GRUPO_SERVICOS: TipoDocumento[] = ['NFSE'];

const TP_DOC: Record<TipoDocumento, number> = { NFE: 55, NFCE: 65, NFSE: 91 };

/*
 * Atenção ao nome dos campos do motor: na atividade 09 (a única sujeita ao Fator R) ele devolve
 * anexoSemFatorR = III e anexoComFatorR = V. Pela LC 123 (art. 18, §§ 5º-J e 5º-M) o Anexo III vale com
 * folha ≥ 28% do RBT12 e o V abaixo disso. Aqui os campos são lidos pelo que valem, não pelo nome:
 * anexoPrincipal (III) e anexoFatorRBaixo (V).
 */
export async function carregarAtividades(): Promise<AtividadeSimples[]> {
  const resp = await fetch(URL_ATIVIDADES);
  if (!resp.ok) throw new Error(`Falha ao carregar as atividades do Simples (HTTP ${resp.status})`);
  const json = (await resp.json()) as AtividadeJson[];
  return json.map((a) => ({
    codigo: a.codigo,
    descricao: a.descricao,
    anexoPrincipal: (a.anexoSemFatorR || null) as Anexo | null,
    anexoFatorRBaixo: (a.anexoComFatorR || null) as Anexo | null,
    rotuloAnexo: a.rotuloAnexo,
    modoFatorR: a.modoFatorR as ModoFatorR,
    disponivel: a.disponivel,
    tpDocs: a.tpDocsAdmissiveis.map(Number),
  }));
}

/** Atividades com anexo (a 90, "não tributável", não tem alíquota) admitidas em todos os tipos do grupo. */
export function atividadesParaTipos(todas: AtividadeSimples[], tipos: TipoDocumento[]): AtividadeSimples[] {
  return todas.filter((a) => a.anexoPrincipal !== null && tipos.every((t) => a.tpDocs.includes(TP_DOC[t])));
}

/** A folha de 12 meses decide o anexo quando a atividade pede o Fator R (OBRIGATORIO/OPCIONAL). */
export const pedeFatorR = (a: AtividadeSimples) => a.modoFatorR === 'OBRIGATORIO' || a.modoFatorR === 'OPCIONAL';

/**
 * Anexo da atividade para o RBT12 e a folha informados; null quando falta a folha de uma atividade
 * que pede Fator R (ou o anexo não existe).
 */
export function resolverAnexo(atividade: AtividadeSimples, rbt12: Big, folha12: Big | null): Anexo | null {
  if (!atividade.anexoPrincipal) return null;
  if (!pedeFatorR(atividade) || !atividade.anexoFatorRBaixo) return atividade.anexoPrincipal;
  if (folha12 === null) return null;
  return anexoPorFatorR(atividade.anexoFatorRBaixo, atividade.anexoPrincipal, folha12, rbt12);
}
