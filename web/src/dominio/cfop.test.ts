import { describe, expect, it } from 'vitest';
import { saidaSemReceita } from './cfop';

describe('saidaSemReceita', () => {
  it('transferências (x.15x) não são receita', () => {
    for (const c of ['5151', '5152', '5155', '6152', '5.152']) expect(saidaSemReceita(c), c).toBe(true);
  });

  it('remessas e outras saídas (x.9xx) não são receita', () => {
    for (const c of ['5910', '5911', '5915', '5922', '5949', '6949', '7949']) expect(saidaSemReceita(c), c).toBe(true);
  });

  it('vendas e serviço tributado pelo ISSQN (x.933) são receita', () => {
    for (const c of ['5101', '5102', '6102', '5405', '7101', '5116', '5933', '6933']) expect(saidaSemReceita(c), c).toBe(false);
  });

  it('CFOP ausente, inválido ou de entrada conta como receita (não exclui o que não se sabe)', () => {
    for (const c of [undefined, '', '51', '1152', '2949']) expect(saidaSemReceita(c), String(c)).toBe(false);
  });
});
