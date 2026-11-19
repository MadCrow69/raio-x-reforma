import type Big from 'big.js';

export type TipoDocumento = 'NFE' | 'NFCE' | 'NFSE';
export type MotivoIgnorado =
  | 'XML_INVALIDO'
  | 'TIPO_NAO_SUPORTADO'
  | 'MUITO_GRANDE'
  | 'NFSE_MUNICIPAL'
  | 'EVENTO'
  | 'CANCELADA'
  | 'DEVOLUCAO'
  | 'DUPLICADO'
  | 'OUTRA_EMPRESA';

export interface GrupoIbsCbsNota {
  cst: string;
  cClassTrib: string;
  vBC: Big;
  vCBS: Big;
  vIBSUF: Big;
  vIBSMun: Big;
}

export interface ItemDocumento {
  numero: number;
  descricao: string;
  ncm?: string;
  nbs?: string;
  cfop?: string;
  /** vProd + vFrete + vSeg + vOutro − vDesc (NF-e); vServ − descontos incondicionados (NFS-e) */
  baseCalculo: Big;
  /** 0 quando ausente */
  valorIS: Big;
  ibscbsNota?: GrupoIbsCbsNota;
}

export interface Parte {
  /** Identificador bruto (CNPJ pode ser alfanumérico); a normalização fica na Task 4. */
  documento: string;
  tipo: 'PJ' | 'PF' | 'ESTRANGEIRO';
  municipioIbge?: string;
  uf?: string;
}

export interface Documento {
  chave: string;
  /** nNF (NF-e/NFC-e) ou nNFSe (NFS-e) */
  numero: string;
  tipo: TipoDocumento;
  tpDoc: 55 | 65 | 91;
  /** ISO 8601 com offset, como no XML */
  emissao: string;
  emitente: Parte & { crt?: string };
  destinatario?: Parte;
  itens: ItemDocumento[];
  arquivo: string;
}

export interface DocumentoIgnorado {
  arquivo: string;
  motivo: MotivoIgnorado;
  detalhe?: string;
  /** Só em EVENTO de cancelamento homologado: chaves das NF-e/NFC-e canceladas (tiradas do lote em lerArquivos). */
  chavesCanceladas?: string[];
}

export interface ResultadoLeitura {
  documentos: Documento[];
  ignorados: DocumentoIgnorado[];
}
