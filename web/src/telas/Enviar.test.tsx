import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { arquivoFixture } from '../leitura/fixtures';
import type { ResultadoLeitura } from '../leitura/tipos';
import Enviar from './Enviar';

const PRIVACIDADE =
  'Seus arquivos são lidos no seu navegador. Só os valores dos itens vão para o cálculo e nada é guardado.';

function soltar(arquivos: File[]) {
  const zona = screen.getByTestId('zona-envio');
  fireEvent.dragEnter(zona, { dataTransfer: { files: arquivos, types: ['Files'] } });
  fireEvent.drop(zona, { dataTransfer: { files: arquivos, types: ['Files'] } });
}

const tresValidosUmInvalido = () => [
  arquivoFixture('nfe_sem_ibscbs.xml'),
  arquivoFixture('nfce.xml'),
  arquivoFixture('nfse_nacional.xml'),
  new File(['isto não é xml'], 'lixo.xml'),
];

const botaoContinuar = () => screen.getByRole('button', { name: /Continuar/ }) as HTMLButtonElement;

afterEach(cleanup);

describe('Enviar', () => {
  it('estado vazio: instrução de arrastar, privacidade visível e "Continuar" desabilitado', () => {
    render(<Enviar aoContinuar={() => {}} />);
    expect(screen.getByText('Arraste os XMLs ou um ZIP das notas')).toBeTruthy();
    expect(screen.getByText(PRIVACIDADE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher arquivos' })).toBeTruthy();
    expect(botaoContinuar().disabled).toBe(true);
  });

  it('soltar 3 XMLs válidos + 1 inválido: "3 notas lidas", "1 arquivo ignorado" com o motivo e "Continuar" habilitado', async () => {
    render(<Enviar aoContinuar={() => {}} />);
    soltar(tresValidosUmInvalido());
    expect(await screen.findByText('3 notas lidas')).toBeTruthy();
    expect(screen.getByText('1 arquivo ignorado')).toBeTruthy();
    expect(screen.getByText('XML inválido')).toBeTruthy();
    expect(screen.getByText('lixo.xml')).toBeTruthy();
    expect(botaoContinuar().disabled).toBe(false);
  });

  it('só arquivos inválidos: nenhuma nota lida e "Continuar" segue desabilitado com o motivo', async () => {
    render(<Enviar aoContinuar={() => {}} />);
    soltar([new File(['nada'], 'a.xml'), new File(['nada'], 'b.txt')]);
    expect(await screen.findByText('Nenhuma nota lida')).toBeTruthy();
    expect(screen.getByText('2 arquivos ignorados')).toBeTruthy();
    expect(botaoContinuar().disabled).toBe(true);
    expect(screen.getByText('Envie ao menos uma nota válida para continuar.')).toBeTruthy();
  });

  it('"Continuar" entrega a leitura com as notas lidas', async () => {
    const aoContinuar = vi.fn<(leitura: ResultadoLeitura) => void>();
    render(<Enviar aoContinuar={aoContinuar} />);
    soltar(tresValidosUmInvalido());
    await screen.findByText('3 notas lidas');
    fireEvent.click(botaoContinuar());
    expect(aoContinuar).toHaveBeenCalledTimes(1);
    const leitura = aoContinuar.mock.calls[0][0];
    expect(leitura.documentos).toHaveLength(3);
    expect(leitura.ignorados).toHaveLength(1);
  });

  it('soltar mais arquivos soma aos anteriores e a mesma nota repetida conta uma vez', async () => {
    render(<Enviar aoContinuar={() => {}} />);
    soltar([arquivoFixture('nfe_sem_ibscbs.xml')]);
    expect(await screen.findByText('1 nota lida')).toBeTruthy();
    soltar([arquivoFixture('nfce.xml'), arquivoFixture('nfe_sem_ibscbs.xml', 'copia.xml')]);
    expect(await screen.findByText('2 notas lidas')).toBeTruthy();
    expect(screen.getByText('Nota repetida')).toBeTruthy();
  });

  it('"Recomeçar" volta ao estado vazio', async () => {
    render(<Enviar aoContinuar={() => {}} />);
    soltar([arquivoFixture('nfce.xml')]);
    await screen.findByText('1 nota lida');
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.queryByText('1 nota lida')).toBeNull();
    expect(botaoContinuar().disabled).toBe(true);
  });
});
