import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import {
  ANEXOS_2027,
  LIMITE_SIMPLES,
  SUBLIMITE,
  aliquotasSimples,
  anexoPorFatorR,
  percentuaisPorTributo,
  type Anexo,
  type AliquotasSimples,
} from './aliquotaEfetiva';

const ANEXOS: Anexo[] = ['I', 'II', 'III', 'IV', 'V'];

function ok(anexo: Anexo, rbt12: string): AliquotasSimples {
  const r = aliquotasSimples(anexo, Big(rbt12));
  if ('erro' in r) throw new Error(`erro inesperado: ${r.erro}`);
  return r;
}

function porTributo(anexo: Anexo, rbt12: string): Record<string, Big> {
  const r = percentuaisPorTributo(anexo, Big(rbt12));
  if ('erro' in r) throw new Error(`erro inesperado: ${r.erro}`);
  return r.percentuais;
}

/** Igualdade até 1e-30 ponto, para resultados de dízima periódica (o cálculo usa 40 casas). */
function quase(atual: Big, esperado: string) {
  expect(atual.minus(esperado).abs().lt('1e-30'), `${atual.toString()} ≈ ${esperado}`).toBe(true);
}

/** Compara Big com valor exato (string), sem arredondar. */
function igual(atual: Big, esperado: string) {
  expect(atual.toString()).toBe(Big(esperado).toString());
}

describe('aliquotasSimples — faixa e alíquota efetiva', () => {
  it('Anexo I, RBT12 = 150.000 → faixa 1, efetiva = nominal da faixa 1 (parcela a deduzir = 0)', () => {
    const r = ok('I', '150000');
    expect(r.anexo).toBe('I');
    expect(r.faixa).toBe(1);
    igual(r.efetivaTotal, '4');
    igual(r.pCBSSN, '0.6132'); // 4 × 15,33%
    igual(r.pIBSSN, '0.0068'); // 4 × 0,17%
    igual(r.dasSemCbsIbs, '3.38');
  });

  it('fórmula [(RBT12 × nominal) − PD] / RBT12 conferida à mão na faixa 3 do Anexo I', () => {
    // RBT12 = 500.000 → faixa 3 (360.000,01 a 720.000,00): nominal 9,50%, PD 13.860,00.
    // (500.000 × 0,095 − 13.860) / 500.000 = (47.500 − 13.860) / 500.000 = 33.640 / 500.000 = 0,06728 → 6,728%
    const r = ok('I', '500000');
    expect(r.faixa).toBe(3);
    igual(r.efetivaTotal, '6.728');
    // pCBSSN = 6,728 × 15,33 / 100; pIBSSN = 6,728 × 0,17 / 100
    igual(r.pCBSSN, '1.0314024');
    igual(r.pIBSSN, '0.0114376');
    igual(r.dasSemCbsIbs, '5.68516'); // 6,728 − 1,0314024 − 0,0114376
  });

  it('limites de faixa: RBT12 igual ao teto fica na faixa; um centavo acima vai para a próxima', () => {
    expect(ok('III', '180000').faixa).toBe(1);
    expect(ok('III', '180000.01').faixa).toBe(2);
    expect(ok('III', '3600000').faixa).toBe(5);
    expect(ok('III', '3600000.01').faixa).toBe(6);
    expect(ok('III', '4800000').faixa).toBe(6);
  });

  it('faixas 1 a 5 sem teto de ISS: pCBSSN = efetiva × CBS, pIBSSN = efetiva × IBS, efetiva = fórmula', () => {
    // Um RBT12 no meio de cada faixa 1–5, em todos os anexos (exclui os casos com teto de ISS, testados abaixo).
    const amostras = ['90000', '270000', '540000', '1260000', '1900000'];
    for (const anexo of ANEXOS) {
      amostras.forEach((rbt, i) => {
        const r = ok(anexo, rbt);
        const f = ANEXOS_2027[anexo].faixas[i];
        expect(r.faixa).toBe(i + 1);
        const rbt12 = Big(rbt);
        const esperado = rbt12.times(f.aliquotaNominal).minus(f.parcelaDeduzir.times(100)).div(rbt12);
        expect(r.efetivaTotal.minus(esperado).abs().lt('1e-18')).toBe(true);
        expect(r.pCBSSN.minus(r.efetivaTotal.times(f.reparticao.CBS).div(100)).abs().lt('1e-18')).toBe(true);
        expect(r.pIBSSN.minus(r.efetivaTotal.times(f.reparticao.IBS).div(100)).abs().lt('1e-18')).toBe(true);
        igual(r.dasSemCbsIbs, r.efetivaTotal.minus(r.pCBSSN).minus(r.pIBSSN).toString());
      });
    }
  });
});

