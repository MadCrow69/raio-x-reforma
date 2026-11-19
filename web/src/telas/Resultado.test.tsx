import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('aba Auditoria mostra a contagem real e "Exportar CSV" desabilitado; troca de painel', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Auditoria/ }));
    const painel = screen.getByRole('tabpanel');
    expect(painel.textContent).toContain('3 itens analisados');
    expect(painel.textContent).toContain('2 com achado');
    expect((screen.getByRole('button', { name: 'Exportar CSV' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('heading', { name: 'O regime regular tende a ser melhor' })).toBeNull();
  });

  it('aba Memória de cálculo mostra quantos itens têm memória do motor', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Memória de cálculo' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('3 itens com memória de cálculo');
  });

  it('o atalho do Resumo para itens excluídos abre a Auditoria', () => {
    render(<Resultado {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    expect(screen.getByRole('tab', { name: /Auditoria/ }).getAttribute('aria-selected')).toBe('true');
  });
});
