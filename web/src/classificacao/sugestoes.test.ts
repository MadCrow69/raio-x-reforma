import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { ItemDocumento } from '../leitura/tipos';
import {
  agruparParaConfirmacao,
  type OpcaoClassificacao,
  type TabelaSugestoes,
} from './sugestoes';

function opcao(cst: string, cClassTrib: string, descricao: string, red = '0'): OpcaoClassificacao {
  return { cst, cClassTrib, descricao, reducaoCbs: new Big(red), reducaoIbs: new Big(red) };
}

const padrao = opcao('000', '000001', 'Situações tributadas integralmente pelo IBS e CBS.');
const reduzida = opcao('200', '200038', 'Insumos agropecuários (Anexo IX)', '60');
const diferida = opcao('515', '515001', 'Diferimento com insumos agropecuários', '60');
const especifica = opcao('200', '200003', 'Cesta básica', '100');

const tabela: TabelaSugestoes = {
  ncm: { '0102': [reduzida, diferida], '01021000': [especifica] },
  nbs: { '101057000': [reduzida] },
  padrao,
};

function item(numero: number, valor: string, extra: Partial<ItemDocumento> = {}): ItemDocumento {
  return { numero, descricao: `item ${numero}`, baseCalculo: new Big(valor), valorIS: new Big(0), ...extra };
}

describe('agruparParaConfirmacao', () => {
  it('agrupa itens do mesmo NCM sem grupo na nota em um único grupo', () => {
    const g = agruparParaConfirmacao(
      [item(1, '10', { ncm: '01021000' }), item(2, '20', { ncm: '01021000' }), item(3, '30.5', { ncm: '01021000' })],
      tabela,
    );
    expect(g).toHaveLength(1);
    expect(g[0].chave).toBe('NCM:01021000');
    expect(g[0].itens).toBe(3);
    expect(g[0].valor.eq('60.5')).toBe(true);
    expect(g[0].origem).toBe('TABELA');
    expect(g[0].sugerida.cClassTrib).toBe('200003');
  });

  it('NCM sem vínculo cai no padrão 000001', () => {
    const [g] = agruparParaConfirmacao([item(1, '10', { ncm: '99999999' })], tabela);
    expect(g.origem).toBe('PADRAO');
    expect(g.sugerida.cClassTrib).toBe('000001');
    expect(g.sugerida.cst).toBe('000');
    expect(g.opcoes).toEqual([padrao]);
  });

  it('item com ibscbsNota gera grupo próprio com a classificação da nota', () => {
    const itens = [
      item(1, '10', { ncm: '01021000' }),
      item(2, '50', {
        ncm: '01021000',
        ibscbsNota: { cst: '200', cClassTrib: '200038', vBC: new Big(50), vCBS: new Big(0), vIBSUF: new Big(0), vIBSMun: new Big(0) },
      }),
    ];
    const g = agruparParaConfirmacao(itens, tabela);
    expect(g.map((x) => x.chave)).toEqual(['NCM:01021000:200038', 'NCM:01021000']);
    expect(g[0].origem).toBe('NOTA');
    expect(g[0].sugerida.cClassTrib).toBe('200038');
    expect(g[0].sugerida.descricao).toBe('Insumos agropecuários (Anexo IX)');
    expect(g[0].sugerida.reducaoCbs.eq(60)).toBe(true);
  });

  it('classificação da nota ausente da tabela usa descrição apenas com o código', () => {
    const [g] = agruparParaConfirmacao(
      [item(1, '5', { ncm: '99999999', ibscbsNota: { cst: '410', cClassTrib: '410999', vBC: new Big(5), vCBS: new Big(0), vIBSUF: new Big(0), vIBSMun: new Big(0) } })],
      tabela,
    );
    expect(g.origem).toBe('NOTA');
    expect(g.sugerida.cst).toBe('410');
    expect(g.sugerida.cClassTrib).toBe('410999');
    expect(g.sugerida.descricao).toBe('cClassTrib 410999');
    expect(g.sugerida.reducaoCbs.eq(0)).toBe(true);
  });

  it('casa por prefixo (posição de 4 dígitos) e lista a mais específica primeiro', () => {
    const [a] = agruparParaConfirmacao([item(1, '10', { ncm: '01029000' })], tabela);
    expect(a.origem).toBe('TABELA');
    expect(a.opcoes.map((o) => o.cClassTrib)).toEqual(['200038', '515001']);
    expect(a.sugerida.cClassTrib).toBe('200038');

    const [b] = agruparParaConfirmacao([item(1, '10', { ncm: '01021000' })], tabela);
    expect(b.opcoes.map((o) => o.cClassTrib)).toEqual(['200003', '200038', '515001']);
    expect(b.sugerida.cClassTrib).toBe('200003');
  });

  it('serviços agrupam por NBS e ordenam os grupos por valor decrescente', () => {
    const g = agruparParaConfirmacao(
      [item(1, '5', { ncm: '99999999' }), item(2, '70', { nbs: '1.0105.70.00' }), item(3, '9', { nbs: '999999999' })],
      tabela,
    );
    expect(g.map((x) => x.chave)).toEqual(['NBS:101057000', 'NBS:999999999', 'NCM:99999999']);
    expect(g[0].tipo).toBe('NBS');
    expect(g[0].origem).toBe('TABELA');
    expect(g[1].origem).toBe('PADRAO');
  });

  it('ignora itens sem NCM e sem NBS', () => {
    expect(agruparParaConfirmacao([item(1, '5')], tabela)).toEqual([]);
  });
});