describe('tabelas transcritas (anexos-2027.json)', () => {
  it('soma da repartição de cada faixa de cada anexo = 100%', () => {
    for (const anexo of ANEXOS) {
      const faixas = ANEXOS_2027[anexo].faixas;
      expect(faixas).toHaveLength(6);
      faixas.forEach((f) => {
        const soma = Object.values(f.reparticao).reduce((a, b) => a.plus(b), Big(0));
        expect(`${anexo} ${soma.toFixed(2)}`).toBe(`${anexo} 100.00`);
        expect(f.reparticao.CBS).toBeDefined();
        expect(f.reparticao.IBS).toBeDefined();
      });
    }
  });

  it('soma da repartição do excedente no teto de ISS = 100%', () => {
    for (const anexo of ['III', 'IV'] as const) {
      const teto = ANEXOS_2027[anexo].faixas[4].tetoIss;
      expect(teto).toBeDefined();
      const soma = Object.values(teto!.reparticaoDoExcedente).reduce((a, b) => a.plus(b), Big(0));
      expect(soma.toFixed(2)).toBe('100.00');
    }
  });

  it('SUBLIMITE e LIMITE_SIMPLES batem com o teto das faixas 5 e 6 de todos os anexos', () => {
    for (const anexo of ANEXOS) {
      const faixas = ANEXOS_2027[anexo].faixas;
      expect(faixas[4].ate.eq(SUBLIMITE)).toBe(true);
      expect(faixas[5].ate.eq(LIMITE_SIMPLES)).toBe(true);
    }
  });
});

describe('cruzamento com exemplo oficial', () => {
  it('Perguntas e Respostas do Simples Nacional (Receita Federal, atualizado em 09/10/2026), pergunta 5.3.1', () => {
    // Exemplo oficial "considerando a regra até o ano calendário 2026 e 2027": revenda de mercadorias
    // (Anexo I), RBT12 int. = R$ 220.000,00 (faixa de R$ 180.000,01 a R$ 360.000,00),
    // RPA int. = R$ 25.000,00 → "Simples Nacional devido no mês = (R$ 25.000,00 × 4,60%) = R$ 1.150,00".
    // Fonte: http://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf
    // A faixa 2 do Anexo I tem a mesma alíquota nominal (7,30%) e parcela a deduzir (R$ 5.940,00) em 2027.
    // Não há exemplo oficial publicado da parcela de CBS/IBS (o P&R 5.3.2 remete ao futuro manual do PGDAS-RTC).
    const r = ok('I', '220000');
    expect(r.faixa).toBe(2);
    igual(r.efetivaTotal, '4.6');
    expect(Big(25000).times(r.efetivaTotal).div(100).toFixed(2)).toBe('1150.00');
  });
});

describe('teto de 5% do ISS na 5ª faixa (LC 123, art. 18, § 1º-B, I; nota (*) dos Anexos III e IV)', () => {
  it('Anexo III, efetiva acima de 14,92537%: ISS fixo em 5% e CBS/IBS sobre (efetiva − 5%)', () => {
    // RBT12 = 3.000.000 → efetiva = 21 − 125.640 × 100 / 3.000.000 = 21 − 4,188 = 16,812%
    const r = ok('III', '3000000');
    expect(r.faixa).toBe(5);
    igual(r.efetivaTotal, '16.812');
    igual(r.pCBSSN, '2.740384'); // (16,812 − 5) × 23,20%
    igual(r.pIBSSN, '0.0307112'); // (16,812 − 5) × 0,26%
    igual(r.dasSemCbsIbs, '14.0409048');
  });

  it('Anexo III, efetiva abaixo de 14,92537%: repartição normal da 5ª faixa', () => {
    // RBT12 = 2.000.000 → efetiva = 21 − 6,282 = 14,718%
    const r = ok('III', '2000000');
    igual(r.efetivaTotal, '14.718');
    igual(r.pCBSSN, '2.2709874'); // 14,718 × 15,43%
    igual(r.pIBSSN, '0.0250206'); // 14,718 × 0,17%
  });

  it('Anexo IV, efetiva acima de 12,5%: ISS fixo em 5% e CBS/IBS sobre (efetiva − 5%)', () => {
    // RBT12 = 3.000.000 → efetiva = 22 − 183.780 × 100 / 3.000.000 = 22 − 6,126 = 15,874%
    const r = ok('IV', '3000000');
    igual(r.efetivaTotal, '15.874');
    igual(r.pCBSSN, '3.9439998'); // (15,874 − 5) × 36,27%
    igual(r.pIBSSN, '0.043496'); // (15,874 − 5) × 0,40%
  });
});

