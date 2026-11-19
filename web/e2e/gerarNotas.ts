/**
 * Gera notas fiscais SINTÉTICAS (nenhum dado real) para o teste ponta a ponta e para a medição de layout.
 * Determinístico: a mesma semente produz exatamente os mesmos arquivos.
 *
 * Composição (203 arquivos, 200 notas válidas):
 *  - 150 vendas da empresa: 70 NF-e PJ, 30 NF-e PF, 30 NFC-e, 20 NFS-e nacional (60% PJ por quantidade);
 *  - 50 compras (NF-e de 3 fornecedores, com grupo IBSCBS nas alíquotas de teste de 2026: CBS 0,9% e IBS 0,1%);
 *  - 3 NCMs com alíquota reduzida (da tabela oficial exportada), 1 NCM incompatível com o cClassTrib da nota
 *    (numa venda e numa compra; o motor regular responde REG-011), 2 arquivos duplicados e 1 evento de cancelamento.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { cnpjValido } from '../src/dominio/cnpj';

export const SEMENTE = 20261119;
export const PASTA_NOTAS = join(tmpdir(), 'raio-x-e2e');

/** Totais esperados pelo teste (fonte única: o teste importa daqui). */
export const ESPERADO = {
  notasLidas: 200,
  ignorados: 3, // 2 duplicadas + 1 evento
  vendas: 150,
  compras: 50,
  arquivos: 203,
} as const;

/** Alíquotas de referência de 2027 usadas pelos motores (docs/spike-motores.md), em %. */
const ALIQ_2027 = { cbs: 8.8, ibsUF: 0.05, ibsMun: 0.05 };
/** Alíquotas de teste de 2026 que as notas reais trazem no grupo IBSCBS (LC 214/2025, arts. 343 e 346), em %. */
const ALIQ_TESTE_2026 = { cbs: 0.9, ibsUF: 0.1, ibsMun: 0 };
const aliquotasDoAno = (emissao: string) => (emissao.slice(0, 4) < '2027' ? ALIQ_TESTE_2026 : ALIQ_2027);

/** NCMs com alíquota reduzida na tabela oficial exportada (/dados/sugestoes-classificacao.json). */
const NCMS_REDUZIDOS = [
  { ncm: '10064000', cst: '200', cClassTrib: '200003', reducao: 100, nome: 'ARROZ QUEBRADO' },
  { ncm: '11031100', cst: '200', cClassTrib: '200034', reducao: 60, nome: 'GRUMO DE TRIGO' },
  { ncm: '12011000', cst: '200', cClassTrib: '200038', reducao: 60, nome: 'SOJA PARA SEMEADURA' },
] as const;

/** NCM 02013000 com cClassTrib 200035: combinação que o motor rejeita (REG-011, "NCM não vinculada"). */
const INCOMPATIVEL = { ncm: '02013000', cst: '200', cClassTrib: '200035', nome: 'CARNE BOVINA DESOSSADA' } as const;

const NCMS_NORMAIS = [
  { ncm: '62034200', nome: 'CALCA MASCULINA' },
  { ncm: '61091000', nome: 'CAMISETA ALGODAO' },
  { ncm: '84713012', nome: 'NOTEBOOK' },
  { ncm: '94036000', nome: 'MOVEL DE MADEIRA' },
  { ncm: '39241000', nome: 'UTENSILIO PLASTICO' },
  { ncm: '85171300', nome: 'SMARTPHONE' },
] as const;

const SERVICOS = [
  { nbs: '115021000', trib: '010101', nome: 'Análise e desenvolvimento de sistemas' },
  { nbs: '115022000', trib: '010201', nome: 'Programação sob encomenda' },
  { nbs: '115040000', trib: '010701', nome: 'Suporte técnico em informática' },
] as const;

