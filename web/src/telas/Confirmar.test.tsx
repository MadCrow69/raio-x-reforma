import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Big from 'big.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Documento, ItemDocumento, ResultadoLeitura, TipoDocumento } from '../leitura/tipos';
import { limparCacheAliquotas } from '../motor/cliente';
import atividadesJson from '../motor/__fixtures__/simples-atividades-2027.json';
import type { ParametrosCalculo } from '../motor/tipos';
import type { OrigemCompras } from '../simulacao/simular';
import Confirmar from './Confirmar';

const EMPRESA = '11222333000181';
const FORNECEDOR = '11444777000161';
const TERCEIRA = '12345678000195';

const opcao = (cClassTrib: string, descricao: string, reducao = '0') => ({
  cst: '000',
  cClassTrib,
  descricao,
  reducaoCbs: reducao,
  reducaoIbs: reducao,
});

const SUGESTOES = {
  ncm: { '6109': [opcao('000001', 'Alíquota padrão'), opcao('200003', 'Redução de 60%', '60')] },
  nbs: {},
  excecoes: { ncm: {}, nbs: {} },
  padrao: opcao('000001', 'Alíquota padrão'),
};

let respostas: { atividades: () => Response; sugestoes: () => Response };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

function itemDoc(numero: number, valor: number, extra: Partial<ItemDocumento> = {}): ItemDocumento {
  return { numero, descricao: `Item ${numero}`, ncm: '61091000', baseCalculo: new Big(valor), valorIS: new Big(0), ...extra };
}

function doc(
  n: string,
  tipo: TipoDocumento,
  emitente: string,
  destinatario: string | undefined,
  itens: ItemDocumento[],
): Documento {
  return {
    chave: `chave${n}`,
    numero: n,
    tipo,
    tpDoc: tipo === 'NFSE' ? 91 : tipo === 'NFCE' ? 65 : 55,
    emissao: '2027-01-10T10:00:00-03:00',
    emitente: { documento: emitente, tipo: 'PJ', uf: 'SP', municipioIbge: '3550308' },
    destinatario: destinatario ? { documento: destinatario, tipo: 'PJ' } : undefined,
    itens,
    arquivo: `${n}.xml`,
  };
}

const NBS = { ncm: undefined, nbs: '101011000' };

function leituraPadrao(): ResultadoLeitura {
  return {
    documentos: [
      doc('v1', 'NFE', EMPRESA, FORNECEDOR, [itemDoc(1, 100), itemDoc(2, 200)]),
      doc('v2', 'NFSE', EMPRESA, undefined, [itemDoc(1, 500, NBS)]),
      doc('c1', 'NFE', FORNECEDOR, EMPRESA, [itemDoc(1, 50)]),
      doc('c2', 'NFE', FORNECEDOR, EMPRESA, [itemDoc(1, 50)]),
      doc('x1', 'NFE', FORNECEDOR, TERCEIRA, [itemDoc(1, 10)]),
    ],
    ignorados: [],
  };
}

const soVendasNFe = (): ResultadoLeitura => ({
  documentos: [doc('v1', 'NFE', EMPRESA, undefined, [itemDoc(1, 100)])],
  ignorados: [],
});

interface Resultado {
  cnpjEmpresa: string;
  parametros: ParametrosCalculo;
  origemCompras: OrigemCompras;
}

function montar(leitura: ResultadoLeitura = leituraPadrao(), cnpjInicial = EMPRESA) {
  const aoConfirmar = vi.fn<(r: Resultado) => void>();
  const aoVoltar = vi.fn();
  render(<Confirmar leitura={leitura} cnpjInicial={cnpjInicial} aoConfirmar={aoConfirmar} aoVoltar={aoVoltar} />);
  return { aoConfirmar, aoVoltar };
}

const campoRbt12 = () => screen.getByLabelText('Faturamento dos últimos 12 meses') as HTMLInputElement;
const botaoCalcular = () => screen.getByRole('button', { name: /Calcular/ }) as HTMLButtonElement;
const digitar = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

async function escolherAtividade(rotulo: string | RegExp, codigo: string) {
  fireEvent.click(await screen.findByRole('button', { name: rotulo }));
  const dialogo = await screen.findByRole('dialog');
  fireEvent.click(within(dialogo).getByRole('radio', { name: new RegExp(`^${codigo} `) }));
}

