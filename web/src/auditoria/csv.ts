import type Big from 'big.js';
import type { LinhaAuditoria } from './auditar';
import { ROTULO_ACHADO, ROTULO_ESTADO, ROTULO_PAPEL, ROTULO_TIPO } from './rotulos';
import { semCalculo } from './tabela';

const CABECALHO = [
  'Nota', 'Papel', 'Tipo', 'Item', 'Descrição', 'NCM/NBS', 'CST', 'cClassTrib', 'Estado', 'Achado',
  'Códigos de erro', 'Valor na nota', 'Valor do motor', 'Diferença',
];

const dinheiro = (v?: Big) => (v ? v.toFixed(2).replace('.', ',') : '');

/** Neutraliza injeção de fórmula (Excel) em texto vindo de XML de terceiros. */
const texto = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

function campo(s: string): string {
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function paraCsv(linhas: LinhaAuditoria[]): string {
  const rows = linhas.map((l) =>
    [
      texto(l.numeroNota), ROTULO_PAPEL[l.papel], ROTULO_TIPO[l.tipo], String(l.item), texto(l.descricao), texto(l.ncmOuNbs),
      texto(l.cst), texto(l.cClassTrib), ROTULO_ESTADO[l.estado], ROTULO_ACHADO[l.achado],
      l.erros.map((e) => e.code).join(' | '), dinheiro(l.vNota),
      // Sem cálculo do motor não há valor (como o "—" da tela): vazio, nunca 0,00.
      dinheiro(semCalculo(l) ? undefined : l.vMotor), dinheiro(l.diferenca),
    ].map(campo).join(';'),
  );
  return '\uFEFF' + [CABECALHO.join(';'), ...rows].join('\r\n') + '\r\n';
}
