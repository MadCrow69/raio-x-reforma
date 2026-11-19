import Big from 'big.js';
import { describe, expect, it, vi } from 'vitest';
import type { Documento, ItemDocumento, TipoDocumento } from '../leitura/tipos';
import type { Cenario, EstadoItem, ItemCalculado, ParametrosCalculo } from '../motor/tipos';
import type { AliquotasSimples } from '../regras/simples/aliquotaEfetiva';
import { ACHADOS_SEM_CALCULO, SEM_FILTROS, filtrar } from '../auditoria/tabela';
import { analisar, FalhaDoMotor, usaSextaFaixa } from './analisar';
import type { OrigemCompras } from './simular';

/* Atividade '01': DAS completo 10%, sem CBS/IBS 6%. Venda de R$ 1.000 por item. */
const ALIQ: Record<string, AliquotasSimples> = {
  '01': { anexo: 'I', faixa: 2, efetivaTotal: Big(10), pCBSSN: Big(3), pIBSSN: Big(1), dasSemCbsIbs: Big(6) },
};
const PARAMETROS: ParametrosCalculo = {
  classificacoes: {},
  atividadePorTipo: { NFE: '01' } as Partial<Record<TipoDocumento, string>>,
  aliquotasSimples: ALIQ,
};

const item = (numero: number, ibscbsNota?: ItemDocumento['ibscbsNota']): ItemDocumento => ({
  numero,
  descricao: `Item ${numero}`,
  ncm: '61091000',
  baseCalculo: Big(1000),
  valorIS: Big(0),
  ibscbsNota,
});

const doc = (chave: string, destino: 'PJ' | 'PF', itens = [item(1)]): Documento => ({
  chave,
  numero: chave,
  tipo: 'NFE',
  tpDoc: 55,
  emissao: '2027-01-10T10:00:00-03:00',
  emitente: { documento: '11222333000181', tipo: 'PJ' },
  destinatario: { documento: '99888777000166', tipo: destino },
  itens,
  arquivo: `${chave}.xml`,
});

const calculados = (d: Documento, v: [string, string, string], estado: EstadoItem): ItemCalculado[] =>
  d.itens.map((it) => ({ chave: d.chave, numero: it.numero, estado, vCBS: Big(v[0]), vIBSUF: Big(v[1]), vIBSMun: Big(v[2]), erros: [], memoria: '' }));

/** Motor falso: devolve o valor combinado por cenário para cada item e avisa o progresso por documento. */
function motorFalso(valores: Partial<Record<Cenario, [string, string, string]>>, estado: EstadoItem = 'CALCULO_SIMULADO') {
  return vi.fn(async (docs: Documento[], cenario: Cenario, _p: ParametrosCalculo, aoProgredir?: (f: number, t: number) => void) => {
    const saida: ItemCalculado[] = [];
    docs.forEach((d, i) => {
      saida.push(...calculados(d, valores[cenario] ?? ['0', '0', '0'], estado));
      aoProgredir?.(i + 1, docs.length);
    });
    return saida;
  });
}

const ESTIMADA: OrigemCompras = { tipo: 'ESTIMADA', percentualSobreFaturamento: Big(40), aliquotaNominalTotal: Big('8.9') };
const REAL: OrigemCompras = { tipo: 'REAL', creditos: Big(0), meses: [] };