describe('6ª faixa (RBT12 acima do sublimite): Resolução CGSN nº 140/2018, art. 21, IV, na redação da Res. CGSN nº 190/2026', () => {
  it('Anexo I, RBT12 = 4.000.000: CBS pela 6ª faixa; ICMS e IBS pela fórmula da 5ª faixa', () => {
    // efetiva 6ª faixa = 18,90 − 378.000 × 100 / 4.000.000 = 9,45%  → CBS = 9,45 × 34,02% = 3,21489
    // efetiva 5ª faixa = 14,30 − 87.300 × 100 / 4.000.000 = 12,1175% → IBS = 12,1175 × 0,17% = 0,02059975
    //                                                              ICMS = 12,1175 × 33,50% = 4,0593625
    const r = ok('I', '4000000');
    expect(r.faixa).toBe(6);
    igual(r.pCBSSN, '3.21489');
    igual(r.pIBSSN, '0.02059975');
    igual(r.efetivaTotal, '13.52996225'); // 9,45 + 4,0593625 + 0,02059975
    igual(r.dasSemCbsIbs, '10.2944725');
  });

  it('Anexo II, RBT12 = 4.000.000: ICMS e IBS pela 5ª faixa do próprio Anexo II (regra geral do art. 21, IV)', () => {
    // A nota da 6ª faixa do Anexo II na Res. 190 traz para o ICMS os números do Anexo III (erro material);
    // vale a regra geral: 5ª faixa do Anexo II (14,70%, R$ 85.500,00, ICMS 32,00%, IBS 0,15%).
    // efetiva 6ª = 29,90 − 720.000 × 100 / 4.000.000 = 11,9%  → CBS = 11,9 × 25,22% = 3,00118
    // efetiva 5ª = 14,70 − 85.500 × 100 / 4.000.000 = 12,5625% → ICMS = 12,5625 × 32% = 4,02
    //                                                            IBS = 12,5625 × 0,15% = 0,01884375
    const r = ok('II', '4000000');
    expect(r.faixa).toBe(6);
    igual(r.pCBSSN, '3.00118');
    igual(r.pIBSSN, '0.01884375');
    igual(r.efetivaTotal, '15.93884375'); // 11,9 + 4,02 + 0,01884375
    igual(r.dasSemCbsIbs, '12.91882');
    igual(porTributo('II', '4000000').ICMS, '4.02');
  });
});

