import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import type { Documento } from '../leitura/tipos';
import { ESTADO_INICIAL, reduzirFluxo } from './estado';

function doc(n: string, emit: string, dest?: string): Documento {
  return {
    chave: `chave${n}`,
    numero: n,
    tipo: 'NFE',
    tpDoc: 55,
    emissao: '2026-03-10T10:00:00-03:00',
    emitente: { documento: emit, tipo: 'PJ' },
    destinatario: dest ? { documento: dest, tipo: 'PJ' } : undefined,
    itens: [{ numero: 1, descricao: 'x', baseCalculo: new Big(100), valorIS: new Big(0) }],
    arquivo: `${n}.xml`,
  };
}

const EMPRESA = '11111111000111';
const OUTRA = '22222222000122';
const TERCEIRA = '33333333000133';

describe('reduzirFluxo', () => {
  it('ARQUIVOS_LIDOS guarda a leitura, detecta a empresa, separa e vai para CONFIRMAR', () => {
    const leitura = {
      documentos: [doc('1', EMPRESA, OUTRA), doc('2', EMPRESA), doc('3', OUTRA, EMPRESA), doc('4', OUTRA, TERCEIRA)],
      ignorados: [],
    };
    const e = reduzirFluxo(ESTADO_INICIAL, { tipo: 'ARQUIVOS_LIDOS', leitura, arquivos: [] });
    expect(e.passo).toBe('CONFIRMAR');
    expect(e.leitura).toBe(leitura);
    expect(e.cnpjEmpresa).toBe(EMPRESA);
    expect(e.separacao?.vendas.map((d) => d.numero)).toEqual(['1', '2']);
    expect(e.separacao?.compras.map((d) => d.numero)).toEqual(['3']);
    expect(e.separacao?.ignorados).toHaveLength(1);
  });

  it('ERRO guarda a mensagem sem mudar o passo; NOVA_ANALISE volta ao início', () => {
    const lido = reduzirFluxo(ESTADO_INICIAL, {
      tipo: 'ARQUIVOS_LIDOS',
      leitura: { documentos: [doc('1', EMPRESA)], ignorados: [] },
      arquivos: [],
    });
    const comErro = reduzirFluxo(lido, { tipo: 'ERRO', mensagem: 'Motor fora do ar' });
    expect(comErro.passo).toBe('CONFIRMAR');
    expect(comErro.erro).toBe('Motor fora do ar');
    expect(reduzirFluxo(comErro, { tipo: 'NOVA_ANALISE' })).toEqual(ESTADO_INICIAL);
  });

  it('EMPRESA_CONFIRMADA refaz a separação com o CNPJ escolhido e vai para CALCULANDO', () => {
    const lido = reduzirFluxo(ESTADO_INICIAL, {
      tipo: 'ARQUIVOS_LIDOS',
      leitura: { documentos: [doc('1', EMPRESA, OUTRA), doc('2', OUTRA, EMPRESA)], ignorados: [] },
      arquivos: [],
    });
    const parametros = { classificacoes: {}, atividadePorTipo: {}, aliquotasSimples: {} };
    const origemCompras = { tipo: 'REAL' as const, creditos: new Big(0) };
    const e = reduzirFluxo(lido, { tipo: 'EMPRESA_CONFIRMADA', cnpjEmpresa: OUTRA, parametros, origemCompras });
    expect(e.passo).toBe('CALCULANDO');
    expect(e.cnpjEmpresa).toBe(OUTRA);
    expect(e.separacao?.vendas.map((d) => d.numero)).toEqual(['2']);
    expect(e.separacao?.compras.map((d) => d.numero)).toEqual(['1']);
    expect(e.parametros).toBe(parametros);
    expect(e.origemCompras).toBe(origemCompras);
  });

  it('VOLTAR_AO_ENVIO reabre o passo 1 mantendo arquivos e leitura, sem o que dependia da empresa', () => {
    const arquivos = [new File(['x'], 'a.xml')];
    const leitura = { documentos: [doc('1', EMPRESA, OUTRA)], ignorados: [] };
    const lido = reduzirFluxo(ESTADO_INICIAL, { tipo: 'ARQUIVOS_LIDOS', leitura, arquivos });
    const e = reduzirFluxo(lido, { tipo: 'VOLTAR_AO_ENVIO' });
    expect(e.passo).toBe('ENVIAR');
    expect(e.arquivos).toBe(arquivos);
    expect(e.leitura).toBe(leitura);
    expect(e.separacao).toBeUndefined();
  });
  it('VOLTAR_AO_CONFIRMAR reabre o passo 2 com arquivos, leitura e empresa, sem erro nem resultado', () => {
    const arquivos = [new File(['x'], 'a.xml')];
    const leitura = { documentos: [doc('1', EMPRESA, OUTRA)], ignorados: [] };
    const lido = reduzirFluxo(ESTADO_INICIAL, { tipo: 'ARQUIVOS_LIDOS', leitura, arquivos });
    const parametros = { classificacoes: {}, atividadePorTipo: {}, aliquotasSimples: {} };
    const calculando = reduzirFluxo(lido, {
      tipo: 'EMPRESA_CONFIRMADA',
      cnpjEmpresa: EMPRESA,
      parametros,
      origemCompras: { tipo: 'REAL', creditos: new Big(0) },
    });
    const e = reduzirFluxo({ ...calculando, erro: 'falhou' }, { tipo: 'VOLTAR_AO_CONFIRMAR' });
    expect(e.passo).toBe('CONFIRMAR');
    expect(e.arquivos).toBe(arquivos);
    expect(e.leitura).toBe(leitura);
    expect(e.cnpjEmpresa).toBe(EMPRESA);
    expect(e.erro).toBeUndefined();
    expect(e.simulacao).toBeUndefined();
  });
});
