import type Big from 'big.js';
import type { LinhaAuditoria } from './auditar';
import { ROTULO_ACHADO, ROTULO_ESTADO, ROTULO_PAPEL, ROTULO_TIPO } from './rotulos';

const CABECALHO = [
  'Nota', 'Papel', 'Tipo', 'Item', 'Descrição', 'NCM/NBS', 'CST', 'cClassTrib', 'Estado', 'Achado',
  'Códigos de erro', 'Valor na nota', 'Valor do motor', 'Diferença',
];

const dinheiro = (v?: Big) => (v ? v.toFixed(2).replace('.', ',') : '');

function campo(s: string): string {
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function paraCsv(linhas: LinhaAuditoria[]): string {
  const rows = linhas.map((l) =>
    [
      l.numeroNota, ROTULO_PAPEL[l.papel], ROTULO_TIPO[l.tipo], String(l.item), l.descricao, l.ncmOuNbs,
      l.cst, l.cClassTrib, ROTULO_ESTADO[l.estado], ROTULO_ACHADO[l.achado],
      l.erros.map((e) => e.code).join(' | '), dinheiro(l.vNota), dinheiro(l.vMotor), dinheiro(l.diferenca),
    ].map(campo).join(';'),
  );
  return '\uFEFF' + [CABECALHO.join(';'), ...rows].join('\r\n') + '\r\n';
}
