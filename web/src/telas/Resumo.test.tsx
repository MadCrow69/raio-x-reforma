import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Big from 'big.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResultadoSimulacao } from '../simulacao/simular';
import Resumo from './Resumo';

afterEach(cleanup);

function simulacao(extra: Partial<ResultadoSimulacao> = {}): ResultadoSimulacao {
  return {
    meses: ['2027-03', '2027-04', '2027-05'],
    mesesCompras: ['2027-03', '2027-04', '2027-05'],
    periodoComprasDiferente: false,
    creditosMes: Big(800),
    proporcaoCreditos: Big(1),
    faturamentoMes: Big(50000),
    simples: { impostoMes: Big(4100), creditoClientePJMes: Big(310) },
    regular: { impostoMes: Big(2860), creditoClientePJMes: Big(1900) },
    diferencaMes: Big(1240),
    veredito: 'REGULAR_TENDE_MELHOR',
    origemCompras: 'REAL',
    percentualPJ: Big(62),
    notas2026Simuladas: false,
    itensExcluidos: 0,
    itensSemReceita: 0,
    atividades: [
      {
        cAtivSN: '01',
        tipos: ['NFE', 'NFCE'],
        aliquotas: { anexo: 'I', faixa: 3, efetivaTotal: Big('9.5'), pCBSSN: Big('2.75'), pIBSSN: Big('1.25'), dasSemCbsIbs: Big('5.5') },
      },
    ],
    aliquotasNominais: [{ cbs: Big('8.8'), ibsEstadual: Big('0.05'), ibsMunicipal: Big('0.05'), origem: 'REFERENCIA_2027' }],
    ...extra,
  };
}

