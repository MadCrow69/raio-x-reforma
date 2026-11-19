import Big from 'big.js';
import type { Documento, DocumentoIgnorado, GrupoIbsCbsNota } from './tipos.ts';
import { ErroLeitura, descendente, filho, lerParte, texto, valor } from './xmlUtil.ts';

function ignorado(arquivo: string, motivo: DocumentoIgnorado['motivo'], detalhe: string): DocumentoIgnorado {
  return { arquivo, motivo, detalhe };
}

function lerGrupo(infNFSe: Element, infDPS: Element | undefined): GrupoIbsCbsNota | undefined {
  const ibscbs = filho(infNFSe, 'IBSCBS');
  if (!ibscbs) return undefined;
  const g = descendente(filho(infDPS, 'IBSCBS'), 'gIBSCBS');
  const cst = texto(g, 'CST');
  const cClassTrib = texto(g, 'cClassTrib');
  if (!cst || !cClassTrib) return undefined;
  const tot = filho(ibscbs, 'totCIBS');
  return {
    cst,
    cClassTrib,
    vBC: valor(filho(ibscbs, 'valores'), 'vBC'),
    vCBS: valor(tot, 'gCBS', 'vCBS'),
    vIBSUF: valor(tot, 'gIBS', 'gIBSUFTot', 'vIBSUF'),
    vIBSMun: valor(tot, 'gIBS', 'gIBSMunTot', 'vIBSMun'),
  };
}

/**
 * NFS-e nacional (leiaute SEFIN/ADN: raiz <NFSe> com <infNFSe>). Qualquer outro leiaute
 * (ABRASF, municipais próprios) é ignorado como NFSE_MUNICIPAL.
 */
export function lerNFSe(xml: Document, arquivo: string): Documento | DocumentoIgnorado {
  const raiz = xml.documentElement;
  const infNFSe = raiz.localName === 'NFSe' ? filho(raiz, 'infNFSe') : undefined;
  if (!infNFSe) {
    return ignorado(
      arquivo,
      'NFSE_MUNICIPAL',
      `NFS-e de leiaute municipal (raiz <${raiz.localName}>); só o padrão nacional é lido.`,
    );
  }
  try {
    const infDPS = descendente(filho(infNFSe, 'DPS'), 'infDPS');
    const chave = (infNFSe.getAttribute('Id') ?? '').replace(/^NFS/, '');
    if (!chave) throw new ErroLeitura('Identificador da NFS-e (infNFSe@Id) ausente.');
    const emit = filho(infNFSe, 'emit');
    const emitente = lerParte(emit, filho(emit, 'enderNac'));
    if (!emitente) throw new ErroLeitura('Prestador sem CNPJ/CPF.');
    const toma = filho(infDPS, 'toma');
    const emissao = texto(infDPS, 'dhEmi') ?? texto(infNFSe, 'dhProc');
    if (!emissao) throw new ErroLeitura('Data de emissão ausente.');
    const serv = filho(infDPS, 'serv', 'cServ');
    const vals = filho(infDPS, 'valores');
    const baseCalculo: Big = valor(vals, 'vServPrest', 'vServ').minus(valor(vals, 'vDescCondIncond', 'vDescIncond'));
    return {
      chave,
      numero: texto(infNFSe, 'nNFSe') ?? '',
      tipo: 'NFSE',
      tpDoc: 91,
      emissao,
      emitente: { ...emitente, opSimpNac: texto(filho(infDPS, 'prest', 'regTrib'), 'opSimpNac') },
      destinatario: lerParte(toma, filho(toma, 'end', 'endNac')),
      itens: [
        {
          numero: 1,
          descricao: texto(serv, 'xDescServ') ?? '',
          nbs: texto(serv, 'cNBS'),
          baseCalculo,
          valorIS: new Big(0),
          ibscbsNota: lerGrupo(infNFSe, infDPS),
        },
      ],
      arquivo,
    };
  } catch (e) {
    if (e instanceof ErroLeitura) return ignorado(arquivo, 'XML_INVALIDO', e.message);
    throw e;
  }
}
