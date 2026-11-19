import Big from 'big.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import regularNfe from './__fixtures__/regular-nfe-2027.json';
import regularPorFora from './__fixtures__/regular-scenario-simples-por-fora.json';
import erroVsn019 from './__fixtures__/simples-erro-vsn019.json';
import simplesNaoCalc from './__fixtures__/simples-nao-calculado.json';
import simplesNfe from './__fixtures__/simples-nfe-2027.json';
import { ALIQUOTAS_REFERENCIA_2027, buscarAliquotasNominais, calcular, limparCacheAliquotas } from './cliente';
import { doc, item, parametros } from './fabricaTeste';

const resposta = (corpo: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  limparCacheAliquotas();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('buscarAliquotasNominais', () => {
  it('cai na constante de referência quando as rotas dão 404 e faz cache', async () => {
    fetchMock.mockResolvedValue(resposta({ title: 'Alíquota não encontrada' }, 404));
    const a = await buscarAliquotasNominais('RS', '4314902', '2027-03-15');
    expect(a.cbs.eq(ALIQUOTAS_REFERENCIA_2027.cbs)).toBe(true);
    expect(a.origem).toBe('REFERENCIA_2027');
    expect(ALIQUOTAS_REFERENCIA_2027.cbs.toString()).toBe('8.8');
    const chamadas = fetchMock.mock.calls.length;
    await buscarAliquotasNominais('RS', '4314902', '2027-03-15');
    expect(fetchMock.mock.calls.length).toBe(chamadas);
  });

  it('usa as rotas de dados abertos quando respondem', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('aliquota-uniao')) return resposta({ aliquotaReferencia: 0.9 });
      if (url.includes('aliquota-uf')) return resposta({ aliquotaReferencia: 0.1 });
      return resposta({ aliquotaReferencia: 0.0 });
    });
    const a = await buscarAliquotasNominais('RS', '4314902', '2026-06-01');
    expect([a.cbs.toString(), a.ibsEstadual.toString(), a.ibsMunicipal.toString()]).toEqual(['0.9', '0.1', '0']);
    expect(a.origem).toBe('DADOS_ABERTOS');
    expect(fetchMock.mock.calls.map((c) => c[0]).join()).toContain('codigoUf=43');
  });

  it('erro de rede também cai na referência', async () => {
    fetchMock.mockRejectedValue(new TypeError('rede'));
    const a = await buscarAliquotasNominais('SP', '3550308', '2027-03-15');
    expect(a.ibsEstadual.eq(Big('0.05'))).toBe(true);
  });
});

