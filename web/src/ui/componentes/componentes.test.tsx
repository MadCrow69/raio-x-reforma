import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Aviso, { DURACAO_AVISO_MS } from './Aviso';
import Folha from './Folha';
import { idAba, idPainel } from './idsAbas';
import Segmentado from './Segmentado';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Segmentado', () => {
  const OPCOES = [
    { valor: 'resumo', rotulo: 'Resumo' },
    { valor: 'auditoria', rotulo: 'Auditoria', contador: 14 },
    { valor: 'memoria', rotulo: 'Memória de cálculo' },
  ];

  function Abas() {
    const [valor, setValor] = useState('resumo');
    return (
      <>
        <Segmentado modo="abas" idBase="res" rotulo="Visão do resultado" valor={valor} aoMudar={setValor} opcoes={OPCOES} />
        <div role="tabpanel" id={idPainel('res', valor)} aria-labelledby={idAba('res', valor)}>
          conteúdo de {valor}
        </div>
      </>
    );
  }

  function Escolha() {
    const [valor, setValor] = useState('todos');
    return (
      <Segmentado
        modo="escolha"
        rotulo="Papel"
        valor={valor}
        aoMudar={setValor}
        opcoes={[
          { valor: 'todos', rotulo: 'Todos' },
          { valor: 'vendas', rotulo: 'Vendas' },
          { valor: 'compras', rotulo: 'Compras' },
        ]}
      />
    );
  }

  it('abas: tablist; aba ↔ painel ligados por id (aria-controls/aria-labelledby); setas e Home/End com volta ao início', () => {
    render(<Abas />);
    expect(screen.getByRole('tablist', { name: 'Visão do resultado' })).toBeTruthy();
    const [resumo, auditoria, memoria] = screen.getAllByRole('tab');
    expect(resumo.id).toBe(idAba('res', 'resumo'));
    expect(resumo.getAttribute('aria-controls')).toBe(idPainel('res', 'resumo'));
    expect(screen.getByRole('tabpanel', { name: 'Resumo' }).textContent).toBe('conteúdo de resumo');
    expect(resumo.getAttribute('aria-selected')).toBe('true');
    expect(resumo.tabIndex).toBe(0);
    expect(auditoria.tabIndex).toBe(-1);

    fireEvent.keyDown(resumo, { key: 'ArrowRight' });
    expect(auditoria.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(auditoria);
    expect(screen.getByRole('tabpanel', { name: /Auditoria/ }).textContent).toBe('conteúdo de auditoria');

    fireEvent.keyDown(auditoria, { key: 'End' });
    expect(memoria.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(memoria, { key: 'ArrowRight' });
    expect(resumo.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(resumo, { key: 'ArrowLeft' });
    expect(memoria.getAttribute('aria-selected')).toBe('true');
  });

  it('escolha: radiogroup com radios (aria-checked), tabindex móvel e setas', () => {
    render(<Escolha />);
    expect(screen.getByRole('radiogroup', { name: 'Papel' })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    const [todos, vendas, compras] = screen.getAllByRole('radio');
    expect(todos.getAttribute('aria-checked')).toBe('true');
    expect(vendas.getAttribute('aria-checked')).toBe('false');
    expect([todos.tabIndex, vendas.tabIndex]).toEqual([0, -1]);

    fireEvent.keyDown(todos, { key: 'ArrowDown' });
    expect(vendas.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(vendas);
    fireEvent.keyDown(vendas, { key: 'ArrowUp' });
    fireEvent.keyDown(todos, { key: 'ArrowLeft' });
    expect(compras.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(vendas);
    expect(vendas.getAttribute('aria-checked')).toBe('true');
    expect(vendas.tabIndex).toBe(0);
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