describe('6ª faixa: teto de 5% do ISS (LC 123, art. 18, § 1º-B, I; Res. CGSN 140, art. 21, III) — interpretação pendente de ratificação', () => {
  it('Anexo III, RBT12 = 4.000.000: ISS fixo em 5 e excedente aos federais da 6ª e ao IBS, pelos percentuais', () => {
    // efetiva 6ª = 32,90 − 648.000 × 100 / 4.000.000 = 16,7%;  efetiva 5ª = 21 − 125.640 × 100 / 4.000.000 = 17,859%
    // ISS pela 5ª = 17,859 × 33,50% = 5,982765 > 5 → excedente = 0,982765
    // pesos: IRPJ 35,09 + CSLL 15,04 + CBS 19,29 + CPP 30,58 (6ª faixa) + IBS 0,17 (5ª faixa) = 100,17
    // CBS = 16,7 × 19,29% + 0,982765 × 19,29 / 100,17 = 3,22143 + 0,18925363731656184486373165618…
    // IBS = 17,859 × 0,17% + 0,982765 × 0,17 / 100,17 = 0,0303603 + 0,00166786512928022361984626135…
    const p = porTributo('III', '4000000');
    igual(p.ISS, '5');
    const r = ok('III', '4000000');
    quase(r.pCBSSN, '3.41068363731656184486373165618448637316561844863731656');
    quase(r.pIBSSN, '0.0320281651292802236198462613556953179594689028651292802');
    // a redistribuição não muda o total: 16,7 + 5,982765 + 0,0303603
    igual(r.efetivaTotal, '22.7131253');
    quase(r.dasSemCbsIbs, '19.2704134975541579315164220824598183088749126484975541');
  });

  it('Anexo IV, RBT12 = 4.000.000: ISS fixo em 5 e excedente aos federais da 6ª e ao IBS, pelos percentuais', () => {
    // efetiva 6ª = 32,90 − 828.000 × 100 / 4.000.000 = 12,2%;  efetiva 5ª = 22 − 183.780 × 100 / 4.000.000 = 17,4055%
    // ISS pela 5ª = 17,4055 × 40% = 6,9622 > 5 → excedente = 1,9622
    // pesos: IRPJ 53,71 + CSLL 21,59 + CBS 24,70 (6ª faixa) + IBS 0,24 (5ª faixa) = 100,24
    // CBS = 12,2 × 24,70% + 1,9622 × 24,70 / 100,24 = 3,0134 + 0,48350299281723862729449321628…
    // IBS = 17,4055 × 0,24% + 1,9622 × 0,24 / 100,24 = 0,0417732 + 0,00469800478850758180367118914…
    const p = porTributo('IV', '4000000');
    igual(p.ISS, '5');
    const r = ok('IV', '4000000');
    quase(r.pCBSSN, '3.49690299281723862729449321628092577813248204309656824');
    quase(r.pIBSSN, '0.0464712047885075818036711891460494812450119712689545092');
    igual(r.efetivaTotal, '19.2039732'); // 12,2 + 6,9622 + 0,0417732
    quase(r.dasSemCbsIbs, '15.6605990023942537909018355945730247406225059856344773');
  });

  it('Anexo V, RBT12 = 3.602.000: ISS pela 5ª faixa fica ≤ 5, nada é redistribuído', () => {
    const rbt12 = Big('3602000');
    const f = ANEXOS_2027.V.faixas;
    // efetiva 6ª = 30,40 − 540.000 × 100 / RBT12; efetiva 5ª = 23 − 62.100 × 100 / RBT12 ≈ 21,27596
    const ef6 = Big('30.40').minus(Big(540000).times(100).div(rbt12));
    const ef5 = Big('23').minus(Big(62100).times(100).div(rbt12));
    const p = porTributo('V', '3602000');
    expect(p.ISS.lte(5)).toBe(true); // ≈ 21,27596 × 23,50% ≈ 4,99985
    expect(p.ISS.minus(ef5.times('23.50').div(100)).abs().lt('1e-17')).toBe(true);
    const r = ok('V', '3602000');
    expect(r.pCBSSN.minus(ef6.times(f[5].reparticao.CBS).div(100)).abs().lt('1e-17')).toBe(true);
    expect(r.pIBSSN.minus(ef5.times('0.19').div(100)).abs().lt('1e-17')).toBe(true);
    for (const t of ['IRPJ', 'CSLL', 'CPP']) {
      expect(p[t].minus(ef6.times(f[5].reparticao[t]).div(100)).abs().lt('1e-17')).toBe(true);
    }
  });
});

describe('validação do RBT12', () => {
  it('RBT12 = 0 → RBT12_INVALIDO', () => {
    expect(aliquotasSimples('I', Big(0))).toEqual({ erro: 'RBT12_INVALIDO' });
  });
  it('RBT12 negativo → RBT12_INVALIDO', () => {
    expect(aliquotasSimples('III', Big(-1))).toEqual({ erro: 'RBT12_INVALIDO' });
  });
  it('RBT12 = 4.800.000,01 → ACIMA_LIMITE_SIMPLES', () => {
    expect(aliquotasSimples('I', Big('4800000.01'))).toEqual({ erro: 'ACIMA_LIMITE_SIMPLES' });
  });
  it('RBT12 = 3.700.000 (acima do sublimite) → calcula; o aviso de sublimite é da interface', () => {
    const r = ok('I', '3700000');
    expect(r.faixa).toBe(6);
    expect(r.pCBSSN.gt(0)).toBe(true);
  });
});

describe('anexoPorFatorR (LC 123, art. 18, §§ 5º-J e 5º-M: r ≥ 28%)', () => {
  it('folha 28.000 / RBT12 100.000 = 28% → anexo com Fator R', () => {
    expect(anexoPorFatorR('V', 'III', Big(28000), Big(100000))).toBe('III');
  });
  it('folha 27.999 / RBT12 100.000 < 28% → anexo sem Fator R', () => {
    expect(anexoPorFatorR('V', 'III', Big(27999), Big(100000))).toBe('V');
  });
  it('RBT12 ≤ 0 → erro com mensagem em português', () => {
    expect(() => anexoPorFatorR('V', 'III', Big(1), Big(0))).toThrow(/RBT12/);
  });
});
