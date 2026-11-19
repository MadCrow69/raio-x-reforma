import type { MotivoIgnorado, TipoDocumento } from '../leitura/tipos';
import type { EstadoItem } from '../motor/tipos';

export type Achado =
  | 'OK'
  | 'ERRO_MOTOR'
  | 'VALOR_DIVERGENTE'
  | 'SEM_GRUPO_NA_NOTA'
  | 'NOTA_ALIQUOTA_TESTE'
  | 'NAO_CALCULADO';

export const ROTULO_ACHADO: Record<Achado, string> = {
  OK: 'OK',
  ERRO_MOTOR: 'Erro do motor',
  VALOR_DIVERGENTE: 'Valor divergente',
  SEM_GRUPO_NA_NOTA: 'Sem grupo IBS/CBS na nota',
  NOTA_ALIQUOTA_TESTE: 'Nota anterior a 2027 (alíquotas de teste)',
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

/** Motivo pelo qual um arquivo ficou fora da análise (leitura e separação). */
export const ROTULO_MOTIVO_IGNORADO: Record<MotivoIgnorado, string> = {
  XML_INVALIDO: 'XML inválido',
  TIPO_NAO_SUPORTADO: 'Documento não suportado',
  MUITO_GRANDE: 'Arquivo grande demais',
  NFSE_MUNICIPAL: 'NFS-e municipal (só a nacional é lida)',
  EVENTO: 'Evento da nota (cancelamento, correção…)',
  CANCELADA: 'Nota cancelada',
  DEVOLUCAO: 'Nota de devolução',
  DUPLICADO: 'Nota repetida',
  OUTRA_EMPRESA: 'Outra empresa',
};

/** De onde vem o texto da memória de cálculo: nunca deixar a composta pelo app passar por saída do motor. */
export const ROTULO_ORIGEM_MEMORIA = {
  MOTOR: 'Memória do motor oficial',
  COMPOSTA: 'Composta pelo Raio-X a partir da resposta do motor',
} as const;
