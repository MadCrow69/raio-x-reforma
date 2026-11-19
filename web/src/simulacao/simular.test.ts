import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento, ItemDocumento, TipoDocumento } from '../leitura/tipos';
import type { EstadoItem, ItemCalculado } from '../motor/tipos';
import type { AliquotasSimples } from '../regras/simples/aliquotaEfetiva';
import { EMPATE_PERCENTUAL, simular, type OrigemCompras } from './simular';

/*
 * Números redondos montados à mão. Atividade '01': DAS completo 10%, CBS 3% + IBS 1% dentro do DAS,
 * DAS sem CBS/IBS 6%. Uma venda de R$ 1.000,00 dá:
 *   Simples (DAS completo)          = 1000 × 10% = 100
 *   Regular (DAS sem CBS/IBS + fora) = 1000 × 6% + 100 (vCBS 90 + vIBSUF 5 + vIBSMun 5) − créditos
 *   Crédito do cliente PJ            = dentro 40 (30 + 10 + 0) × fora 100
 */
const ALIQ: Record<string, AliquotasSimples> = {
  '01': { anexo: 'I', faixa: 2, efetivaTotal: Big(10), pCBSSN: Big(3), pIBSSN: Big(1), dasSemCbsIbs: Big(6) },
};
const ATIVIDADE: Partial<Record<TipoDocumento, string>> = { NFE: '01' };

const item = (numero: number, base = '1000', cfop?: string): ItemDocumento => ({
  numero,
  descricao: `Item ${numero}`,
  ncm: '61091000',
  cfop,
  baseCalculo: Big(base),
  valorIS: Big(0),
});

function venda(chave: string, extra: Partial<Documento> = {}): Documento {
  return {
    chave,
    numero: chave,
    tipo: 'NFE',
    tpDoc: 55,
    emissao: '2027-01-10T10:00:00-03:00',
    emitente: { documento: '11222333000181', tipo: 'PJ' },
    destinatario: { documento: '99888777000166', tipo: 'PJ' },
    itens: [item(1)],
    arquivo: `${chave}.xml`,
    ...extra,
  };
}

const calc = (chave: string, numero: number, v: [string, string, string], estado: EstadoItem = 'CALCULO_SIMULADO'): ItemCalculado => ({
  chave,
  numero,
  estado,
  vCBS: Big(v[0]),
  vIBSUF: Big(v[1]),
  vIBSMun: Big(v[2]),
  erros: [],
  memoria: '',
});
const DENTRO: [string, string, string] = ['30', '10', '0'];
const FORA: [string, string, string] = ['90', '5', '5'];

/** Compras reais; sem `meses`, `entrada` usa os mesmos meses das vendas (período das compras = das vendas). */
const real = (creditos: string, meses?: string[]): OrigemCompras => ({ tipo: 'REAL', creditos: Big(creditos), meses: meses ?? [] });

/** Uma venda por chave, item 1 de R$ 1.000,00, calculado nos dois cenários com DENTRO/FORA. */
function entrada(vendas: Documento[], origem: OrigemCompras, fora = FORA, dentro = DENTRO) {
  const origemCompras: OrigemCompras =
    origem.tipo === 'REAL' && origem.meses.length === 0 ? { ...origem, meses: [...new Set(vendas.map((v) => v.emissao.slice(0, 7)))] } : origem;
  return {
    vendas,
    compras: [],
    porDentro: vendas.flatMap((v) => v.itens.map((i) => calc(v.chave, i.numero, dentro))),
    porFora: vendas.flatMap((v) => v.itens.map((i) => calc(v.chave, i.numero, fora))),
    atividadePorTipo: ATIVIDADE,
    aliquotasPorAtividade: ALIQ,
    origemCompras,
  };
}

