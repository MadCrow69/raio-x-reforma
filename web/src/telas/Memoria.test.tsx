import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Big from 'big.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinhaAuditoria } from '../auditoria/auditar';
import Memoria from './Memoria';

afterEach(cleanup);

const linha = (i: number, extra: Partial<LinhaAuditoria> = {}): LinhaAuditoria => ({
  chave: `CH${i}`,
  numeroNota: String(500 + i),
  papel: i % 2 === 0 ? 'VENDA' : 'COMPRA',
  tipo: 'NFE',
  item: 1,
  descricao: `Produto ${i}`,
  ncmOuNbs: '61091000',
  cst: '000',
  cClassTrib: '000001',
  estado: 'CALCULO_SIMULADO',
  achado: 'OK',
  erros: [],
  vMotor: Big(1),
  origemMemoria: i % 2 === 0 ? 'COMPOSTA' : 'MOTOR',
  memoria: i === 3 ? 'CBS 0,9% sobre a base de R$ 100,00' : `memória do item ${i}`,
  ...extra,
});

const lote = (n = 60) => Array.from({ length: n }, (_, i) => linha(i));

describe('Memoria', () => {
  it('lista 20 itens por vez, cada um com o texto da memória', () => {
    render(<Memoria linhas={lote()} foco={null} aoLimparFoco={() => {}} />);
    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(screen.getByText('memória do item 0')).toBeTruthy();
    expect(screen.getByText('1–20 de 60 itens')).toBeTruthy();
  });

  it('rotula a origem: venda é composta pelo Raio-X, compra é do motor oficial', () => {
    render(<Memoria linhas={[linha(0), linha(1)]} foco={null} aoLimparFoco={() => {}} />);
    const [venda, compra] = screen.getAllByRole('article');
    expect(within(venda).getByText('Composta pelo Raio-X a partir da resposta do motor')).toBeTruthy();
    expect(within(venda).queryByText('Memória do motor oficial')).toBeNull();
    expect(within(compra).getByText('Memória do motor oficial')).toBeTruthy();
  });

  it('lê a origem declarada no item, não o papel; sem origem, não rotula', () => {
    const invertida = linha(0, { origemMemoria: 'MOTOR' }); // venda cuja memória veio do motor
    const sem = linha(2, { origemMemoria: undefined });
    render(<Memoria linhas={[invertida, sem]} foco={null} aoLimparFoco={() => {}} />);
    const [a, b] = screen.getAllByRole('article');
    expect(within(a).getByText('Memória do motor oficial')).toBeTruthy();
    expect(within(b).queryByText('Memória do motor oficial')).toBeNull();
    expect(within(b).queryByText('Composta pelo Raio-X a partir da resposta do motor')).toBeNull();
  });

  it('busca no texto da memória, na nota e na descrição (sem acento)', () => {
    render(<Memoria linhas={lote()} foco={null} aoLimparFoco={() => {}} />);
    const busca = screen.getByRole('searchbox');
    fireEvent.change(busca, { target: { value: 'base de r$ 100' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(busca, { target: { value: '510' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(busca, { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum item para esta busca')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('com foco mostra só aquele item e permite voltar a todos', () => {
    const aoLimparFoco = vi.fn();
    render(<Memoria linhas={lote()} foco={{ chave: 'CH3', item: 1 }} aoLimparFoco={aoLimparFoco} />);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('CBS 0,9% sobre a base de R$ 100,00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os itens' }));
    expect(aoLimparFoco).toHaveBeenCalledTimes(1);
  });

  it('item em foco sem memória explica o motivo e mostra os erros do motor', () => {
    const sem = linha(9, {
      memoria: '',
      achado: 'ERRO_MOTOR',
      estado: 'INCONSISTENCIA_ENTRADA',
      erros: [{ code: 'ERR-1', title: 'NCM inválido', detail: 'O NCM informado não existe.' }],
    });
    render(<Memoria linhas={[linha(0), sem]} foco={{ chave: 'CH9', item: 1 }} aoLimparFoco={() => {}} />);
    expect(screen.getByText('O motor não devolveu memória de cálculo para este item.')).toBeTruthy();
    expect(screen.getByText(/ERR-1/)).toBeTruthy();
    expect(screen.getByText(/O NCM informado não existe\./)).toBeTruthy();
  });

  it('sem nenhuma memória, diz que não há o que mostrar', () => {
    render(<Memoria linhas={[linha(0, { memoria: '' })]} foco={null} aoLimparFoco={() => {}} />);
    expect(screen.getByText('Nenhum item tem memória de cálculo')).toBeTruthy();
  });
});