beforeEach(() => {
  limparCacheAliquotas();
  respostas = { atividades: () => json(atividadesJson), sugestoes: () => json(SUGESTOES) };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada) => {
    const url = String(entrada);
    if (url.includes('/simples-nacional/atividades')) return respostas.atividades();
    if (url.includes('sugestoes-classificacao')) return respostas.sugestoes();
    return json({ title: 'Alíquota não encontrada' }, 404); // dados abertos de 2027: cai na referência
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Confirmar — empresa', () => {
  it('CNPJ detectado aparece preenchido e editável; ao trocar, a contagem venda/compra é refeita e os ignorados mudam', async () => {
    montar();
    const cnpj = screen.getByLabelText('CNPJ da empresa') as HTMLInputElement;
    expect(cnpj.value).toBe(EMPRESA);
    expect(screen.getByText('2 notas de venda · 2 notas de compra')).toBeTruthy();

    digitar(cnpj, FORNECEDOR);
    expect(cnpj.value).toBe(FORNECEDOR);
    expect(screen.getByText('3 notas de venda · 1 nota de compra')).toBeTruthy();
  });

  it('mostra as notas ignoradas por não serem da empresa, com o motivo em português', async () => {
    montar();
    expect(screen.getByText('Outra empresa')).toBeTruthy();
    fireEvent.click(screen.getByText('Outra empresa'));
    expect(screen.getByText('Documento não emitido nem recebido pela empresa analisada.')).toBeTruthy();
    expect(screen.getByText('x1.xml')).toBeTruthy();
  });

  it('CNPJ inválido bloqueia o cálculo e explica', async () => {
    montar();
    digitar(screen.getByLabelText('CNPJ da empresa'), '11222333000180');
    expect(screen.getByText('CNPJ inválido: confira os dígitos.')).toBeTruthy();
    expect(botaoCalcular().disabled).toBe(true);
  });

  it('"Voltar" avisa o passo anterior', () => {
    const { aoVoltar } = montar();
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });
});

describe('Confirmar — faturamento (RBT12)', () => {
  it('aceita moeda BR; acima de R$ 3.600.000,00 mostra o aviso âmbar do sublimite sem bloquear', async () => {
    montar();
    digitar(campoRbt12(), '3.700.000,00');
    expect(screen.getByText('Acima do sublimite: IBS e ICMS/ISS podem ser cobrados fora do Simples')).toBeTruthy();
    expect(screen.queryByText(/Acima do limite do Simples Nacional/)).toBeNull();
  });

  it('exatamente o sublimite não avisa', () => {
    montar();
    digitar(campoRbt12(), '3600000');
    expect(screen.queryByText(/Acima do sublimite/)).toBeNull();
  });

  it('acima de R$ 4.800.000,00 é erro e "Calcular" fica desabilitado', async () => {
    montar();
    digitar(campoRbt12(), '4.800.000,01');
    expect(screen.getByText(/Acima do limite do Simples Nacional \(R\$ 4\.800\.000,00\)/)).toBeTruthy();
    expect(botaoCalcular().disabled).toBe(true);
  });

  it('zero é erro e "Calcular" fica desabilitado', () => {
    montar();
    digitar(campoRbt12(), '0');
    expect(screen.getByText('Informe o faturamento dos últimos 12 meses (maior que zero).')).toBeTruthy();
    expect(botaoCalcular().disabled).toBe(true);
  });

  it('explica a definição do RBT12 de 2027 com a fonte', () => {
    montar();
    expect(screen.getByText(/Res\. CGSN 140, art\. 21, II, “a”, na redação da Res\. CGSN 190/)).toBeTruthy();
  });

  it('6ª faixa mostra a nota da interpretação do teto de 5% do ISS', async () => {
    montar();
    await escolherAtividade(/NFS-e/, '14');
    digitar(campoRbt12(), '4.000.000,00');
    expect(
      screen.getByText(
        '6ª faixa: o cálculo segue a interpretação do teto de 5% do ISS (Res. CGSN 190, art. 21, III). Confirme com seu contador.',
      ),
    ).toBeTruthy();
  });
});

