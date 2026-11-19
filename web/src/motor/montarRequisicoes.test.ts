import { describe, expect, it } from 'vitest';
import { doc, item, nominais, opcao, parametros } from './fabricaTeste';
import { dataEm2027, montarRequisicao } from './montarRequisicoes';

describe('dataEm2027', () => {
  it('mantém dia/mês e troca o ano para 2027', () => {
    expect(dataEm2027('2026-03-15T10:00:00-03:00')).toBe('2027-03-15T10:00:00-03:00');
  });
  it('29/02 vira 28/02', () => {
    expect(dataEm2027('2024-02-29T10:00:00-03:00')).toBe('2027-02-28T10:00:00-03:00');
  });
});

describe('montarRequisicao — SIMPLES_POR_DENTRO', () => {
  it('monta o corpo do motor do Simples', () => {
    const r = montarRequisicao(doc(), 'SIMPLES_POR_DENTRO', parametros(), nominais);
    expect(r.url).toBe('/motor/simples/api/calculadora/observabilidade/simples-nacional');
    expect(r.corpo).toEqual({
      id: 'CHAVE1',
      versao: '2.0.0',
      data: '2027-03-15',
      tpDoc: '55',
      CRT: '1',
      itens: [
        {
          numero: 1,
          cAtivSN: '01',
          cClassTrib: '000001',
          baseCalculo: '950.00',
          valorImpostoSeletivo: '0.00',
          pCBSSN: '2.75',
          pIBSSN: '1.25',
        },
      ],
    });
    expect(r.naoEnviados).toEqual([]);
  });

  it('usa a atividade do tipo NFSE e tpDoc 91', () => {
    const d = doc({ tipo: 'NFSE', tpDoc: 91, itens: [item(1, { ncm: undefined, nbs: '115010000' })] });
    const p = parametros({ classificacoes: { 'NBS:115010000': opcao('000', '000001') } });
    const r = montarRequisicao(d, 'SIMPLES_POR_DENTRO', p, nominais);
    const corpo = r.corpo as { tpDoc: string; itens: { cAtivSN: string }[] };
    expect(corpo.tpDoc).toBe('91');
    expect(corpo.itens[0].cAtivSN).toBe('07');
  });

  it('item sem atividade para o tipo não é enviado e vira NAO_CALCULADO RXR-001', () => {
    const r = montarRequisicao(doc(), 'SIMPLES_POR_DENTRO', parametros({ atividadePorTipo: {} }), nominais);
    expect((r.corpo as { itens: unknown[] }).itens).toHaveLength(0);
    expect(r.naoEnviados).toHaveLength(1);
    expect(r.naoEnviados[0].estado).toBe('NAO_CALCULADO');
    expect(r.naoEnviados[0].erros[0]).toMatchObject({
      code: 'RXR-001',
      title: 'Atividade do Simples não informada para este tipo de nota',
    });
  });

  it('item sem classificação confirmada vira NAO_CALCULADO RXR-002', () => {
    const r = montarRequisicao(doc(), 'SIMPLES_POR_DENTRO', parametros({ classificacoes: {} }), nominais);
    expect(r.naoEnviados[0].erros[0]).toMatchObject({
      code: 'RXR-002',
      title: 'Classificação não confirmada para este item',
    });
    expect(r.naoEnviados[0].vCBS.toString()).toBe('0');
  });
});

describe('montarRequisicao — motor regular', () => {
  for (const cenario of ['SIMPLES_POR_FORA', 'REGULAR_AUDITORIA'] as const) {
    it(`${cenario}: regime-geral com alíquotas nominais e destino do destinatário`, () => {
      const r = montarRequisicao(doc(), cenario, parametros({ atividadePorTipo: {} }), nominais);
      expect(r.url).toBe('/motor/regular/api/calculadora/observabilidade/regime-geral');
      expect(r.corpo).toEqual({
        id: 'CHAVE1',
        versao: '1.0.0',
        dhFatoGerador: '2027-03-15T10:00:00-03:00',
        municipio: 3550308,
        uf: 'SP',
        tpDoc: 55,
        itens: [
          {
            numero: 1,
            ncm: '61091000',
            cst: '000',
            cClassTrib: '000001',
            baseCalculo: '950.00',
            quantidade: 1,
            unidade: 'UN',
            aliquotasNominais: { cbs: 8.8, ibsEstadual: 0.05, ibsMunicipal: 0.05 },
          },
        ],
      });
    });
  }

  it('sem município no destinatário usa o do emitente', () => {
    const r = montarRequisicao(doc({ destinatario: undefined }), 'REGULAR_AUDITORIA', parametros(), nominais);
    const c = r.corpo as { municipio: number; uf: string };
    expect(c.municipio).toBe(4314902);
    expect(c.uf).toBe('RS');
  });

  it('item NBS envia nbs em vez de ncm', () => {
    const d = doc({ tipo: 'NFSE', tpDoc: 91, itens: [item(1, { ncm: undefined, nbs: '1.1501.00.00' })] });
    const p = parametros({ classificacoes: { 'NBS:115010000': opcao('200', '200028') } });
    const r = montarRequisicao(d, 'REGULAR_AUDITORIA', p, nominais);
    const it = (r.corpo as { itens: Record<string, unknown>[] }).itens[0];
    expect(it.nbs).toBe('115010000');
    expect(it.ncm).toBeUndefined();
    expect(it.cClassTrib).toBe('200028');
  });

  it('sem município em nenhuma parte: nenhum item enviado', () => {
    const d = doc({ destinatario: undefined, emitente: { documento: '1', tipo: 'PJ' } });
    const r = montarRequisicao(d, 'REGULAR_AUDITORIA', parametros(), nominais);
    expect(r.naoEnviados[0].erros[0].code).toBe('RXR-003');
  });
});
