/**
 * Verificação AO VIVO dos motores (Caddy em http://localhost:8080). Não roda no `npm test`.
 * Subir: `docker compose up -d --build`; rodar: `npm run test:live`; derrubar: `docker compose down`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buscarAliquotasNominais, calcular, limparCacheAliquotas } from './cliente';
import { doc, item, opcao, parametros } from './fabricaTeste';

const BASE = process.env.MOTOR_BASE_URL ?? 'http://localhost:8080';

beforeAll(() => {
  limparCacheAliquotas();
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const r = await original(BASE + url, init);
    console.log(`[live] ${init?.method ?? 'GET'} ${url} -> HTTP ${r.status}`);
    return r;
  });
});

const resumo = (r: Awaited<ReturnType<typeof calcular>>) =>
  r.map((i) => `#${i.numero} ${i.estado} CBS=${i.vCBS} IBSUF=${i.vIBSUF} IBSMun=${i.vIBSMun} erros=${i.erros.map((e) => e.code).join(',')}`);

describe('motores ao vivo', () => {
  it('buscarAliquotasNominais 2027 (rotas dão 404 → referência)', async () => {
    const a = await buscarAliquotasNominais('RS', '4314902', '2027-03-15');
    console.log('[live] nominais 2027', a.cbs.toString(), a.ibsEstadual.toString(), a.ibsMunicipal.toString());
    expect(a.cbs.toString()).toBe('8.8');
  });

  it('NF-e SIMPLES_POR_DENTRO', async () => {
    const r = await calcular([doc()], 'SIMPLES_POR_DENTRO', parametros());
    console.log('[live] SIMPLES_POR_DENTRO NFE', resumo(r));
    expect(r[0].estado).toBe('CALCULO_SIMULADO');
    expect(r[0].vCBS.toString()).toBe('26.12');
    expect(r[0].vIBSUF.toString()).toBe('11.88');
  });

  it('NFS-e SIMPLES_POR_DENTRO', async () => {
    const d = doc({ tipo: 'NFSE', tpDoc: 91, itens: [item(1, { ncm: undefined, nbs: '115010000' })] });
    const p = parametros({ classificacoes: { 'NBS:115010000': opcao('000', '000001') } });
    const r = await calcular([d], 'SIMPLES_POR_DENTRO', p);
    console.log('[live] SIMPLES_POR_DENTRO NFSE', resumo(r));
    expect(r[0].estado).toBe('CALCULO_SIMULADO');
  });

  it('NF-e SIMPLES_POR_FORA (regular)', async () => {
    const r = await calcular([doc()], 'SIMPLES_POR_FORA', parametros());
    console.log('[live] SIMPLES_POR_FORA NFE', resumo(r));
    expect(r[0].estado).toBe('CALCULO_SIMULADO');
    expect(r[0].vCBS.toString()).toBe('83.6');
  });

  it('NF-e REGULAR_AUDITORIA', async () => {
    const r = await calcular([doc()], 'REGULAR_AUDITORIA', parametros());
    console.log('[live] REGULAR_AUDITORIA NFE', resumo(r));
    expect(r[0].estado).toBe('CALCULO_SIMULADO');
  });
});