const NOMES_PJ = ['ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA', 'SIGMA', 'ZETA', 'TETA', 'IOTA', 'KAPA'];
const NOMES_PF = ['MARIA EXEMPLO', 'JOAO EXEMPLO', 'ANA EXEMPLO', 'PEDRO EXEMPLO', 'LUCIA EXEMPLO', 'CARLOS EXEMPLO'];
const MUNICIPIOS = [
  { cMun: '4113700', nome: 'LONDRINA', uf: 'PR', cUF: '41' },
  { cMun: '4106902', nome: 'CURITIBA', uf: 'PR', cUF: '41' },
  { cMun: '3550308', nome: 'SAO PAULO', uf: 'SP', cUF: '35' },
];

/** PRNG mulberry32: pequeno, rápido e determinístico. */
function criarAleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** CNPJ numérico válido a partir de 8 dígitos-base (filial 0001); os DVs saem do validador oficial do app. */
export function cnpjSintetico(base8: number): string {
  const prefixo = `${String(base8).padStart(8, '0')}0001`;
  for (let dv = 0; dv < 100; dv++) {
    const c = prefixo + String(dv).padStart(2, '0');
    if (cnpjValido(c)) return c;
  }
  throw new Error(`Sem DV válido para ${prefixo}`);
}

function cpfSintetico(n: number): string {
  const base = String(n).padStart(9, '0').split('').map(Number);
  const dv = (digitos: number[]) => {
    const soma = digitos.reduce((s, d, i) => s + d * (digitos.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join('');
}

/** DV (módulo 11, pesos 2..9) da chave de acesso. */
function dvChave(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

const dinheiro = (v: number) => v.toFixed(2);
const arredondar = (v: number) => Math.round(v * 100) / 100;

function dataEmissao(alea: () => number): string {
  const m = 4 + Math.floor(alea() * 3); // abril, maio, junho de 2026
  const dia = 1 + Math.floor(alea() * 28);
  const hora = 8 + Math.floor(alea() * 10);
  return `2026-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:15:00-03:00`;
}

interface ItemGerado {
  ncm: string;
  nome: string;
  valor: number;
  grupo?: { cst: string; cClassTrib: string; reducao: number };
}

function xmlGrupo(base: number, g: NonNullable<ItemGerado['grupo']>, aliq: typeof ALIQ_2027): string {
  const f = 1 - g.reducao / 100;
  const vCBS = arredondar((base * aliq.cbs * f) / 100);
  const vUF = arredondar((base * aliq.ibsUF * f) / 100);
  const vMun = arredondar((base * aliq.ibsMun * f) / 100);
  return `<IBSCBS><CST>${g.cst}</CST><cClassTrib>${g.cClassTrib}</cClassTrib><gIBSCBS><vBC>${dinheiro(base)}</vBC>
            <gIBSUF><pIBSUF>${aliq.ibsUF.toFixed(2)}</pIBSUF><vIBSUF>${dinheiro(vUF)}</vIBSUF></gIBSUF>
            <gIBSMun><pIBSMun>${aliq.ibsMun.toFixed(2)}</pIBSMun><vIBSMun>${dinheiro(vMun)}</vIBSMun></gIBSMun>
            <vIBS>${dinheiro(vUF + vMun)}</vIBS><gCBS><pCBS>${aliq.cbs.toFixed(2)}</pCBS><vCBS>${dinheiro(vCBS)}</vCBS></gCBS></gIBSCBS></IBSCBS>`;
}

interface DadosNFe {
  mod: '55' | '65';
  emitente: { cnpj: string; nome: string; crt: string };
  destinatario?: { doc: string; tipo: 'PJ' | 'PF'; nome: string };
  municipio: (typeof MUNICIPIOS)[number];
  numero: number;
  emissao: string;
  itens: ItemGerado[];
}

export function chaveNFe(d: DadosNFe): string {
  const aamm = d.emissao.slice(2, 4) + d.emissao.slice(5, 7);
  const cNF = String(10000000 + d.numero * 7919).slice(0, 8);
  const base = `${d.municipio.cUF}${aamm}${d.emitente.cnpj}${d.mod}001${String(d.numero).padStart(9, '0')}1${cNF}`;
  return base + dvChave(base);
}

export function xmlNFe(d: DadosNFe): { chave: string; xml: string } {
  const chave = chaveNFe(d);
  const dest = d.destinatario
    ? `<dest>${d.destinatario.tipo === 'PJ' ? `<CNPJ>${d.destinatario.doc}</CNPJ>` : `<CPF>${d.destinatario.doc}</CPF>`}<xNome>${d.destinatario.nome}</xNome>
        <enderDest><cMun>${d.municipio.cMun}</cMun><xMun>${d.municipio.nome}</xMun><UF>${d.municipio.uf}</UF></enderDest></dest>`
    : '';
  const dets = d.itens
    .map(
      (it, i) => `
      <det nItem="${i + 1}">
        <prod>
          <cProd>${i + 1}</cProd><cEAN>SEM GTIN</cEAN><xProd>${it.nome}</xProd>
          <NCM>${it.ncm}</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom>
          <vUnCom>${dinheiro(it.valor)}</vUnCom><vProd>${dinheiro(it.valor)}</vProd><indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS>
          ${it.grupo ? xmlGrupo(it.valor, it.grupo, aliquotasDoAno(d.emissao)) : ''}
        </imposto>
      </det>`,
    )
    .join('');
  const infNFe = `<infNFe Id="NFe${chave}" versao="4.00">
      <ide><cUF>${d.municipio.cUF}</cUF><mod>${d.mod}</mod><serie>1</serie><nNF>${d.numero}</nNF><dhEmi>${d.emissao}</dhEmi><finNFe>1</finNFe></ide>
      <emit><CNPJ>${d.emitente.cnpj}</CNPJ><xNome>${d.emitente.nome}</xNome>
        <enderEmit><cMun>${d.municipio.cMun}</cMun><xMun>${d.municipio.nome}</xMun><UF>${d.municipio.uf}</UF></enderEmit><IE>1111111</IE><CRT>${d.emitente.crt}</CRT></emit>
      ${dest}${dets}
    </infNFe>`;
  const xml =
    d.mod === '55'
      ? `<?xml version="1.0" encoding="UTF-8"?>\n<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>\n`
      : `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe>${infNFe}</NFe><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>\n`;
  return { chave, xml };
}

/** NFS-e nacional de 2026: sem o grupo IBSCBS (como as reais). */
function xmlNFSe(p: { cnpj: string; nome: string; toma: string; nomeToma: string; numero: number; emissao: string; valor: number; servico: (typeof SERVICOS)[number]; municipio: (typeof MUNICIPIOS)[number] }): { chave: string; xml: string } {
  const idBase = `${p.municipio.cMun}2${p.cnpj}${String(p.numero).padStart(13, '0')}2605`;
  const chave = (idBase + String(p.numero * 104729).padStart(50 - idBase.length, '0')).slice(0, 50);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFS${chave}">
    <nNFSe>${p.numero}</nNFSe>
    <emit><CNPJ>${p.cnpj}</CNPJ><xNome>${p.nome}</xNome><enderNac><cMun>${p.municipio.cMun}</cMun><UF>${p.municipio.uf}</UF></enderNac></emit>
    <valores><vBC>${dinheiro(p.valor)}</vBC><vISSQN>${dinheiro(p.valor * 0.05)}</vISSQN><vLiq>${dinheiro(p.valor)}</vLiq></valores>
    <DPS versao="1.01"><infDPS Id="DPS${p.numero}">
      <dhEmi>${p.emissao}</dhEmi>
      <prest><CNPJ>${p.cnpj}</CNPJ><regTrib><opSimpNac>1</opSimpNac></regTrib></prest>
      <toma><CNPJ>${p.toma}</CNPJ><xNome>${p.nomeToma}</xNome><end><endNac><cMun>${p.municipio.cMun}</cMun></endNac></end></toma>
      <serv><cServ><cTribNac>${p.servico.trib}</cTribNac><xDescServ>${p.servico.nome}</xDescServ><cNBS>${p.servico.nbs}</cNBS></cServ></serv>
      <valores><vServPrest><vServ>${dinheiro(p.valor)}</vServ></vServPrest>
        <trib><tribMun><tribISSQN>1</tribISSQN></tribMun></trib></valores>
    </infDPS></DPS>
  </infNFSe>
</NFSe>
`;
  return { chave, xml };
}

function xmlEventoCancelamento(chaveNFe: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><evento versao="1.00"><infEvento Id="ID110111${chaveNFe}01"><cOrgao>41</cOrgao><chNFe>${chaveNFe}</chNFe><tpEvento>110111</tpEvento><descEvento>Cancelamento</descEvento></infEvento></evento></procEventoNFe>
`;
}

export interface NotasGeradas {
  pasta: string;
  zip: string;
  cnpjEmpresa: string;
  arquivos: number;
}

/** Gera os XMLs e o ZIP em `pasta` (padrão: pasta temporária do sistema, fora do repositório). */
export function gerarNotas(pasta: string = PASTA_NOTAS): NotasGeradas {
  const alea = criarAleatorio(SEMENTE);
  const escolher = <T>(lista: readonly T[]): T => lista[Math.floor(alea() * lista.length)];
  const valor = () => arredondar(40 + alea() * 1960);

  const cnpjEmpresa = cnpjSintetico(11000001);
  const empresa = { cnpj: cnpjEmpresa, nome: 'EMPRESA EXEMPLO COMERCIO E SERVICOS LTDA', crt: '1' };
  const fornecedores = [0, 1, 2].map((i) => ({ cnpj: cnpjSintetico(33000001 + i * 17), nome: `FORNECEDOR ${NOMES_PJ[i]} LTDA`, crt: '3' }));
  const clientesPJ = NOMES_PJ.map((n, i) => ({ doc: cnpjSintetico(44000001 + i * 13), tipo: 'PJ' as const, nome: `CLIENTE ${n} LTDA` }));
  const clientesPF = NOMES_PF.map((n, i) => ({ doc: cpfSintetico(123456001 + i * 37), tipo: 'PF' as const, nome: n }));

  const arquivos = new Map<string, string>();
  const chaves: string[] = [];
  let sequencial = 1;

  // Itens de venda: notas de 2026 de empresa do Simples não trazem o grupo IBSCBS (como as reais); a classificação
  // sai da tabela oficial na tela Confirmar. Exceção: a nota com o NCM incompatível, que traz o cClassTrib errado.
  const itemVenda = (): ItemGerado => {
    const sorteio = alea();
    if (sorteio < 0.12) {
      const r = escolher(NCMS_REDUZIDOS);
      return { ncm: r.ncm, nome: r.nome, valor: valor() };
    }
    const n = escolher(NCMS_NORMAIS);
    return { ncm: n.ncm, nome: n.nome, valor: valor() };
  };
  const itensVenda = () => Array.from({ length: 1 + Math.floor(alea() * 3) }, itemVenda);

  const adicionarNFe = (pasta: string, d: Omit<DadosNFe, 'numero' | 'emissao'>) => {
    const { chave, xml } = xmlNFe({ ...d, numero: sequencial++, emissao: dataEmissao(alea) });
    arquivos.set(`${pasta}/${chave}.xml`, xml);
    chaves.push(chave);
    return chave;
  };

  // 150 vendas
  for (let i = 0; i < 66; i++) adicionarNFe('vendas/nfe', { mod: '55', emitente: empresa, destinatario: escolher(clientesPJ), municipio: escolher(MUNICIPIOS), itens: itensVenda() });
  for (let i = 0; i < 30; i++) adicionarNFe('vendas/nfe', { mod: '55', emitente: empresa, destinatario: escolher(clientesPF), municipio: escolher(MUNICIPIOS), itens: itensVenda() });
  for (let i = 0; i < 30; i++) adicionarNFe('vendas/nfce', { mod: '65', emitente: empresa, municipio: MUNICIPIOS[0], itens: [itemVenda()] });
  for (let i = 0; i < 20; i++) {
    const cliente = escolher(clientesPJ);
    const { chave, xml } = xmlNFSe({
      cnpj: empresa.cnpj, nome: empresa.nome, toma: cliente.doc, nomeToma: cliente.nome, numero: 900 + i,
      emissao: dataEmissao(alea), valor: valor() * 2, servico: escolher(SERVICOS), municipio: MUNICIPIOS[0],
    });
    arquivos.set(`vendas/nfse/${chave}.xml`, xml);
  }

  // 3 NCMs com redução garantidos e o NCM incompatível (completam as 70 NF-e PJ).
  for (const r of NCMS_REDUZIDOS) {
    adicionarNFe('vendas/nfe', {
      mod: '55', emitente: empresa, destinatario: clientesPJ[0], municipio: MUNICIPIOS[0],
      itens: [{ ncm: r.ncm, nome: r.nome, valor: 1500 }],
    });
  }
  adicionarNFe('vendas/nfe', {
    mod: '55', emitente: empresa, destinatario: clientesPJ[1], municipio: MUNICIPIOS[0],
    itens: [{ ncm: INCOMPATIVEL.ncm, nome: INCOMPATIVEL.nome, valor: 800, grupo: { cst: INCOMPATIVEL.cst, cClassTrib: INCOMPATIVEL.cClassTrib, reducao: 60 } }],
  });

  // 50 compras (3 fornecedores) com IBSCBS (o fornecedor já emite o grupo). A primeira repete o NCM incompatível.
  adicionarNFe('compras', {
    mod: '55', emitente: fornecedores[0], destinatario: { doc: empresa.cnpj, tipo: 'PJ', nome: empresa.nome },
    municipio: MUNICIPIOS[0],
    itens: [{ ncm: INCOMPATIVEL.ncm, nome: INCOMPATIVEL.nome, valor: 800, grupo: { cst: INCOMPATIVEL.cst, cClassTrib: INCOMPATIVEL.cClassTrib, reducao: 60 } }],
  });
  for (let i = 0; i < 49; i++) {
    const n = escolher(NCMS_NORMAIS);
    adicionarNFe('compras', {
      mod: '55', emitente: escolher(fornecedores), destinatario: { doc: empresa.cnpj, tipo: 'PJ', nome: empresa.nome },
      municipio: escolher(MUNICIPIOS), itens: [{ ncm: n.ncm, nome: n.nome, valor: valor() * 3, grupo: { cst: '000', cClassTrib: '000001', reducao: 0 } }],
    });
  }

  // 2 duplicadas (mesma chave, outro nome de arquivo) e 1 evento de cancelamento
  for (const i of [0, 1]) {
    const origem = [...arquivos.entries()].find(([nome]) => nome.includes(chaves[i]));
    if (origem) arquivos.set(`duplicadas/copia-${i + 1}-${chaves[i]}.xml`, origem[1]);
  }
  arquivos.set(`eventos/cancelamento-${chaves[5]}.xml`, xmlEventoCancelamento(chaves[5]));

  mkdirSync(pasta, { recursive: true });
  const zipavel: Record<string, [Uint8Array, { mtime: Date }]> = {};
  const mtime = new Date('2026-11-19T12:00:00Z'); // data fixa: o ZIP sai byte a byte igual
  const codificador = new TextEncoder();
  for (const [nome, conteudo] of arquivos) {
    const caminho = join(pasta, 'xml', nome);
    mkdirSync(join(caminho, '..'), { recursive: true });
    writeFileSync(caminho, conteudo, 'utf8');
    zipavel[nome] = [codificador.encode(conteudo), { mtime }];
  }
  const zip = join(pasta, 'notas-sinteticas.zip');
  writeFileSync(zip, zipSync(zipavel));
  return { pasta, zip, cnpjEmpresa, arquivos: arquivos.size };
}
