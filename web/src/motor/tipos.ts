import type Big from 'big.js';
import type { Classificacoes } from '../classificacao/sugestoes';
import type { TipoDocumento } from '../leitura/tipos';
import type { AliquotasSimples } from '../regras/simples/aliquotaEfetiva';

/** De onde vieram as alíquotas nominais: rotas de dados abertos do motor ou a referência de 2027 (LC 214) do app. */
export type OrigemAliquotasNominais = 'DADOS_ABERTOS' | 'REFERENCIA_2027';

/** Alíquotas nominais em pontos percentuais (ex.: cbs 8.8 = 8,8%), como no corpo do motor regular. */
export interface AliquotasNominais {
  cbs: Big;
  ibsEstadual: Big;
  ibsMunicipal: Big;
  /** Só informativo (Resumo, "Como chegamos aqui"); não muda o cálculo. */
  origem?: OrigemAliquotasNominais;
}

export interface ParametrosCalculo {
  classificacoes: Classificacoes;
  /** cAtivSN (atividade do Simples) escolhida para cada tipo de documento. */
  atividadePorTipo: Partial<Record<TipoDocumento, string>>;
  /** Alíquotas pCBSSN/pIBSSN por cAtivSN. */
  aliquotasSimples: Record<string, AliquotasSimples>;
}

export type EstadoItem =
  | 'CALCULO_SIMULADO'
  | 'INCONSISTENCIA_ENTRADA'
  | 'FALHA_TECNICA'
  | 'NAO_IMPLEMENTADO'
  | 'NAO_CALCULADO';

export interface ErroMotor {
  code: string;
  title: string;
  pointer?: string;
  detail: string;
}

/** De onde vem o texto da memória: do motor oficial ou composto pelo app (o motor do Simples não devolve memória). */
export type OrigemMemoria = 'MOTOR' | 'COMPOSTA';

export interface ItemCalculado {
  chave: string;
  numero: number;
  estado: EstadoItem;
  vCBS: Big;
  vIBSUF: Big;
  vIBSMun: Big;
  erros: ErroMotor[];
  memoria: string;
  /** Ausente quando não há memória. */
  origemMemoria?: OrigemMemoria;
  /** Só no motor regular e item calculado: alíquotas nominais enviadas (com a origem). */
  aliquotasNominais?: AliquotasNominais;
}

export type Cenario = 'SIMPLES_POR_DENTRO' | 'SIMPLES_POR_FORA' | 'REGULAR_AUDITORIA';

// ---- Formatos dos motores (derivados de web/src/motor/__fixtures__) ----

export interface ErroMotorJson {
  type?: string;
  title: string;
  code: string;
  pointer?: string;
  detail?: string;
}

/** application/problem+json (HTTP 422) de ambos os motores. */
export interface ProblemaJson {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: ErroMotorJson[];
}

export interface ObjetoSimplesJson {
  nObj: number;
  estadoItem: string;
  erros?: ErroMotorJson[];
  tribCalc?: {
    vBC?: string;
    pIBSSN?: string;
    vIBSSN?: string;
    pCBSSN?: string;
    vCBSSN?: string;
    vIBSUF?: string;
    vIBSMun?: string;
  };
}
export interface RespostaSimplesJson {
  objetos: ObjetoSimplesJson[];
}

interface GrupoTributoJson {
  vCBS?: string;
  vIBSUF?: string;
  vIBSMun?: string;
  memoriaCalculo?: string;
}
export interface ObjetoRegularJson {
  nObj: number;
  estadoItem: string;
  erros?: ErroMotorJson[];
  tribCalc?: {
    IBSCBS?: {
      gIBSCBS?: {
        gCBS?: GrupoTributoJson;
        gIBSUF?: GrupoTributoJson;
        gIBSMun?: GrupoTributoJson;
      };
    };
  };
}
export interface RespostaRegularJson {
  objetos: ObjetoRegularJson[];
}

/** Chave de junção documento + item (chave de acesso e número do item, nunca texto digitado). */
export const chaveItem = (chave: string, numero: number) => `${chave}\u0000${numero}`;
