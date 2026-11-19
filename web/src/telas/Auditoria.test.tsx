import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Big from 'big.js';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Achado, LinhaAuditoria } from '../auditoria/auditar';
import { paraCsv } from '../auditoria/csv';
import { ESTADO_AUDITORIA_INICIAL, type EstadoAuditoria } from '../auditoria/tabela';
import Auditoria from './Auditoria';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ACHADOS: Achado[] = ['OK', 'VALOR_DIVERGENTE', 'ERRO_MOTOR', 'NAO_CALCULADO', 'SEM_GRUPO_NA_NOTA'];

/** 200 linhas: 100 vendas e 100 compras, achados em rodízio; valores como 9,5 e 100,5 distinguem número de texto. */
function gerar(n = 200): LinhaAuditoria[] {
  return Array.from({ length: n }, (_, i) => {
    const achado = ACHADOS[i % 5];
    const erro = achado === 'ERRO_MOTOR';
    return {
      chave: `CH${Math.floor(i / 4)}`,
      numeroNota: String(1000 + (i % 37)),
      papel: i % 2 === 0 ? 'VENDA' : 'COMPRA',
      tipo: (['NFE', 'NFCE', 'NFSE'] as const)[i % 3],
      item: (i % 12) + 1,
      descricao: `Produto ${String(i).padStart(3, '0')} ${i === 7 ? 'Água mineral' : 'genérico'}`,
      ncmOuNbs: i % 3 === 0 ? '22011000' : '61091000',
      cst: '000',
      cClassTrib: i % 2 === 0 ? '000001' : '200003',
      estado: achado === 'NAO_CALCULADO' ? 'NAO_CALCULADO' : erro ? 'INCONSISTENCIA_ENTRADA' : 'CALCULO_SIMULADO',
      achado,
      erros: erro
        ? [{ code: i % 10 === 2 ? 'ERR-A' : 'ERR-B', title: i % 10 === 2 ? 'NCM inválido' : 'Alíquota ausente', detail: 'detalhe' }]
        : [],
      vNota: achado === 'SEM_GRUPO_NA_NOTA' ? undefined : Big(i % 2 === 0 ? '9.5' : '100.5').plus(i),
      vMotor: achado === 'NAO_CALCULADO' || erro ? Big(0) : Big(i).plus('0.25'),
      diferenca: achado === 'VALOR_DIVERGENTE' ? Big(i).minus(300) : undefined,
      memoria: `memória ${i}`,
    };
  });
}

function Harness({ linhas, aoAbrirMemoria = () => {}, inicial }: { linhas: LinhaAuditoria[]; aoAbrirMemoria?: (l: LinhaAuditoria) => void; inicial?: Partial<EstadoAuditoria> }) {
  const [estado, setEstado] = useState<EstadoAuditoria>({ ...ESTADO_AUDITORIA_INICIAL, ...inicial });
  return <Auditoria linhas={linhas} estado={estado} aoMudarEstado={setEstado} aoAbrirMemoria={aoAbrirMemoria} />;
}

const tabela = () => screen.getByRole('table');
const linhasDaTabela = () => within(tabela()).getAllByRole('row').slice(1);
const dimensao = (nome: RegExp) => within(screen.getByRole('group', { name: 'Filtrar por' })).getByRole('button', { name: nome });
const celulas = (tr: HTMLElement) => within(tr).getAllByRole('cell');

