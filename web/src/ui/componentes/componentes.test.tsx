import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Aviso, { DURACAO_AVISO_MS } from './Aviso';
import Folha from './Folha';
import Segmentado from './Segmentado';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Segmentado', () => {
  function Abas() {
    const [valor, setValor] = useState('resumo');
    return (
      <Segmentado
        rotulo="Visão do resultado"
        valor={valor}
        aoMudar={setValor}
        opcoes={[
          { valor: 'resumo', rotulo: 'Resumo' },
          { valor: 'auditoria', rotulo: 'Auditoria', contador: 14 },
          { valor: 'memoria', rotulo: 'Memória de cálculo' },
        ]}
      />
    );
  }

  it('é um tablist; só a aba selecionada entra no Tab; setas mudam e focam a aba (com volta ao início)', () => {
    render(<Abas />);
    expect(screen.getByRole('tablist', { name: 'Visão do resultado' })).toBeTruthy();
    const [resumo, auditoria, memoria] = screen.getAllByRole('tab');
    expect(resumo.getAttribute('aria-selected')).toBe('true');
    expect(resumo.tabIndex).toBe(0);
    expect(auditoria.tabIndex).toBe(-1);

    fireEvent.keyDown(resumo, { key: 'ArrowRight' });
    expect(auditoria.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(auditoria);

    fireEvent.keyDown(auditoria, { key: 'End' });
    expect(memoria.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(memoria, { key: 'ArrowRight' });
    expect(resumo.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(resumo, { key: 'ArrowLeft' });
    expect(memoria.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Folha', () => {
  function ComFolha() {
    const [aberta, setAberta] = useState(false);
    return (
      <>
        <button onClick={() => setAberta(true)}>Abrir</button>
        <Folha aberta={aberta} titulo="Classificação" aoFechar={() => setAberta(false)}>
          <button>Primeiro</button>
          <button>Último</button>
        </Folha>
      </>
    );
  }

  it('abre como diálogo modal, foca dentro, prende o Tab, fecha no Esc e devolve o foco', () => {
    render(<ComFolha />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    abrir.focus();
    fireEvent.click(abrir);

    const dialogo = screen.getByRole('dialog', { name: 'Classificação' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    expect(document.activeElement).toBe(fechar);

    const ultimo = screen.getByRole('button', { name: 'Último' });
    ultimo.focus();
    fireEvent.keyDown(dialogo, { key: 'Tab' });
    expect(document.activeElement).toBe(fechar);
    fireEvent.keyDown(dialogo, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);

    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });
});

describe('Aviso', () => {
  it('aviso comum fica numa região polite e some sozinho em 5 s', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();
    render(<Aviso aviso={{ tipo: 'sucesso', titulo: '3 notas lidas' }} aoFechar={aoFechar} />);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('3 notas lidas')).toBeTruthy();
    act(() => vi.advanceTimersByTime(DURACAO_AVISO_MS - 1));
    expect(aoFechar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('pausa enquanto o mouse está em cima e retoma ao sair', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();
    render(<Aviso aviso={{ tipo: 'info', titulo: 'Lido' }} aoFechar={aoFechar} />);
    const caixa = screen.getByText('Lido').closest('.aviso') as HTMLElement;
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.mouseEnter(caixa);
    act(() => vi.advanceTimersByTime(10_000));
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.mouseLeave(caixa);
    act(() => vi.advanceTimersByTime(DURACAO_AVISO_MS));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('erro não some sozinho e fecha pelo botão', () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();
    render(<Aviso aviso={{ tipo: 'erro', titulo: 'Não foi possível ler os arquivos' }} aoFechar={aoFechar} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
