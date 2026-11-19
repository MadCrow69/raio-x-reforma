import type { TipoDocumento } from '../leitura/tipos';
import type { EstadoItem } from '../motor/tipos';

export type Achado = 'OK' | 'ERRO_MOTOR' | 'VALOR_DIVERGENTE' | 'SEM_GRUPO_NA_NOTA' | 'NAO_CALCULADO';

export const ROTULO_ACHADO: Record<Achado, string> = {
  OK: 'OK',
  ERRO_MOTOR: 'Erro do motor',
  VALOR_DIVERGENTE: 'Valor divergente',
  SEM_GRUPO_NA_NOTA: 'Sem grupo IBS/CBS na nota',
  NAO_CALCULADO: 'Não calculado',
};

export const ROTULO_ESTADO: Record<EstadoItem, string> = {
  CALCULO_SIMULADO: 'Cálculo simulado',
  INCONSISTENCIA_ENTRADA: 'Inconsistência de entrada',
  FALHA_TECNICA: 'Falha técnica',
  NAO_IMPLEMENTADO: 'Não implementado',
  NAO_CALCULADO: 'Não calculado',
};

export const ROTULO_PAPEL: Record<'VENDA' | 'COMPRA', string> = { VENDA: 'Venda', COMPRA: 'Compra' };

export const ROTULO_TIPO: Record<TipoDocumento, string> = { NFE: 'NF-e', NFCE: 'NFC-e', NFSE: 'NFS-e' };
