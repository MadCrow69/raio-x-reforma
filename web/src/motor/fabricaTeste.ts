import Big from 'big.js';
import type { OpcaoClassificacao } from '../classificacao/sugestoes';
import type { Documento, ItemDocumento } from '../leitura/tipos';
import type { AliquotasNominais, ParametrosCalculo } from './tipos';

/** Fábricas só para testes do módulo motor. */
export const opcao = (cst: string, cClassTrib: string): OpcaoClassificacao => ({
  cst,
  cClassTrib,
  descricao: cClassTrib,
  reducaoCbs: Big(0),
  reducaoIbs: Big(0),
});

export const item = (numero: number, extra: Partial<ItemDocumento> = {}): ItemDocumento => ({
  numero,
  descricao: `item ${numero}`,
  ncm: '61091000',
  baseCalculo: Big('950'),
  valorIS: Big(0),
  ...extra,
});

export const doc = (extra: Partial<Documento> = {}): Documento => ({
  chave: 'CHAVE1',
  numero: '1',
  tipo: 'NFE',
  tpDoc: 55,
  emissao: '2026-03-15T10:00:00-03:00',
  emitente: { documento: '11222333000181', tipo: 'PJ', municipioIbge: '4314902', uf: 'RS', crt: '1' },
  destinatario: { documento: '99888777000166', tipo: 'PJ', municipioIbge: '3550308', uf: 'SP' },
  itens: [item(1)],
  arquivo: 'a.xml',
  ...extra,
});

export const nominais: AliquotasNominais = { cbs: Big('8.8'), ibsEstadual: Big('0.05'), ibsMunicipal: Big('0.05') };

export const parametros = (extra: Partial<ParametrosCalculo> = {}): ParametrosCalculo => ({
  classificacoes: { 'NCM:61091000': opcao('000', '000001') },
  atividadePorTipo: { NFE: '01', NFSE: '07' },
  aliquotasSimples: {
    '01': { anexo: 'I', faixa: 1, efetivaTotal: Big('4'), pCBSSN: Big('2.75'), pIBSSN: Big('1.25'), dasSemCbsIbs: Big(0) },
    '07': { anexo: 'III', faixa: 1, efetivaTotal: Big('4'), pCBSSN: Big('2.75'), pIBSSN: Big('1.25'), dasSemCbsIbs: Big(0) },
  },
  ...extra,
});
