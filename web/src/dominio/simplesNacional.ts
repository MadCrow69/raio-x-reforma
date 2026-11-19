import type { Documento } from '../leitura/tipos';

/**
 * Códigos que marcam o emitente como optante pelo Simples Nacional:
 *  - NF-e/NFC-e, CRT (MOC da NF-e): 1 = Simples Nacional, 2 = Simples Nacional com excesso de sublimite,
 *    4 = Simples Nacional – MEI (3 = regime normal);
 *  - NFS-e nacional, prest/regTrib/opSimpNac (leiaute SEFIN, tiposSimples_v1.01.xsd, TSOpSimpNac):
 *    2 = MEI, 3 = ME/EPP (1 = não optante).
 */
export const CRT_SIMPLES: readonly string[] = ['1', '2', '4'];
export const OP_SIMP_NAC_OPTANTE: readonly string[] = ['2', '3'];

/** O emitente do documento é optante pelo Simples? Sem a informação, não se presume optante. */
export function emitenteDoSimples(doc: Documento): boolean {
  const { crt, opSimpNac } = doc.emitente;
  return (crt !== undefined && CRT_SIMPLES.includes(crt)) || (opSimpNac !== undefined && OP_SIMP_NAC_OPTANTE.includes(opSimpNac));
}
