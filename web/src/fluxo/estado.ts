import { useReducer } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import { detectarEmpresa, separar, type Separacao } from '../dominio/separar';
import type { ResultadoLeitura } from '../leitura/tipos';
import type { ParametrosCalculo } from '../motor/tipos';
import type { OrigemCompras, ResultadoSimulacao } from '../simulacao/simular';

/*
 * Estado do fluxo de uma análise (Enviar → Confirmar → Calculando → Resultado). Só em memória:
 * nada daqui vai para localStorage ou qualquer outro armazenamento (dado fiscal não é persistido).
 */

export type Passo = 'ENVIAR' | 'CONFIRMAR' | 'CALCULANDO' | 'RESULTADO';

export interface EstadoFluxo {
  passo: Passo;
  leitura?: ResultadoLeitura;
  cnpjEmpresa?: string;
  separacao?: Separacao;
  parametros?: ParametrosCalculo;
  origemCompras?: OrigemCompras;
  auditoria?: LinhaAuditoria[];
  simulacao?: ResultadoSimulacao;
  erro?: string;
}

export type AcaoFluxo =
  | { tipo: 'ARQUIVOS_LIDOS'; leitura: ResultadoLeitura }
  | { tipo: 'EMPRESA_CONFIRMADA'; cnpjEmpresa: string; parametros: ParametrosCalculo; origemCompras: OrigemCompras }
  | { tipo: 'CALCULO_CONCLUIDO'; auditoria: LinhaAuditoria[]; simulacao: ResultadoSimulacao }
  | { tipo: 'ERRO'; mensagem: string }
  | { tipo: 'NOVA_ANALISE' };

export const ESTADO_INICIAL: EstadoFluxo = { passo: 'ENVIAR' };

/** Único lugar que deriva empresa e separação vendas/compras a partir da leitura. */
function comEmpresa(leitura: ResultadoLeitura, cnpjEmpresa: string | null): Pick<EstadoFluxo, 'cnpjEmpresa' | 'separacao'> {
  if (!cnpjEmpresa) return { cnpjEmpresa: undefined, separacao: undefined };
  return { cnpjEmpresa, separacao: separar(leitura.documentos, cnpjEmpresa) };
}

export function reduzirFluxo(estado: EstadoFluxo, acao: AcaoFluxo): EstadoFluxo {
  switch (acao.tipo) {
    case 'ARQUIVOS_LIDOS':
      return {
        passo: 'CONFIRMAR',
        leitura: acao.leitura,
        ...comEmpresa(acao.leitura, detectarEmpresa(acao.leitura.documentos)),
      };
    case 'EMPRESA_CONFIRMADA': {
      if (!estado.leitura) return { ...estado, erro: 'Envie as notas antes de confirmar a empresa.' };
      return {
        ...estado,
        passo: 'CALCULANDO',
        ...comEmpresa(estado.leitura, acao.cnpjEmpresa),
        parametros: acao.parametros,
        origemCompras: acao.origemCompras,
        erro: undefined,
      };
    }
    case 'CALCULO_CONCLUIDO':
      return { ...estado, passo: 'RESULTADO', auditoria: acao.auditoria, simulacao: acao.simulacao, erro: undefined };
    case 'ERRO':
      return { ...estado, erro: acao.mensagem };
    case 'NOVA_ANALISE':
      return ESTADO_INICIAL;
  }
}

export function useFluxo(): [EstadoFluxo, (acao: AcaoFluxo) => void] {
  return useReducer(reduzirFluxo, ESTADO_INICIAL);
}