describe('Auditoria: paginação', () => {
  it('mostra 20 por página por padrão e oferece 20/50/100', () => {
    render(<Harness linhas={gerar()} />);
    expect(linhasDaTabela()).toHaveLength(20);
    expect(screen.getByText('1–20 de 200 itens')).toBeTruthy();
    const tamanho = screen.getByLabelText('Itens por página') as HTMLSelectElement;
    expect([...tamanho.options].map((o) => o.value)).toEqual(['20', '50', '100']);
    fireEvent.change(tamanho, { target: { value: '50' } });
    expect(linhasDaTabela()).toHaveLength(50);
    fireEvent.change(tamanho, { target: { value: '100' } });
    expect(linhasDaTabela()).toHaveLength(100);
  });

  it('navega entre páginas e volta à 1ª ao mudar a busca', () => {
    render(<Harness linhas={gerar()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText('21–40 de 200 itens')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'genérico' } });
    expect(screen.getByText(/^1–20 de /)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Página anterior' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Auditoria: ordenação', () => {
  it('toda coluna de dado é ordenável, com aria-sort', () => {
    render(<Harness linhas={gerar()} />);
    const titulos = ['Nota', 'Papel', 'Tipo', 'Item', 'Descrição', 'NCM/NBS', 'CST', 'cClassTrib', 'Achado', 'Código de erro', 'Valor na nota', 'Valor do motor', 'Diferença'];
    for (const t of titulos) {
      const th = within(tabela()).getByRole('columnheader', { name: t });
      expect(th.getAttribute('aria-sort')).toBe('none');
      expect(within(th).getByRole('button')).toBeTruthy();
    }
  });

  it('ordena valores monetários como número (9,5 antes de 100,5), asc e desc, estável', () => {
    render(<Harness linhas={gerar()} />);
    const th = within(tabela()).getByRole('columnheader', { name: 'Valor na nota' });
    fireEvent.click(within(th).getByRole('button'));
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    const vals = linhasDaTabela().map((tr) => celulas(tr)[10].textContent);
    expect(vals[0]).toBe('R$ 9,50');
    fireEvent.click(within(th).getByRole('button'));
    expect(th.getAttribute('aria-sort')).toBe('descending');
    expect(celulas(linhasDaTabela()[0])[10].textContent).toBe('R$ 297,50');
  });

  it('ordena o item como número (2 antes de 10) e texto em pt-BR', () => {
    render(<Harness linhas={gerar()} />);
    const th = within(tabela()).getByRole('columnheader', { name: 'Item' });
    fireEvent.click(within(th).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    const itens = linhasDaTabela().map((tr) => Number(celulas(tr)[3].textContent));
    expect(itens.every((v, i) => i === 0 || v >= itens[i - 1])).toBe(true);
    const descr = within(tabela()).getByRole('columnheader', { name: 'Descrição' });
    fireEvent.click(within(descr).getByRole('button'));
    expect(descr.getAttribute('aria-sort')).toBe('ascending');
    expect(within(th).getByRole('button')).toBeTruthy();
    expect(th.getAttribute('aria-sort')).toBe('none');
  });

  it('valor ausente fica sempre por último, nos dois sentidos', () => {
    render(<Harness linhas={gerar()} />);
    const th = within(tabela()).getByRole('columnheader', { name: 'Diferença' });
    fireEvent.click(within(th).getByRole('button'));
    expect(celulas(linhasDaTabela()[0])[12].textContent).not.toBe('—');
    fireEvent.click(within(th).getByRole('button'));
    expect(celulas(linhasDaTabela()[0])[12].textContent).not.toBe('—');
  });
});

describe('Auditoria: busca e filtros', () => {
  it('busca única por nota, descrição (sem acento), NCM/NBS e cClassTrib', () => {
    render(<Harness linhas={gerar()} />);
    const busca = screen.getByRole('searchbox');
    fireEvent.change(busca, { target: { value: 'agua mineral' } });
    expect(linhasDaTabela()).toHaveLength(1);
    fireEvent.change(busca, { target: { value: '1005' } });
    expect(linhasDaTabela().every((tr) => celulas(tr)[0].textContent === '1005')).toBe(true);
    fireEvent.change(busca, { target: { value: '22011000' } });
    expect(screen.getByText(/de 67 itens/)).toBeTruthy();
    fireEvent.change(busca, { target: { value: '200003' } });
    expect(screen.getByText(/de 100 itens/)).toBeTruthy();
  });

  it('botão Filtros com contador abre a barra com um botão por dimensão', () => {
    render(<Harness linhas={gerar()} />);
    const botao = screen.getByRole('button', { name: /^Filtros/ });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    for (const d of ['Achado', 'Código de erro', 'Papel', 'Tipo de nota']) {
      expect(dimensao(new RegExp(`^${d}`))).toBeTruthy();
    }
  });

  it('filtra por Achado com contagem por opção, contador e pílula removível', () => {
    render(<Harness linhas={gerar()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(dimensao(/^Achado/));
    const opcao = screen.getByRole('checkbox', { name: /Erro do motor/ });
    expect(opcao.closest('label')!.textContent).toContain('40');
    fireEvent.click(opcao);
    expect(screen.getByText('1–20 de 40 itens')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtros/ }).textContent).toContain('1');
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ })); // fecha a barra: os filtros viram pílulas
    const pilula = screen.getByRole('button', { name: 'Remover filtro Achado: Erro do motor' });
    fireEvent.click(pilula);
    expect(screen.getByText('1–20 de 200 itens')).toBeTruthy();
  });

  it('filtra por código de erro, papel e tipo de nota, combinando com E', () => {
    render(<Harness linhas={gerar()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(dimensao(/^Código de erro/));
    fireEvent.click(screen.getByRole('checkbox', { name: /ERR-A/ }));
    const soErrA = Number(/de (\d+) itens/.exec(document.body.textContent ?? '')![1]);
    expect(soErrA).toBeGreaterThan(0);
    expect(soErrA).toBeLessThan(40);
    fireEvent.click(dimensao(/^Papel/));
    fireEvent.click(screen.getByRole('checkbox', { name: /Venda/ }));
    expect(linhasDaTabela().every((tr) => celulas(tr)[1].textContent === 'Venda')).toBe(true);
    fireEvent.click(dimensao(/^Tipo de nota/));
    fireEvent.click(screen.getByRole('checkbox', { name: /NF-e/ }));
    expect(linhasDaTabela().every((tr) => celulas(tr)[2].textContent === 'NF-e')).toBe(true);
  });

  it('"Limpar" da dimensão zera só aquela dimensão', () => {
    render(<Harness linhas={gerar()} inicial={{ filtros: { achado: ['OK'], erro: [], papel: ['COMPRA'], tipo: [] } }} />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    fireEvent.click(dimensao(/^Achado/));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar Achado' }));
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    expect(screen.queryByRole('button', { name: /Remover filtro Achado/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remover filtro Papel: Compra' })).toBeTruthy();
  });
});

describe('Auditoria: estados', () => {
  it('vazio de filtro tem mensagem própria e "Limpar filtros" restaura a lista', () => {
    render(<Harness linhas={gerar()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(screen.getByText('Nenhum item para estes filtros')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('1–20 de 200 itens')).toBeTruthy();
  });

  it('vazio de dados é outra mensagem, sem "Limpar filtros"', () => {
    render(<Harness linhas={[]} />);
    expect(screen.getByText('Nenhum item foi analisado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Exportar CSV' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Auditoria: linha', () => {
  it('mostra código e título do erro, "—" no valor do motor sem cálculo e achado em texto', () => {
    render(<Harness linhas={gerar()} inicial={{ filtros: { achado: ['ERRO_MOTOR'], erro: [], papel: [], tipo: [] }, ordem: { coluna: 'item', direcao: 'asc' } }} />);
    const tr = linhasDaTabela()[0];
    const c = celulas(tr);
    expect(c[9].textContent).toContain('ERR-');
    expect(c[9].textContent).toMatch(/NCM inválido|Alíquota ausente/);
    expect(c[9].getAttribute('title')).toMatch(/ERR-/);
    expect(c[11].textContent).toBe('—');
    expect(c[8].textContent).toBe('Erro do motor');
    expect(c[4].getAttribute('title')).toBe(c[4].textContent);
  });

  it('clicar na linha abre a memória daquele item', () => {
    const aoAbrirMemoria = vi.fn();
    const linhas = gerar();
    render(<Harness linhas={linhas} aoAbrirMemoria={aoAbrirMemoria} />);
    fireEvent.click(linhasDaTabela()[2]);
    expect(aoAbrirMemoria).toHaveBeenCalledWith(linhas[2]);
  });

  it('a nota é um botão que abre a memória (teclado)', () => {
    const aoAbrirMemoria = vi.fn();
    render(<Harness linhas={gerar()} aoAbrirMemoria={aoAbrirMemoria} />);
    fireEvent.click(within(linhasDaTabela()[0]).getByRole('button', { name: /memória de cálculo/i }));
    expect(aoAbrirMemoria).toHaveBeenCalledTimes(1);
  });

  it('celular: cada linha tem um cartão, trocado pela largura do contêiner (container query < 640 px)', () => {
    render(<Harness linhas={gerar()} />);
    expect(screen.getByRole('list', { name: 'Itens da auditoria' }).querySelectorAll('li')).toHaveLength(20);
    const css = readFileSync('src/ui/componentes/Tabela.css', 'utf-8');
    expect(css).toMatch(/@container[^{]*max-width:\s*639px/);
    expect(css).toMatch(/container-type:\s*inline-size/);
  });
});

describe('Auditoria: exportar CSV', () => {
  it('baixa raio-x-auditoria.csv só com as linhas filtradas', async () => {
    const linhas = gerar();
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    let nome = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nome = this.download;
    });
    render(<Harness linhas={linhas} inicial={{ filtros: { achado: ['ERRO_MOTOR'], erro: [], papel: [], tipo: [] } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(nome).toBe('raio-x-auditoria.csv');
    const esperado = paraCsv(linhas.filter((l) => l.achado === 'ERRO_MOTOR'));
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob!.arrayBuffer())).toBe(esperado);
    expect(blob!.type).toContain('text/csv');
    expect(screen.getByText('CSV exportado · 40 itens')).toBeTruthy();
  });
});