describe('simular', () => {
  it('(a) regular mais barato e crédito PJ maior no regular → REGULAR_TENDE_MELHOR', () => {
    // Simples 100; regular 60 + 100 − 80 = 80; diferença 20; crédito PJ 40 × 100.
    const r = simular(entrada([venda('A')], real('80')));
    expect(r.simples.impostoMes.toString()).toBe('100');
    expect(r.regular.impostoMes.toString()).toBe('80');
    expect(r.diferencaMes.toString()).toBe('20');
    expect(r.simples.creditoClientePJMes.toString()).toBe('40');
    expect(r.regular.creditoClientePJMes.toString()).toBe('100');
    expect(r.veredito).toBe('REGULAR_TENDE_MELHOR');
    expect(r.origemCompras).toBe('REAL');
    expect(r.faturamentoMes.toString()).toBe('1000');
    expect(r.percentualPJ.toString()).toBe('100');
    expect(r.itensExcluidos).toBe(0);
  });

  it('(b) Simples mais barato e crédito PJ maior no regular → DEPENDE_DOS_CLIENTES', () => {
    // Sem créditos de compras: regular 60 + 100 = 160; diferença −60; crédito PJ 40 × 100.
    const r = simular(entrada([venda('A')], real('0')));
    expect(r.regular.impostoMes.toString()).toBe('160');
    expect(r.diferencaMes.toString()).toBe('-60');
    expect(r.veredito).toBe('DEPENDE_DOS_CLIENTES');
  });

  it('regular mais barato mas crédito PJ maior no Simples → DEPENDE_DOS_CLIENTES', () => {
    // Por fora o item sai com 0 (ex.: alíquota zero), por dentro com 40: regular 60 − 0 = 60 < 100.
    const r = simular(entrada([venda('A')], real('0'), ['0', '0', '0']));
    expect(r.diferencaMes.toString()).toBe('40');
    expect(r.regular.creditoClientePJMes.toString()).toBe('0');
    expect(r.veredito).toBe('DEPENDE_DOS_CLIENTES');
  });

  it('(c) diferença de 0,3% do imposto do Simples → EMPATE', () => {
    // regular 60 + 100 − 60,3 = 99,7; diferença 0,3 < 0,5% × 100 = 0,5.
    const r = simular(entrada([venda('A')], real('60.3')));
    expect(r.diferencaMes.toString()).toBe('0.3');
    expect(r.veredito).toBe('EMPATE');
  });

  it('diferença de exatamente 0,5% não é empate (limite estrito)', () => {
    expect(EMPATE_PERCENTUAL.toString()).toBe('0.5');
    const r = simular(entrada([venda('A')], real('60.5')));
    expect(r.diferencaMes.toString()).toBe('0.5');
    expect(r.veredito).toBe('REGULAR_TENDE_MELHOR');
  });

  it('(d) compras ESTIMADA 40% → créditos = faturamento × 40% × alíquota nominal', () => {
    // 1000 × 40% × 26,5% = 106; regular 60 + 100 − 106 = 54.
    const r = simular(
      entrada([venda('A')], { tipo: 'ESTIMADA', percentualSobreFaturamento: Big(40), aliquotaNominalTotal: Big('26.5'), origemAliquota: 'REFERENCIA_2027' }),
    );
    expect(r.origemCompras).toBe('ESTIMADA');
    expect(r.regular.impostoMes.toString()).toBe('54');
  });

  it('(e) notas de jan e fev → meses 2027-01 e 2027-02 e média mensal', () => {
    // Totais: faturamento 2000, Simples 200, regular 120 + 200 − 160 = 160, crédito PJ 80 × 200.
    const r = simular(
      entrada([venda('F', { emissao: '2027-02-10T10:00:00-03:00' }), venda('J')], real('160')),
    );
    expect(r.meses).toEqual(['2027-01', '2027-02']);
    expect(r.faturamentoMes.toString()).toBe('1000');
    expect(r.simples.impostoMes.toString()).toBe('100');
    expect(r.regular.impostoMes.toString()).toBe('80');
    expect(r.simples.creditoClientePJMes.toString()).toBe('40');
    expect(r.regular.creditoClientePJMes.toString()).toBe('100');
    expect(r.notas2026Simuladas).toBe(false);
  });

  it('média de 3 meses não termina: 40 casas, sem arredondar, independente do Big.DP global', () => {
    const dpGlobal = Big.DP;
    Big.DP = 2;
    try {
      const r = simular(
        entrada(
          [
            venda('J'),
            venda('F', { emissao: '2027-02-10T10:00:00-03:00' }),
            venda('M', { emissao: '2027-03-10T10:00:00-03:00', itens: [item(1, '2000')] }),
          ],
          real('0'),
        ),
      );
      // 4000 ÷ 3
      expect(r.meses).toHaveLength(3);
      expect(r.faturamentoMes.toString()).toBe(`1333.${'3'.repeat(40)}`);
    } finally {
      Big.DP = dpGlobal;
    }
  });

  it('(f) nota emitida em 2026 → notas2026Simuladas; meses mostram o mês real da emissão', () => {
    const r = simular(entrada([venda('A', { emissao: '2026-03-15T10:00:00-03:00' })], real('80')));
    expect(r.notas2026Simuladas).toBe(true);
    expect(r.meses).toEqual(['2026-03']);
  });

  it('13 meses seguidos (nov/2025 a nov/2026) contam 13 meses, sem juntar os dois novembros', () => {
    const vendas = Array.from({ length: 13 }, (_, i) => {
      const mes = new Date(Date.UTC(2025, 10 + i, 10)).toISOString().slice(0, 7);
      return venda(`V${i}`, { emissao: `${mes}-10T10:00:00-03:00` });
    });
    const r = simular(entrada(vendas, real('0')));
    expect(r.meses).toHaveLength(13);
    expect(r.meses[0]).toBe('2025-11');
    expect(r.meses[12]).toBe('2026-11');
    expect(r.faturamentoMes.toString()).toBe('1000');
    expect(r.simples.impostoMes.toString()).toBe('100');
  });

  it('mês cujas vendas ficaram todas de fora não entra na média', () => {
    const fev = venda('F', { emissao: '2027-02-10T10:00:00-03:00' });
    const r = simular({ ...entrada([venda('J'), fev], real('0')), porFora: [calc('J', 1, FORA)] });
    expect(r.meses).toEqual(['2027-01']);
    expect(r.faturamentoMes.toString()).toBe('1000');
    expect(r.itensExcluidos).toBe(1);
  });

  it('créditos REAL proporcionais à receita incluída (30% da receita excluída)', () => {
    // Item 1 (700) incluído, item 2 (300) com falha no motor por fora: créditos 100 × 700/1000 = 70.
    // Simples 700 × 10% = 70; regular 700 × 6% + 100 − 70 = 72.
    const a = venda('A', { itens: [item(1, '700'), item(2, '300')] });
    const r = simular({
      ...entrada([a], real('100')),
      porFora: [calc('A', 1, FORA), calc('A', 2, FORA, 'FALHA_TECNICA')],
    });
    expect(r.itensExcluidos).toBe(1);
    expect(r.simples.impostoMes.toString()).toBe('70');
    expect(r.regular.impostoMes.toString()).toBe('72');
  });

  it('nenhum item calculado nos dois cenários → erro (sem base para comparar), mesmo com créditos', () => {
    const e = { ...entrada([venda('A')], real('500')), porFora: [calc('A', 1, FORA, 'FALHA_TECNICA')] };
    expect(() => simular(e)).toThrow(RangeError);
    expect(() => simular(e)).toThrow('Nenhum item foi calculado nos dois cenários; não há base para comparar.');
  });

  it('créditos maiores que os débitos → imposto do regular negativo (saldo credor), sem piso em 0', () => {
    // 60 + 100 − 500 = −340.
    const r = simular(entrada([venda('A')], real('500')));
    expect(r.regular.impostoMes.toString()).toBe('-340');
    expect(r.diferencaMes.toString()).toBe('440');
    expect(r.veredito).toBe('REGULAR_TENDE_MELHOR');
  });

  it('itens fora do cálculo nos dois cenários ou sem atividade ficam de fora e são contados', () => {
    const nfe = venda('A', { itens: [item(1), item(2), item(3), item(4)] });
    const nfse = venda('S', { tipo: 'NFSE', tpDoc: 91, itens: [item(1)] }); // NFSE sem atividade
    const r = simular({
      vendas: [nfe, nfse],
      compras: [],
      porDentro: [calc('A', 1, DENTRO), calc('A', 2, DENTRO), calc('A', 4, DENTRO), calc('S', 1, DENTRO)],
      porFora: [
        calc('A', 1, FORA),
        calc('A', 2, FORA, 'FALHA_TECNICA'),
        calc('A', 3, FORA),
        calc('A', 4, FORA),
        calc('S', 1, FORA),
      ],
      atividadePorTipo: ATIVIDADE,
      aliquotasPorAtividade: ALIQ,
      origemCompras: real('0'),
    });
    // Entram só A/1 e A/4: faturamento 2000, Simples 200, regular 120 + 200 = 320.
    expect(r.itensExcluidos).toBe(3);
    expect(r.faturamentoMes.toString()).toBe('2000');
    expect(r.simples.impostoMes.toString()).toBe('200');
    expect(r.regular.impostoMes.toString()).toBe('320');
    expect(r.regular.creditoClientePJMes.toString()).toBe('200');
  });

  it('atividade sem alíquota calculada também exclui o item', () => {
    const r = simular({ ...entrada([venda('A'), venda('S', { tipo: 'NFSE', tpDoc: 91 })], real('0')), atividadePorTipo: { NFE: '01', NFSE: '99' } });
    expect(r.itensExcluidos).toBe(1);
    expect(r.faturamentoMes.toString()).toBe('1000');
  });

  it('sem vendas a PJ: crédito 0 nos dois cenários e o custo decide', () => {
    const pf = { destinatario: { documento: '12345678909', tipo: 'PF' as const } };
    const regular = simular(entrada([venda('A', pf)], real('80')));
    expect(regular.simples.creditoClientePJMes.toString()).toBe('0');
    expect(regular.regular.creditoClientePJMes.toString()).toBe('0');
    expect(regular.percentualPJ.toString()).toBe('0');
    expect(regular.veredito).toBe('REGULAR_TENDE_MELHOR');
    const simples = simular(entrada([venda('A', pf)], real('0')));
    expect(simples.veredito).toBe('SIMPLES_TENDE_MELHOR');
  });

  it('percentualPJ considera só os itens incluídos', () => {
    const pj = venda('A');
    const pf = venda('B', { destinatario: { documento: '12345678909', tipo: 'PF' }, itens: [item(1, '3000')] });
    const r = simular(entrada([pj, pf], real('0')));
    expect(r.percentualPJ.toString()).toBe('25');
    const soPj = simular({ ...entrada([pj, pf], real('0')), porFora: [calc('A', 1, FORA)] });
    expect(soPj.itensExcluidos).toBe(1);
    expect(soPj.percentualPJ.toString()).toBe('100');
  });

  it('sem vendas → erro (não há mês para tirar a média)', () => {
    expect(() => simular(entrada([], real('0')))).toThrow(RangeError);
  });

  it('itens de saída sem receita (transferência/remessa) não entram no faturamento nem nos excluídos', () => {
    // Item 2 (CFOP 5152, transferência) e item 3 (5910, bonificação) saem de tudo; só o item 1 (5102) é receita.
    const a = venda('A', { itens: [item(1, '1000', '5102'), item(2, '500', '5152'), item(3, '300', '5910')] });
    const r = simular(entrada([a], real('80')));
    expect(r.itensSemReceita).toBe(2);
    expect(r.itensExcluidos).toBe(0);
    expect(r.faturamentoMes.toString()).toBe('1000');
    expect(r.simples.impostoMes.toString()).toBe('100');
    // créditos não são proporcionalizados por item sem receita: 60 + 100 − 80 = 80
    expect(r.regular.impostoMes.toString()).toBe('80');
  });

  describe('período das compras × período das vendas', () => {
    const doze = Array.from({ length: 12 }, (_, i) => venda(`V${i}`, { emissao: `2026-${String(i + 1).padStart(2, '0')}-10T10:00:00-03:00` }));

    it('12 meses de vendas e 3 de compras: créditos ÷ 3 meses de compras, com aviso', () => {
      // créditos 240 em 3 meses de compras = 80/mês; débitos por mês iguais aos de 1 venda: 60 + 100 − 80 = 80.
      const r = simular(entrada(doze, real('240', ['2026-04', '2026-05', '2026-06'])));
      expect(r.meses).toHaveLength(12);
      expect(r.mesesCompras).toEqual(['2026-04', '2026-05', '2026-06']);
      expect(r.creditosMes.toString()).toBe('80');
      expect(r.regular.impostoMes.toString()).toBe('80');
      expect(r.periodoComprasDiferente).toBe(true);
    });

    it('mesmo período: sem aviso e média igual à de antes', () => {
      const r = simular(entrada([venda('A')], real('80')));
      expect(r.periodoComprasDiferente).toBe(false);
      expect(r.creditosMes.toString()).toBe('80');
      expect(r.mesesCompras).toEqual(['2027-01']);
    });

    it('compras estimadas não têm período próprio', () => {
      const r = simular(entrada([venda('A')], { tipo: 'ESTIMADA', percentualSobreFaturamento: Big(40), aliquotaNominalTotal: Big('26.5'), origemAliquota: 'REFERENCIA_2027' }));
      expect(r.mesesCompras).toEqual([]);
      expect(r.periodoComprasDiferente).toBe(false);
    });
  });

  describe('como chegamos aqui (origem dos números do Resumo)', () => {
    it('atividades usadas, com os tipos de nota e as alíquotas do Simples', () => {
      const nfse = venda('S', { tipo: 'NFSE', tpDoc: 91 });
      const aliq = { ...ALIQ, '07': { ...ALIQ['01'], anexo: 'III' as const, faixa: 3 } };
      const r = simular({
        ...entrada([venda('A'), venda('C', { tipo: 'NFCE', tpDoc: 65 }), nfse], real('0')),
        atividadePorTipo: { NFE: '01', NFCE: '01', NFSE: '07' },
        aliquotasPorAtividade: aliq,
      });
      expect(r.atividades.map((a) => [a.cAtivSN, a.tipos, a.aliquotas.anexo])).toEqual([
        ['01', ['NFE', 'NFCE'], 'I'],
        ['07', ['NFSE'], 'III'],
      ]);
    });

    it('alíquotas nominais distintas usadas por fora, com a origem; créditos REAL com a proporção aplicada', () => {
      const nominais = { cbs: Big('8.8'), ibsEstadual: Big('0.05'), ibsMunicipal: Big('0.05'), origem: 'REFERENCIA_2027' as const };
      const a = venda('A', { itens: [item(1, '700'), item(2, '300')] });
      const r = simular({
        ...entrada([a, venda('B')], real('100')),
        porFora: [
          { ...calc('A', 1, FORA), aliquotasNominais: nominais },
          calc('A', 2, FORA, 'FALHA_TECNICA'),
          { ...calc('B', 1, FORA), aliquotasNominais: { ...nominais } },
        ],
      });
      expect(r.aliquotasNominais).toHaveLength(1);
      expect(r.aliquotasNominais[0].origem).toBe('REFERENCIA_2027');
      expect(r.proporcaoCreditos?.toString()).toBe('0.85'); // 1700 de 2000
    });
  });
});
