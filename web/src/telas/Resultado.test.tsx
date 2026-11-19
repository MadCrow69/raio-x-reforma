import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Big from 'big.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinhaAuditoria } from '../auditoria/auditar';
import type { ResultadoSimulacao } from '../simulacao/simular';
import Resultado from './Resultado';

afterEach(cleanup);

const SIMULACAO: ResultadoSimulacao = {
  meses: ['2027-01'],
  faturamentoMes: Big(1000),
  simples: { impostoMes: Big(100), creditoClientePJMes: Big(40) },
  regular: { impostoMes: Big(50), creditoClientePJMes: Big(100) },
  diferencaMes: Big(50),
  veredito: 'REGULAR_TENDE_MELHOR',
  origemCompras: 'ESTIMADA',
  percentualPJ: Big(50),
  notas2026Simuladas: false,
  itensExcluidos: 1,
};

const linha = (item: number, achado: LinhaAuditoria['achado']): LinhaAuditoria => ({
  chave: 'c',
  numeroNota: '1',
  papel: 'VENDA',
  tipo: 'NFE',
  item,
  descricao: `Item ${item}`,
  ncmOuNbs: '61091000',
  cst: '000',
  cClassTrib: '000001',
  estado: 'CALCULO_SIMULADO',
  achado,
  erros: [],
  vMotor: Big(0),
  memoria: 'memória',
});

const props = () => ({
  cnpjEmpresa: '11222333000181',
  simulacao: SIMULACAO,
  auditoria: [linha(1, 'OK'), linha(2, 'VALOR_DIVERGENTE'), linha(3, 'NAO_CALCULADO')],
  sextaFaixa: false,
  aoNovaAnalise: vi.fn(),
});

describe('Resultado', () => {
  it('abas Resumo | Auditoria N | Memória de cálculo, com tabpanel ligado à aba selecionada', () => {
    render(<Resultado {...props()} />);
    const abas = screen.getAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual(['Resumo', 'Auditoria2', 'Memória de cálculo']);
    expect(abas[0].getAttribute('aria-selected')).toBe('true');
    const painel = screen.getByRole('tabpanel');
    expect(painel.getAttribute('aria-labelledby')).toBe(abas[0].id);
    expect(abas[0].getAttribute('aria-controls')).toBe(painel.id);
    expect(screen.getByRole('heading', { name: 'O regime regular tende a ser melhor' })).toBeTruthy();
  });

  it('mostra o CNPJ formatado e "Nova análise" dispara o reinício', () => {
    const p = props();
    render(<Resultado {...p} />);
    expect(screen.getByText('11.222.333/0001-81')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nova análise' }));
    expect(p.aoNovaAnalise).toHaveBeenCalledTimes(1);
  });

  it('aba Auditoria mostra a tabela com a contagem real e troca de painel', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Auditoria/ }));
    const painel = screen.getByRole('tabpanel');
    expect(painel.textContent).toContain('3 itens analisados');
    expect(painel.textContent).toContain('2 com achado');
    expect(within(painel).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'O regime regular tende a ser melhor' })).toBeNull();
  });

  it('aba Memória de cálculo lista os itens com memória', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Memória de cálculo' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('3 itens com memória');
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('clicar numa linha da Auditoria abre a Memória só daquele item; "Ver todos os itens" volta à lista', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Auditoria/ }));
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('row')[2]);
    expect(screen.getByRole('tab', { name: 'Memória de cálculo' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os itens' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('busca e filtros da Auditoria sobrevivem à troca de aba', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Auditoria/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Item 2' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Resumo' }));
    fireEvent.click(screen.getByRole('tab', { name: /Auditoria/ }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Item 2');
  });

  it('o atalho de itens excluídos abre a Auditoria filtrada em não calculado / erro do motor', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    expect(screen.getByRole('tab', { name: /Auditoria/ }).getAttribute('aria-selected')).toBe('true');
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain('Não calculado');
    expect(screen.getByRole('button', { name: 'Remover filtro Achado: Não calculado' })).toBeTruthy();
  });

  it('o atalho de compras sem crédito abre a Auditoria só com compras sem cálculo', () => {
    const p = props();
    const compra = { ...linha(4, 'NAO_CALCULADO'), papel: 'COMPRA' as const };
    const venda = { ...linha(5, 'ERRO_MOTOR') };
    render(
      <Resultado
        {...p}
        simulacao={{ ...SIMULACAO, itensExcluidos: 0, origemCompras: 'REAL' }}
        comprasSemCredito={1}
        auditoria={[...p.auditoria, compra, venda]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    const linhas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain('Compra');
    expect(screen.getByRole('button', { name: 'Remover filtro Papel: Compra' })).toBeTruthy();
  });
});
