import type { Documento, DocumentoIgnorado, GrupoIbsCbsNota, ItemDocumento } from './tipos.ts';
import { ErroLeitura, descendente, filho, filhos, lerParte, texto, valor } from './xmlUtil.ts';

const RAIZES_EVENTO = new Set(['procEventoNFe', 'envEvento', 'evento', 'retEvento']);

function ignorado(arquivo: string, motivo: DocumentoIgnorado['motivo'], detalhe: string): DocumentoIgnorado {
  return { arquivo, motivo, detalhe };
}

function lerGrupoIbsCbs(imposto: Element | undefined): GrupoIbsCbsNota | undefined {
  const g = filho(imposto, 'IBSCBS');
  if (!g) return undefined;
  const cst = texto(g, 'CST');
  const cClassTrib = texto(g, 'cClassTrib');
  if (!cst || !cClassTrib) return undefined;
  const c = filho(g, 'gIBSCBS');
  return {
    cst,
    cClassTrib,
    vBC: valor(c, 'vBC'),
    vCBS: valor(c, 'gCBS', 'vCBS'),
    vIBSUF: valor(c, 'gIBSUF', 'vIBSUF'),
    vIBSMun: valor(c, 'gIBSMun', 'vIBSMun'),
  };
}

function lerItem(det: Element, indice: number): ItemDocumento {
  const prod = filho(det, 'prod');
  const imposto = filho(det, 'imposto');
  return {
    numero: Number(det.getAttribute('nItem')) || indice + 1,
    descricao: texto(prod, 'xProd') ?? '',
    ncm: texto(prod, 'NCM'),
    cfop: texto(prod, 'CFOP'),
    baseCalculo: valor(prod, 'vProd')
      .plus(valor(prod, 'vFrete'))
      .plus(valor(prod, 'vSeg'))
      .plus(valor(prod, 'vOutro'))
      .minus(valor(prod, 'vDesc')),
    valorIS: valor(filho(imposto, 'IS'), 'vIS'),
    ibscbsNota: lerGrupoIbsCbs(imposto),
  };
}

export function lerNFe(xml: Document, arquivo: string): Documento | DocumentoIgnorado {
  const raiz = xml.documentElement;
  const nomeRaiz = raiz.localName;
  if (RAIZES_EVENTO.has(nomeRaiz)) {
    return ignorado(arquivo, 'EVENTO', 'Evento fiscal (cancelamento, carta de correção etc.), não é um documento de operação.');
  }
  const infNFe = nomeRaiz === 'infNFe' ? raiz : descendente(raiz, 'infNFe');
  if (!infNFe) {
    return ignorado(arquivo, 'TIPO_NAO_SUPORTADO', `Elemento raiz <${nomeRaiz}> não é NF-e, NFC-e ou NFS-e nacional.`);
  }
  try {
    const ide = filho(infNFe, 'ide');
    const mod = texto(ide, 'mod');
    if (mod !== '55' && mod !== '65') {
      return ignorado(arquivo, 'TIPO_NAO_SUPORTADO', `Modelo "${mod ?? 'ausente'}" não suportado (apenas 55 e 65).`);
    }
    if (texto(ide, 'finNFe') === '4') {
      return ignorado(arquivo, 'DEVOLUCAO', 'NF-e de devolução (finNFe=4) fica fora da análise.');
    }
    const id = (infNFe.getAttribute('Id') ?? '').replace(/^NFe/, '');
    const chave = /^\d{44}$/.test(id) ? id : (texto(descendente(raiz, 'infProt'), 'chNFe') ?? id);
    if (!chave) throw new ErroLeitura('Chave de acesso não encontrada.');
    const emit = filho(infNFe, 'emit');
    const emitente = lerParte(emit, filho(emit, 'enderEmit'));
    if (!emitente) throw new ErroLeitura('Emitente sem CNPJ/CPF.');
    const dest = filho(infNFe, 'dest');
    const emissao = texto(ide, 'dhEmi') ?? texto(ide, 'dEmi');
    if (!emissao) throw new ErroLeitura('Data de emissão ausente.');
    return {
      chave,
      numero: texto(ide, 'nNF') ?? '',
      tipo: mod === '55' ? 'NFE' : 'NFCE',
      tpDoc: mod === '55' ? 55 : 65,
      emissao,
      emitente: { ...emitente, crt: texto(emit, 'CRT') },
      destinatario: lerParte(dest, filho(dest, 'enderDest')),
      itens: filhos(infNFe, 'det').map(lerItem),
      arquivo,
    };
  } catch (e) {
    if (e instanceof ErroLeitura) return ignorado(arquivo, 'XML_INVALIDO', e.message);
    throw e;
  }
}