describe('calcular', () => {
  const ehDadosAbertos = (url: unknown) => String(url).includes('dados-abertos');

  it('Simples por dentro: mapeia vCBSSN/vIBSSN', async () => {
    fetchMock.mockResolvedValue(resposta(simplesNfe));
    const prog = vi.fn();
    const r = await calcular([doc()], 'SIMPLES_POR_DENTRO', parametros(), prog);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ chave: 'CHAVE1', numero: 1, estado: 'CALCULO_SIMULADO' });
    expect(r[0].vCBS.toString()).toBe('26.12');
    expect(r[0].vIBSUF.toString()).toBe('11.88');
    expect(r[0].vIBSMun.toString()).toBe('0');
    expect(r[0].origemMemoria).toBe('COMPOSTA');
    expect(prog).toHaveBeenLastCalledWith(1, 1);
    expect(fetchMock.mock.calls[0][0]).toBe('/motor/simples/api/calculadora/observabilidade/simples-nacional');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('Simples: vIBSMun sem vIBSUF não conta o IBS duas vezes (UF = vIBSSN − vIBSMun)', async () => {
    const o = simplesNfe.objetos[0];
    const tribCalc = { ...o.tribCalc, vIBSSN: '11.88', vIBSMun: '1.88' } as Record<string, unknown>;
    delete tribCalc.vIBSUF;
    fetchMock.mockResolvedValue(resposta({ ...simplesNfe, objetos: [{ ...o, tribCalc }] }));
    const [r] = await calcular([doc()], 'SIMPLES_POR_DENTRO', parametros());
    expect(r.vIBSUF.toString()).toBe('10');
    expect(r.vIBSMun.toString()).toBe('1.88');
    expect(r.vIBSUF.plus(r.vIBSMun).toString()).toBe('11.88');
  });

  it('Simples: NAO_CALCULADO do motor vira NAO_CALCULADO com zeros', async () => {
    fetchMock.mockResolvedValue(resposta(simplesNaoCalc));
    const r = await calcular([doc()], 'SIMPLES_POR_DENTRO', parametros());
    expect(r[0].estado).toBe('NAO_CALCULADO');
    expect(r[0].vCBS.toString()).toBe('0');
    expect(r[0].origemMemoria).toBeUndefined();
  });

  it('regular: mapeia gCBS/gIBSUF/gIBSMun e memória', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      ehDadosAbertos(url) ? resposta({}, 404) : resposta(regularPorFora),
    );
    const r = await calcular([doc()], 'SIMPLES_POR_FORA', parametros());
    expect(r[0].estado).toBe('CALCULO_SIMULADO');
    expect(r[0].vCBS.toString()).toBe('83.6');
    expect(r[0].vIBSUF.toString()).toBe('0.48');
    expect(r[0].vIBSMun.toString()).toBe('0.48');
    expect(r[0].memoria).toContain('Tributação integral');
    expect(r[0].origemMemoria).toBe('MOTOR');
    // as alíquotas nominais usadas (e de onde vieram) acompanham o item calculado no regime regular
    expect(r[0].aliquotasNominais?.cbs.toString()).toBe('8.8');
    expect(r[0].aliquotasNominais?.origem).toBe('REFERENCIA_2027');
    const post = fetchMock.mock.calls.find((c) => String(c[0]).includes('regime-geral'))!;
    expect(JSON.parse(post[1].body).itens[0].aliquotasNominais.cbs).toBe(8.8);
  });

  it('regular: erro de item vem em erros com INCONSISTENCIA_ENTRADA', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      ehDadosAbertos(url) ? resposta({}, 404) : resposta(regularNfe),
    );
    const itens = [1, 2, 3, 4].map((n) => item(n));
    const r = await calcular([doc({ itens })], 'REGULAR_AUDITORIA', parametros());
    const i4 = r.find((x) => x.numero === 4)!;
    expect(i4.estado).toBe('INCONSISTENCIA_ENTRADA');
    expect(i4.erros[0]).toMatchObject({ code: 'REG-011', title: 'NCM não vinculada', pointer: '#/itens/3/ncm' });
  });

  it('422 problem+json: todos os itens INCONSISTENCIA_ENTRADA com o erro do motor', async () => {
    fetchMock.mockResolvedValue(resposta(erroVsn019, 422));
    const d = doc({ itens: [item(1), item(2)] });
    const r = await calcular([d], 'SIMPLES_POR_DENTRO', parametros());
    expect(r.map((x) => x.estado)).toEqual(['INCONSISTENCIA_ENTRADA', 'INCONSISTENCIA_ENTRADA']);
    expect(r[0].erros[0].code).toBe('VSN-019');
  });

  it('5xx e falha de rede viram FALHA_TECNICA só do documento afetado', async () => {
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const id = JSON.parse(init.body).id;
      if (id === 'doc-1') throw new TypeError('rede');
      if (id === 'doc-2') return resposta({}, 503);
      return resposta(simplesNfe);
    });
    const docs = [doc({ chave: 'A' }), doc({ chave: 'B' }), doc({ chave: 'C' })];
    const r = await calcular(docs, 'SIMPLES_POR_DENTRO', parametros());
    expect(r.map((x) => x.estado)).toEqual(['FALHA_TECNICA', 'FALHA_TECNICA', 'CALCULO_SIMULADO']);
    expect(r[0].erros[0].code).toBe('RXR-900');
  });

  it('documento sem itens enviáveis não chama o motor', async () => {
    const r = await calcular([doc()], 'SIMPLES_POR_DENTRO', parametros({ classificacoes: {} }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r[0].erros[0].code).toBe('RXR-002');
  });

  it('no máximo 4 requisições simultâneas e progresso por documento', async () => {
    let ativas = 0;
    let pico = 0;
    fetchMock.mockImplementation(async () => {
      ativas += 1;
      pico = Math.max(pico, ativas);
      await new Promise((r) => setTimeout(r, 5));
      ativas -= 1;
      return resposta(simplesNfe);
    });
    const docs = Array.from({ length: 12 }, (_, i) => doc({ chave: `D${i}` }));
    const prog = vi.fn();
    await calcular(docs, 'SIMPLES_POR_DENTRO', parametros(), prog);
    expect(pico).toBe(4);
    expect(prog).toHaveBeenCalledTimes(12);
    expect(prog).toHaveBeenLastCalledWith(12, 12);
  });
});

describe('privacidade dos corpos enviados aos motores', () => {
  it('nenhum corpo leva chave de acesso, CNPJ/CPF ou nome: o id é sequencial (doc-1, doc-2…)', async () => {
    const chave1 = '41260311222333000181550010000000011100000019';
    const chave2 = '35260311222333000181550010000000021100000027';
    const docs = [
      doc({ chave: chave1, destinatario: { documento: '12345678909', tipo: 'PF', municipioIbge: '3550308', uf: 'SP' } }),
      doc({ chave: chave2, numero: '2', itens: [item(1), item(2)] }),
    ];
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('dados-abertos') ? resposta({}, 404) : resposta({ objetos: [] }),
    );
    for (const cenario of ['SIMPLES_POR_DENTRO', 'SIMPLES_POR_FORA', 'REGULAR_AUDITORIA'] as const) {
      fetchMock.mockClear();
      await calcular(docs, cenario, parametros());
      const corpos = fetchMock.mock.calls.filter((c) => c[1]?.body).map((c) => String(c[1].body));
      expect(corpos).toHaveLength(2);
      const proibidos = [chave1, chave2, '11222333000181', '99888777000166', '12345678909', 'item 1'];
      for (const corpo of corpos) for (const p of proibidos) expect(corpo, `${cenario}: ${p}`).not.toContain(p);
      expect(corpos.map((c) => JSON.parse(c).id).sort()).toEqual(['doc-1', 'doc-2']);
    }
  });
});
