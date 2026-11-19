import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Big from 'big.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParametrosCalculo } from '../motor/tipos';
import type { ResultadoSimulacao } from '../simulacao/simular';

const analisarMock = vi.hoisted(() => vi.fn());
vi.mock('../simulacao/analisar', async (original) => ({
  ...(await original<typeof import('../simulacao/analisar')>()),
  analisar: analisarMock,
}));

import { FalhaDoMotor } from '../simulacao/analisar';
import Calculando from './Calculando';

const PARAMETROS: ParametrosCalculo = { classificacoes: {}, atividadePorTipo: {}, aliquotasSimples: {} };
const SIMULACAO = { veredito: 'EMPATE' } as ResultadoSimulacao;

const props = () => ({
  vendas: [],
  compras: [],
  parametros: PARAMETROS,
  origemCompras: { tipo: 'REAL', creditos: Big(0), meses: [] as string[] } as const,
  aoConcluir: vi.fn(),
  aoVoltar: vi.fn(),
});

beforeEach(() => {
  analisarMock.mockReset();
});
afterEach(cleanup);

describe('Calculando', () => {
  it('mostra o progresso "N de M notas" enquanto calcula e entrega o resultado ao terminar', async () => {
    let progresso!: (f: number, t: number) => void;
    let concluir!: (r: unknown) => void;
    analisarMock.mockImplementation((_e, aoProgredir) => {
      progresso = aoProgredir;
      return new Promise((resolve) => (concluir = resolve));
    });
    const p = props();
    render(<Calculando {...p} />);
    expect(screen.getByRole('heading', { name: /Calculando/ })).toBeTruthy();
    act(() => progresso(12, 340));
    expect(screen.getByText('12 de 340 notas')).toBeTruthy();
    const resultado = { auditoria: [], simulacao: SIMULACAO, comprasSemCredito: 2 };
    await act(async () => concluir(resultado));
    expect(p.aoConcluir).toHaveBeenCalledWith(resultado.auditoria, SIMULACAO, 2);
  });

  it('RangeError do simular: mensagem dele, sem veredito, "Voltar e revisar" volta ao passo 2', async () => {
    analisarMock.mockRejectedValue(new RangeError('Nenhum item foi calculado nos dois cenários; não há base para comparar.'));
    const p = props();
    render(<Calculando {...p} />);
    expect(await screen.findByText(/Nenhum item foi calculado nos dois cenários/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar e revisar' }));
    expect(p.aoVoltar).toHaveBeenCalledTimes(1);
    expect(p.aoConcluir).not.toHaveBeenCalled();
  });

  it('falha geral do motor: "Tentar novamente" recalcula', async () => {
    analisarMock.mockRejectedValueOnce(new FalhaDoMotor()).mockImplementation(() => new Promise(() => {}));
    render(<Calculando {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(analisarMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
  });

  it('erro inesperado também oferece "Tentar novamente"', async () => {
    analisarMock.mockRejectedValue(new Error('boom'));
    render(<Calculando {...props()} />);
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });
});