describe('Confirmar — atividade do Simples', () => {
  it('um seletor por tipo de nota presente: NF-e/NFC-e juntos e NFS-e à parte', async () => {
    montar();
    expect(await screen.findByRole('button', { name: /Atividade das NF-e e NFC-e/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Atividade das NFS-e/ })).toBeTruthy();
  });

  it('só NF-e: não pede atividade de NFS-e', async () => {
    montar(soVendasNFe());
    expect(await screen.findByRole('button', { name: /Atividade das NF-e e NFC-e/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Atividade das NFS-e/ })).toBeNull();
  });

  it('filtra pelas atividades admissíveis ao tipo (mercadorias × serviços) e some a "não tributável"', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Atividade das NF-e e NFC-e/ }));
    const dialogo = await screen.findByRole('dialog');
    const nomes = within(dialogo)
      .getAllByRole('radio')
      .map((r) => r.getAttribute('aria-label') ?? r.textContent);
    expect(nomes.length).toBe(4);
    expect(within(dialogo).getByRole('radio', { name: /^01 / })).toBeTruthy();
    expect(within(dialogo).queryByRole('radio', { name: /^09 / })).toBeNull();
    expect(within(dialogo).queryByRole('radio', { name: /^90 / })).toBeNull();
    // até 8 opções não pedem busca
    expect(within(dialogo).queryByRole('searchbox')).toBeNull();
  });

  it('com mais de 8 opções aparece a busca, que filtra por código e descrição', async () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({
      ...atividadesJson[0],
      codigo: String(20 + i),
      descricao: i === 3 ? 'Venda de bicicletas' : `Revenda número ${i}`,
    }));
    respostas.atividades = () => json(muitas);
    montar(soVendasNFe());
    fireEvent.click(await screen.findByRole('button', { name: /Atividade das NF-e e NFC-e/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getAllByRole('radio').length).toBe(10);
    digitar(within(dialogo).getByRole('searchbox'), 'bicicleta');
    expect(within(dialogo).getAllByRole('radio').length).toBe(1);
    digitar(within(dialogo).getByRole('searchbox'), 'zzz');
    expect(within(dialogo).getByText('Nenhuma atividade encontrada.')).toBeTruthy();
  });

  it('escolher a atividade fecha o seletor e mostra o escolhido no botão', async () => {
    montar();
    await escolherAtividade(/Atividade das NF-e e NFC-e/, '01');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Atividade das NF-e e NFC-e.*01/ })).toBeTruthy();
  });

  it('erro ao carregar as atividades: mensagem e "Tentar novamente"', async () => {
    respostas.atividades = () => json({}, 500);
    montar();
    expect(await screen.findByText('Não foi possível carregar as atividades do Simples Nacional.')).toBeTruthy();
    respostas.atividades = () => json(atividadesJson);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('button', { name: /Atividade das NF-e e NFC-e/ })).toBeTruthy();
  });
});

describe('Confirmar — Fator R', () => {
  it('atividade com Fator R pede a folha de 12 meses e resolve o anexo (≥ 28% → III; abaixo → V)', async () => {
    montar();
    expect(screen.queryByLabelText('Folha de salários dos últimos 12 meses')).toBeNull();
    await escolherAtividade(/Atividade das NFS-e/, '09');
    digitar(campoRbt12(), '1.000.000,00');
    const folha = screen.getByLabelText('Folha de salários dos últimos 12 meses');
    digitar(folha, '280.000,00');
    expect(screen.getByText('Fator R de 28,0%: Anexo III.')).toBeTruthy();
    digitar(folha, '279.999,99');
    expect(screen.getByText('Fator R de 27,9%: Anexo V.')).toBeTruthy();
    digitar(folha, '100.000,00');
    expect(screen.getByText('Fator R de 10,0%: Anexo V.')).toBeTruthy();
  });

  it('atividade sem Fator R não pede a folha', async () => {
    montar();
    await escolherAtividade(/Atividade das NFS-e/, '14');
    expect(screen.queryByLabelText('Folha de salários dos últimos 12 meses')).toBeNull();
  });

  it('modo INDISPONIVEL explica e bloqueia o cálculo', async () => {
    respostas.atividades = () =>
      json(atividadesJson.map((a) => (a.codigo === '09' ? { ...a, modoFatorR: 'INDISPONIVEL', disponivel: false } : a)));
    montar();
    await escolherAtividade(/Atividade das NFS-e/, '09');
    digitar(campoRbt12(), '1.000.000,00');
    expect(screen.getByText(/não está disponível nos motores oficiais/)).toBeTruthy();
    expect(botaoCalcular().disabled).toBe(true);
  });

  it('obriga a folha quando a atividade pede Fator R', async () => {
    montar();
    await escolherAtividade(/Atividade das NF-e e NFC-e/, '01');
    await escolherAtividade(/Atividade das NFS-e/, '09');
    digitar(campoRbt12(), '1.000.000,00');
    expect(botaoCalcular().disabled).toBe(true);
    expect(screen.getByText('Informe a folha de salários dos últimos 12 meses.')).toBeTruthy();
  });
});