describe('Resumo', () => {
  it('REGULAR_TENDE_MELHOR: título, diferença em pt-BR e comparação lado a lado', () => {
    render(<Resumo simulacao={simulacao()} />);
    expect(screen.getByRole('heading', { name: 'O regime regular tende a ser melhor' })).toBeTruthy();
    expect(screen.getByText('Diferença estimada: R$ 1.240,00/mês')).toBeTruthy();
    expect(screen.getByText('R$ 4.100,00')).toBeTruthy();
    expect(screen.getByText('R$ 2.860,00')).toBeTruthy();
    expect(screen.getByText('R$ 310,00')).toBeTruthy();
    expect(screen.getByText('R$ 1.900,00')).toBeTruthy();
  });

  it('SIMPLES_TENDE_MELHOR: título próprio e diferença em módulo', () => {
    render(<Resumo simulacao={simulacao({ veredito: 'SIMPLES_TENDE_MELHOR', diferencaMes: Big(-800) })} />);
    expect(screen.getByRole('heading', { name: 'O Simples tende a ser melhor' })).toBeTruthy();
    expect(screen.getByText('Diferença estimada: R$ 800,00/mês')).toBeTruthy();
  });

  it('DEPENDE_DOS_CLIENTES: título e os dois números (imposto e crédito ao cliente PJ) dos dois cenários', () => {
    render(
      <Resumo
        simulacao={simulacao({
          veredito: 'DEPENDE_DOS_CLIENTES',
          diferencaMes: Big(500),
          simples: { impostoMes: Big(3000), creditoClientePJMes: Big(900) },
          regular: { impostoMes: Big(2500), creditoClientePJMes: Big(100) },
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Depende dos seus clientes' })).toBeTruthy();
    expect(screen.getByText('R$ 3.000,00')).toBeTruthy();
    expect(screen.getByText('R$ 2.500,00')).toBeTruthy();
    expect(screen.getByText('R$ 900,00')).toBeTruthy();
    expect(screen.getByText('R$ 100,00')).toBeTruthy();
    expect(screen.getByText(/menos para a empresa/)).toBeTruthy();
  });

  it('EMPATE não é categórico e não promete diferença', () => {
    render(<Resumo simulacao={simulacao({ veredito: 'EMPATE', diferencaMes: Big(3) })} />);
    expect(screen.getByRole('heading', { name: 'Os dois cenários ficam muito próximos' })).toBeTruthy();
  });

  it('selo de origem das compras e período analisado', () => {
    const { rerender } = render(<Resumo simulacao={simulacao()} />);
    expect(screen.getByText(/compras reais/)).toBeTruthy();
    expect(screen.getByText(/compras reais · .*mar–mai\/2027/)).toBeTruthy();
    rerender(<Resumo simulacao={simulacao({ origemCompras: 'ESTIMADA' })} />);
    expect(screen.getByText(/compras estimadas/)).toBeTruthy();
  });

  it('composição de clientes soma 100%', () => {
    render(<Resumo simulacao={simulacao({ percentualPJ: Big('62.4') })} />);
    expect(screen.getByText('Vendas: 62% para empresas · 38% para consumidor final')).toBeTruthy();
  });

  it('notas de 2026 simuladas: aviso; sem elas, nenhum aviso', () => {
    const { rerender } = render(<Resumo simulacao={simulacao({ notas2026Simuladas: true })} />);
    expect(screen.getByText(/Notas de 2026 simuladas como se fossem de 2027/)).toBeTruthy();
    rerender(<Resumo simulacao={simulacao()} />);
    expect(screen.queryByText(/Notas de 2026 simuladas/)).toBeNull();
  });

  it('itens excluídos: aviso com contagem e atalho para a Auditoria', () => {
    const aoVerAuditoria = vi.fn();
    render(<Resumo simulacao={simulacao({ itensExcluidos: 3 })} aoVerAuditoria={aoVerAuditoria} />);
    expect(screen.getByText('3 itens ficaram fora da comparação porque não foram calculados nos dois cenários.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    expect(aoVerAuditoria).toHaveBeenCalledTimes(1);
  });

  it('um item excluído usa o singular; zero não mostra aviso', () => {
    const { rerender } = render(<Resumo simulacao={simulacao({ itensExcluidos: 1 })} />);
    expect(screen.getByText('1 item ficou fora da comparação porque não foi calculado nos dois cenários.')).toBeTruthy();
    rerender(<Resumo simulacao={simulacao()} />);
    expect(screen.queryByText(/fora da comparação/)).toBeNull();
  });

  it('nota da 6ª faixa só aparece quando pedida', () => {
    const { rerender } = render(<Resumo simulacao={simulacao()} />);
    expect(screen.queryByText(/6ª faixa/)).toBeNull();
    rerender(<Resumo simulacao={simulacao()} sextaFaixa />);
    expect(screen.getByText(/6ª faixa: o cálculo segue a interpretação do teto de 5% do ISS/)).toBeTruthy();
  });

  it('imposto regular negativo é mostrado como saldo credor, com explicação', () => {
    render(<Resumo simulacao={simulacao({ regular: { impostoMes: Big(-500), creditoClientePJMes: Big(1900) }, diferencaMes: Big(4600) })} />);
    expect(screen.getByText('-R$ 500,00')).toBeTruthy();
    expect(screen.getByText(/saldo credor/)).toBeTruthy();
  });

  it('aviso legal sempre presente, em qualquer veredito', () => {
    for (const veredito of ['REGULAR_TENDE_MELHOR', 'SIMPLES_TENDE_MELHOR', 'DEPENDE_DOS_CLIENTES', 'EMPATE'] as const) {
      const { unmount } = render(<Resumo simulacao={simulacao({ veredito })} />);
      expect(screen.getByText('Simulação educativa. Não substitui a orientação do seu contador.')).toBeTruthy();
      unmount();
    }
  });

  it('compras reais com itens sem crédito: aviso de crédito subestimado com atalho para a Auditoria', () => {
    const aoVerAuditoria = vi.fn();
    render(<Resumo simulacao={simulacao()} comprasSemCredito={2} aoVerAuditoria={aoVerAuditoria} />);
    expect(screen.getByText('2 itens de compra sem crédito calculado; o crédito pode estar subestimado.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    expect(aoVerAuditoria).toHaveBeenCalledTimes(1);
  });

  it('singular, zero e compras estimadas não mostram o aviso errado', () => {
    const { rerender } = render(<Resumo simulacao={simulacao()} comprasSemCredito={1} />);
    expect(screen.getByText('1 item de compra sem crédito calculado; o crédito pode estar subestimado.')).toBeTruthy();
    rerender(<Resumo simulacao={simulacao()} comprasSemCredito={0} />);
    expect(screen.queryByText(/sem crédito calculado/)).toBeNull();
    rerender(<Resumo simulacao={simulacao({ origemCompras: 'ESTIMADA' })} comprasSemCredito={4} />);
    expect(screen.queryByText(/sem crédito calculado/)).toBeNull();
  });

  it('itens de saída sem receita: aviso próprio com atalho para a Auditoria; zero não mostra', () => {
    const aoVerAuditoria = vi.fn();
    const { rerender } = render(<Resumo simulacao={simulacao({ itensSemReceita: 2 })} aoVerAuditoria={aoVerAuditoria} />);
    expect(screen.getByText('2 itens de saída sem receita (transferência/remessa) não entram no faturamento.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver na Auditoria' }));
    expect(aoVerAuditoria).toHaveBeenCalledWith('SEM_RECEITA');
    rerender(<Resumo simulacao={simulacao({ itensSemReceita: 1 })} />);
    expect(screen.getByText('1 item de saída sem receita (transferência/remessa) não entra no faturamento.')).toBeTruthy();
    rerender(<Resumo simulacao={simulacao()} />);
    expect(screen.queryByText(/sem receita/)).toBeNull();
  });

  it('período das compras diferente do das vendas: avisa a conversão em média mensal', () => {
    const { rerender } = render(
      <Resumo simulacao={simulacao({ meses: ['2026-01', '2026-12'], mesesCompras: ['2026-04', '2026-06'], periodoComprasDiferente: true })} />,
    );
    expect(
      screen.getByText(
        'O período das compras (abr–jun/2026) é diferente do período das vendas (jan–dez/2026); os créditos foram convertidos em média mensal.',
      ),
    ).toBeTruthy();
    rerender(<Resumo simulacao={simulacao()} />);
    expect(screen.queryByText(/período das compras/)).toBeNull();
  });

  describe('Como chegamos aqui', () => {
    const secao = () => screen.getByRole('region', { name: 'Como chegamos aqui' });

    it('mostra atividade (anexo, faixa, alíquota efetiva, CBS/IBS no DAS), meses, faturamento, créditos e alíquotas nominais com origem', () => {
      render(<Resumo simulacao={simulacao()} />);
      const s = within(secao());
      expect(s.getByText('Atividade 01 · NF-e e NFC-e')).toBeTruthy();
      expect(s.getByText('Anexo I, 3ª faixa · alíquota efetiva total 9,5% · CBS 2,75% e IBS 1,25% dentro do DAS')).toBeTruthy();
      expect(s.getByText('Meses das vendas')).toBeTruthy();
      expect(s.getByText('Meses das compras')).toBeTruthy();
      expect(s.getAllByText('mar–mai/2027 (3 meses)')).toHaveLength(2);
      expect(s.getByText('Faturamento por mês')).toBeTruthy();
      expect(s.getByText('R$ 50.000,00')).toBeTruthy();
      expect(s.getByText('Créditos das compras por mês')).toBeTruthy();
      expect(s.getByText('R$ 800,00')).toBeTruthy();
      expect(s.getByText(/Reais: IBS\/CBS das notas de compra .* 100% \(proporção da receita incluída\) ÷ 3 meses de compras/)).toBeTruthy();
      expect(s.getByText('Alíquotas nominais do regime regular')).toBeTruthy();
      expect(s.getByText('CBS 8,8% · IBS estadual 0,05% · IBS municipal 0,05% · referência 2027 (LC 214)')).toBeTruthy();
    });

    it('compras estimadas explicam a estimativa e não mostram meses de compras', () => {
      render(
        <Resumo
          simulacao={simulacao({
            origemCompras: 'ESTIMADA',
            mesesCompras: [],
            proporcaoCreditos: undefined,
            estimativa: { percentualSobreFaturamento: Big(40), aliquotaNominalTotal: Big('8.9'), origemAliquota: 'DADOS_ABERTOS' },
          })}
        />,
      );
      const s = within(secao());
      expect(s.queryByText('Meses das compras')).toBeNull();
      expect(s.getByText('Estimados: 40% do faturamento × alíquota nominal 8,9% (dados abertos da calculadora oficial)')).toBeTruthy();
    });
  });
});