describe('analisar', () => {
  it('sem compras: dois cenários nas vendas, nenhum cálculo de compras, origem estimada intacta', async () => {
    const calcular = motorFalso({ SIMPLES_POR_DENTRO: ['30', '10', '0'], SIMPLES_POR_FORA: ['90', '5', '5'] });
    const r = await analisar({ vendas: [doc('v1', 'PJ')], compras: [], parametros: PARAMETROS, origemCompras: ESTIMADA }, undefined, calcular);
    expect(calcular.mock.calls.map((c) => c[1])).toEqual(['SIMPLES_POR_DENTRO', 'SIMPLES_POR_FORA']);
    expect(r.simulacao.origemCompras).toBe('ESTIMADA');
    expect(r.simulacao.simples.impostoMes.toString()).toBe('100');
    expect(r.auditoria).toHaveLength(1);
    expect(r.auditoria[0].papel).toBe('VENDA');
  });

  it('com compras: calcula REGULAR_AUDITORIA e troca os créditos REAL pela soma (nota, senão motor)', async () => {
    const grupo = { cst: '000', cClassTrib: '000001', vBC: Big(1000), vCBS: Big('9'), vIBSUF: Big('0.5'), vIBSMun: Big('0.5') };
    const compras = [doc('c1', 'PJ', [item(1, grupo), item(2)])];
    const calcular = motorFalso({ SIMPLES_POR_DENTRO: ['30', '10', '0'], SIMPLES_POR_FORA: ['90', '5', '5'], REGULAR_AUDITORIA: ['40', '5', '5'] });
    const r = await analisar({ vendas: [doc('v1', 'PJ')], compras, parametros: PARAMETROS, origemCompras: REAL }, undefined, calcular);
    expect(calcular.mock.calls.map((c) => c[1])).toEqual(['SIMPLES_POR_DENTRO', 'SIMPLES_POR_FORA', 'REGULAR_AUDITORIA']);
    // créditos = 10 (grupo da nota) + 50 (motor, item 2) = 60; regular = 1000 × 6% + 100 − 60 = 100
    expect(r.simulacao.origemCompras).toBe('REAL');
    expect(r.simulacao.regular.impostoMes.toString()).toBe('100');
    expect(r.auditoria.filter((l) => l.papel === 'COMPRA')).toHaveLength(2);
    expect(r.comprasSemCredito).toBe(0);
  });

  it('progresso conta documentos de todas as rodadas (M = vendas × 2 + compras)', async () => {
    const calcular = motorFalso({ SIMPLES_POR_DENTRO: ['30', '10', '0'], SIMPLES_POR_FORA: ['90', '5', '5'] });
    const marcas: [number, number][] = [];
    await analisar(
      { vendas: [doc('v1', 'PJ'), doc('v2', 'PF')], compras: [doc('c1', 'PJ')], parametros: PARAMETROS, origemCompras: REAL },
      (f, t) => marcas.push([f, t]),
      calcular,
    );
    expect(marcas[0]).toEqual([0, 5]);
    expect(marcas.at(-1)).toEqual([5, 5]);
    expect(marcas.map((m) => m[0])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('sem nenhum item calculado nos dois cenários propaga o RangeError do simular, em português', async () => {
    const entrada = { vendas: [doc('v1', 'PJ')], compras: [], parametros: PARAMETROS, origemCompras: ESTIMADA };
    const calcular = motorFalso({}, 'INCONSISTENCIA_ENTRADA');
    await expect(analisar(entrada, undefined, calcular)).rejects.toBeInstanceOf(RangeError);
    await expect(analisar(entrada, undefined, calcular)).rejects.toThrow(/Nenhum item foi calculado nos dois cenários/);
  });

  it('motor fora do ar (todos os itens com falha técnica) vira FalhaDoMotor, não RangeError', async () => {
    const calcular = motorFalso({}, 'FALHA_TECNICA');
    const p = analisar({ vendas: [doc('v1', 'PJ')], compras: [], parametros: PARAMETROS, origemCompras: ESTIMADA }, undefined, calcular);
    await expect(p).rejects.toBeInstanceOf(FalhaDoMotor);
  });

  it('usaSextaFaixa olha só as atividades escolhidas para os tipos de nota', () => {
    const faixa6 = { ...ALIQ['01'], faixa: 6 };
    expect(usaSextaFaixa({ ...PARAMETROS, aliquotasSimples: { '01': faixa6 } })).toBe(true);
    expect(usaSextaFaixa({ ...PARAMETROS, aliquotasSimples: { '01': ALIQ['01'], '02': faixa6 } })).toBe(false);
    expect(usaSextaFaixa({ ...PARAMETROS, atividadePorTipo: {} })).toBe(false);
  });

  it('compras REAL com item sem crédito (falha parcial) informa a contagem; ESTIMADA informa 0', async () => {
    const compras = [doc('c1', 'PJ', [item(1), item(2)])];
    const parcial = vi.fn(async (docs: Documento[], cenario: Cenario) => {
      const itens = docs.flatMap((d) => calculados(d, ['30', '10', '0'], 'CALCULO_SIMULADO'));
      // na rodada das compras, o item 2 falha tecnicamente
      return cenario === 'REGULAR_AUDITORIA' ? itens.map((i) => (i.numero === 2 ? { ...i, estado: 'FALHA_TECNICA' as const } : i)) : itens;
    });
    const real = await analisar({ vendas: [doc('v1', 'PJ')], compras, parametros: PARAMETROS, origemCompras: REAL }, undefined, parcial);
    expect(real.comprasSemCredito).toBe(1);
    const estimada = await analisar({ vendas: [doc('v1', 'PJ')], compras: [], parametros: PARAMETROS, origemCompras: ESTIMADA }, undefined, parcial);
    expect(estimada.comprasSemCredito).toBe(0);
  });

  it('o atalho "Ver na Auditoria" dos itens excluídos mostra exatamente itensExcluidos linhas de venda', async () => {
    const recusadoNoRegular = { code: 'REG-011', title: 'NCM não vinculada', detail: 'd' };
    const vendas = [doc('v1', 'PJ', [item(1), item(2), item(3)]), doc('v2', 'PF')];
    const compras = [doc('c1', 'PJ', [item(1)])];
    const calcular = vi.fn(async (docs: Documento[], cenario: Cenario) =>
      docs.flatMap((d) =>
        calculados(d, ['10', '1', '0'], 'CALCULO_SIMULADO').map((c): ItemCalculado => {
          if (cenario === 'SIMPLES_POR_FORA' && d.chave === 'v1' && c.numero === 2) return { ...c, estado: 'INCONSISTENCIA_ENTRADA', erros: [recusadoNoRegular] };
          if (cenario === 'SIMPLES_POR_FORA' && d.chave === 'v1' && c.numero === 3) return { ...c, estado: 'FALHA_TECNICA' };
          if (cenario === 'REGULAR_AUDITORIA') return { ...c, estado: 'INCONSISTENCIA_ENTRADA', erros: [recusadoNoRegular] }; // compra com erro: fora do atalho
          return c;
        }),
      ),
    );
    const r = await analisar({ vendas, compras, parametros: PARAMETROS, origemCompras: REAL }, undefined, calcular);
    expect(r.simulacao.itensExcluidos).toBe(2);
    const atalho = filtrar(r.auditoria, '', { ...SEM_FILTROS, achado: ACHADOS_SEM_CALCULO, papel: ['VENDA'] });
    expect(atalho).toHaveLength(r.simulacao.itensExcluidos);
    expect(atalho.map((l) => l.item).sort()).toEqual([2, 3]);
  });

  it('o atalho "Ver na Auditoria" dos itens sem receita mostra exatamente itensSemReceita linhas', async () => {
    const transferencia = { ...item(2), cfop: '5152' };
    const remessa = { ...item(3), cfop: '6949' };
    const vendas = [doc('v1', 'PJ', [{ ...item(1), cfop: '5102' }, transferencia, remessa])];
    const r = await analisar({ vendas, compras: [], parametros: PARAMETROS, origemCompras: ESTIMADA }, undefined, motorFalso({ SIMPLES_POR_DENTRO: ['30', '10', '0'], SIMPLES_POR_FORA: ['90', '5', '5'] }));
    expect(r.simulacao.itensSemReceita).toBe(2);
    const atalho = filtrar(r.auditoria, '', { ...SEM_FILTROS, achado: ['SAIDA_SEM_RECEITA'], papel: ['VENDA'] });
    expect(atalho.map((l) => l.item)).toEqual([2, 3]);
  });
});