describe('Confirmar — compras', () => {
  it('sem notas de compra: pede "Compras ≈ % do faturamento" (padrão 40) com o selo "estimado"', () => {
    montar(soVendasNFe());
    const campo = screen.getByLabelText('Compras ≈ % do faturamento') as HTMLInputElement;
    expect(campo.value).toBe('40');
    expect(screen.getByText('estimado')).toBeTruthy();
    digitar(campo, '55');
    expect(campo.value).toBe('55');
  });

  it('com notas de compra: usa os créditos reais e não pede o percentual', () => {
    montar();
    expect(screen.queryByLabelText('Compras ≈ % do faturamento')).toBeNull();
    expect(screen.getByText(/Créditos calculados com 2 notas de compra/)).toBeTruthy();
  });

  it('percentual fora de 0 a 100 é erro e bloqueia', async () => {
    montar(soVendasNFe());
    digitar(screen.getByLabelText('Compras ≈ % do faturamento'), '150');
    expect(screen.getByText('Informe um percentual entre 0 e 100.')).toBeTruthy();
    expect(botaoCalcular().disabled).toBe(true);
  });
});

describe('Confirmar — classificação IBS/CBS', () => {
  it('agrupa por NCM/NBS com itens e valor, sugestão pré-selecionada e origem; permite trocar a opção', async () => {
    montar();
    const lista = await screen.findByRole('region', { name: 'Classificação IBS/CBS' });
    // NCM: 2 itens de venda (300) + 2 de compra (100) = 400; NBS: 500; x1 não entra? (ignorado só some se for outra empresa)
    expect(within(lista).getByText('NCM 6109.10.00')).toBeTruthy();
    expect(within(lista).getByText('4 itens · tabela oficial')).toBeTruthy();
    expect(within(lista).getByText('R$ 400,00')).toBeTruthy();
    expect(within(lista).getByText('NBS 101011000')).toBeTruthy();
    expect(within(lista).getByText('1 item · padrão')).toBeTruthy();
    // ordenado por valor: NBS (500) vem antes do NCM (400)
    const titulos = within(lista)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(titulos[0]).toContain('NBS 101011000');

    const grupo = within(lista).getByRole('radiogroup', { name: 'Classificação de NCM 6109.10.00' });
    expect(within(grupo).getByRole('radio', { name: '000001' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(grupo).getByRole('radio', { name: '200003' }));
    expect(within(grupo).getByRole('radio', { name: '200003' }).getAttribute('aria-checked')).toBe('true');
    expect(within(lista).getByText(/Redução de 60%/)).toBeTruthy();
  });

  it('erro ao carregar as sugestões: mensagem e "Tentar novamente"', async () => {
    respostas.sugestoes = () => json({}, 500);
    montar();
    expect(await screen.findByText('Não foi possível carregar as sugestões de classificação.')).toBeTruthy();
    respostas.sugestoes = () => json(SUGESTOES);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('region', { name: 'Classificação IBS/CBS' })).toBeTruthy();
  });

  it('com ~200 grupos mostra uma página por vez, "Mostrar mais" e busca por código', async () => {
    const itens = Array.from({ length: 200 }, (_, i) =>
      itemDoc(i + 1, 1000 - i, { ncm: String(10000000 + i * 7) }),
    );
    montar({ documentos: [doc('v1', 'NFE', EMPRESA, undefined, itens)], ignorados: [] });
    const lista = await screen.findByRole('region', { name: 'Classificação IBS/CBS' });
    expect(within(lista).getAllByRole('listitem').length).toBe(25);
    expect(within(lista).getByText('200 grupos')).toBeTruthy();
    fireEvent.click(within(lista).getByRole('button', { name: /Mostrar mais 25 de 175/ }));
    expect(within(lista).getAllByRole('listitem').length).toBe(50);

    digitar(within(lista).getByRole('searchbox', { name: 'Buscar NCM ou NBS' }), '10000070');
    expect(within(lista).getAllByRole('listitem').length).toBe(1);
    digitar(within(lista).getByRole('searchbox', { name: 'Buscar NCM ou NBS' }), '99999999');
    expect(within(lista).getByText('Nenhum grupo encontrado.')).toBeTruthy();
  });
});

describe('Confirmar — calcular', () => {
  it('entrega parâmetros completos (classificações, atividade por tipo, alíquotas) e compras estimadas com a alíquota nominal', async () => {
    const { aoConfirmar } = montar({
      documentos: [
        doc('v1', 'NFE', EMPRESA, undefined, [itemDoc(1, 100)]),
        doc('v2', 'NFCE', EMPRESA, undefined, [itemDoc(1, 100)]),
        doc('v3', 'NFSE', EMPRESA, undefined, [itemDoc(1, 100, NBS)]),
      ],
      ignorados: [],
    });
    await screen.findByRole('region', { name: 'Classificação IBS/CBS' });
    await escolherAtividade(/Atividade das NF-e e NFC-e/, '01');
    await escolherAtividade(/Atividade das NFS-e/, '07');
    expect(botaoCalcular().disabled).toBe(true);
    digitar(campoRbt12(), '1.000.000,00');
    fireEvent.click(within(screen.getByRole('region', { name: 'Classificação IBS/CBS' })).getByRole('radio', { name: '200003' }));
    await waitFor(() => expect(botaoCalcular().disabled).toBe(false));
    fireEvent.click(botaoCalcular());
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1));

    const r = aoConfirmar.mock.calls[0][0];
    expect(r.cnpjEmpresa).toBe(EMPRESA);
    expect(r.parametros.atividadePorTipo).toEqual({ NFE: '01', NFCE: '01', NFSE: '07' });
    expect(Object.keys(r.parametros.aliquotasSimples).sort()).toEqual(['01', '07']);
    expect(r.parametros.aliquotasSimples['01'].anexo).toBe('I');
    expect(r.parametros.aliquotasSimples['07'].anexo).toBe('III');
    expect(r.parametros.classificacoes['NCM:61091000'].cClassTrib).toBe('200003');
    expect(r.parametros.classificacoes['NBS:101011000'].cClassTrib).toBe('000001');
    expect(r.origemCompras.tipo).toBe('ESTIMADA');
    if (r.origemCompras.tipo === 'ESTIMADA') {
      expect(r.origemCompras.percentualSobreFaturamento.eq(40)).toBe(true);
      expect(r.origemCompras.aliquotaNominalTotal.eq('8.9')).toBe(true);
    }
  });

  it('com notas de compra a origem é REAL', async () => {
    const { aoConfirmar } = montar();
    await screen.findByRole('region', { name: 'Classificação IBS/CBS' });
    await escolherAtividade(/Atividade das NF-e e NFC-e/, '01');
    await escolherAtividade(/Atividade das NFS-e/, '07');
    digitar(campoRbt12(), '500000');
    await waitFor(() => expect(botaoCalcular().disabled).toBe(false));
    fireEvent.click(botaoCalcular());
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1));
    expect(aoConfirmar.mock.calls[0][0].origemCompras.tipo).toBe('REAL');
  });

  it('desabilitado, diz o que falta', async () => {
    montar();
    expect(botaoCalcular().disabled).toBe(true);
    expect(screen.getByText('Informe o faturamento dos últimos 12 meses.')).toBeTruthy();
  });
});
