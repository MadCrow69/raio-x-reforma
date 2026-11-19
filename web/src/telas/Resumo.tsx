import Big from 'big.js';
import { EMPATE_PERCENTUAL, type ResultadoSimulacao, type Veredito } from '../simulacao/simular';
import Alerta from '../ui/componentes/Alerta';
import Botao from '../ui/componentes/Botao';
import { contar, formatarMeses, formatarMoeda } from '../ui/formatar';
import { AVISO_LEGAL, NOTA_SEXTA_FAIXA } from './avisos';
import './Resumo.css';

export interface ResumoProps {
  simulacao: ResultadoSimulacao;
  /** Alguma atividade usada caiu na 6ª faixa do Simples: mostra a nota de interpretação. */
  sextaFaixa?: boolean;
  /** Notas de compra lidas (só informa no selo de compras reais). */
  notasCompra?: number;
  /** Itens de compra sem crédito calculável: o crédito (e o regime regular) pode estar subestimado. */
  comprasSemCredito?: number;
  /** Abre a aba Auditoria (atalho do aviso de itens fora da comparação). */
  aoVerAuditoria?: () => void;
}

/** Nunca categórico: só "tende a ser melhor" ou "depende" (spec §6). */
const TITULO: Record<Veredito, string> = {
  REGULAR_TENDE_MELHOR: 'O regime regular tende a ser melhor',
  SIMPLES_TENDE_MELHOR: 'O Simples tende a ser melhor',
  DEPENDE_DOS_CLIENTES: 'Depende dos seus clientes',
  EMPATE: 'Os dois cenários ficam muito próximos',
};

const CEM = new Big(100);

const porMes = (v: Big) => `${formatarMoeda(v)}/mês`;

/** Frase que explica o veredito quando o título sozinho não basta. */
function explicacao({ veredito, diferencaMes }: ResultadoSimulacao): string | null {
  const valor = porMes(diferencaMes.abs());
  if (veredito === 'DEPENDE_DOS_CLIENTES') {
    return diferencaMes.gt(0)
      ? `O regime regular custa menos para a empresa (${valor}), mas o Simples gera mais crédito de IBS/CBS para os clientes empresas.`
      : `O Simples custa menos para a empresa (${valor}), mas o regime regular gera mais crédito de IBS/CBS para os clientes empresas.`;
  }
  if (veredito === 'EMPATE') {
    return `A diferença é menor que ${EMPATE_PERCENTUAL.toString().replace('.', ',')}% do imposto do Simples: na prática, os dois custam o mesmo.`;
  }
  return null;
}

function AvisoComAuditoria({ children, aoVerAuditoria }: { children: string; aoVerAuditoria?: () => void }) {
  return (
    <div className="resumo__excluidos">
      <Alerta tipo="alerta">{children}</Alerta>
      {aoVerAuditoria && (
        <Botao variante="simples" onClick={aoVerAuditoria}>
          Ver na Auditoria
        </Botao>
      )}
    </div>
  );
}

/** Aba Resumo: veredito, diferença, comparação lado a lado, composição de clientes e avisos. */
export default function Resumo({ simulacao, sextaFaixa = false, notasCompra, comprasSemCredito = 0, aoVerAuditoria }: ResumoProps) {
  const { simples, regular, veredito, itensExcluidos } = simulacao;
  const pj = simulacao.percentualPJ.round(0);
  const pf = CEM.minus(pj);
  const reais = simulacao.origemCompras === 'REAL';
  const explicar = explicacao(simulacao);

  return (
    <div className="resumo">
      <section className="resumo__veredito" aria-labelledby="resumo-titulo">
        <p className="resumo__selo">
          <span className={`resumo__ponto resumo__ponto--${reais ? 'real' : 'estimada'}`} aria-hidden />
          {reais ? 'compras reais' : 'compras estimadas'}
          {reais && notasCompra !== undefined && ` · ${contar(notasCompra, 'nota de compra', 'notas de compra')}`}
          {` · ${formatarMeses(simulacao.meses)}`}
        </p>
        <h2 id="resumo-titulo" className="resumo__titulo">
          {TITULO[veredito]}
        </h2>
        <p className="resumo__diferenca">{`Diferença estimada: ${porMes(simulacao.diferencaMes.abs())}`}</p>
        {explicar && <p className="resumo__explicacao">{explicar}</p>}
      </section>

      {simulacao.notas2026Simuladas && <Alerta tipo="info">Notas de 2026 simuladas como se fossem de 2027.</Alerta>}
      {sextaFaixa && <Alerta tipo="info">{NOTA_SEXTA_FAIXA}</Alerta>}
      {itensExcluidos > 0 && (
        <AvisoComAuditoria aoVerAuditoria={aoVerAuditoria}>
          {itensExcluidos === 1
            ? '1 item ficou fora da comparação porque não foi calculado nos dois cenários.'
            : `${itensExcluidos.toLocaleString('pt-BR')} itens ficaram fora da comparação porque não foram calculados nos dois cenários.`}
        </AvisoComAuditoria>
      )}
      {reais && comprasSemCredito > 0 && (
        <AvisoComAuditoria aoVerAuditoria={aoVerAuditoria}>
          {`${comprasSemCredito.toLocaleString('pt-BR')} ${
            comprasSemCredito === 1 ? 'item de compra sem crédito calculado' : 'itens de compra sem crédito calculado'
          }; o crédito pode estar subestimado.`}
        </AvisoComAuditoria>
      )}

      <section className="resumo__cartao">
        <table className="resumo__tabela">
          <caption className="sr-only">Comparação mensal entre o Simples e o regime regular</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">
                Simples
                <span className="resumo__sub">IBS/CBS no DAS</span>
              </th>
              <th scope="col">
                Regime regular
                <span className="resumo__sub">IBS/CBS por fora</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Imposto no mês</th>
              <td>{formatarMoeda(simples.impostoMes)}</td>
              <td>{formatarMoeda(regular.impostoMes)}</td>
            </tr>
            <tr>
              <th scope="row">Crédito ao cliente PJ</th>
              <td>{formatarMoeda(simples.creditoClientePJMes)}</td>
              <td>{formatarMoeda(regular.creditoClientePJMes)}</td>
            </tr>
          </tbody>
        </table>
        {regular.impostoMes.lt(0) && (
          <p className="resumo__nota">
            Imposto negativo no regime regular: os créditos das compras superam os débitos do mês (saldo credor).
          </p>
        )}
        <p className="resumo__nota">{`Faturamento médio analisado: ${porMes(simulacao.faturamentoMes)}`}</p>
        <p className="resumo__nota">{`Vendas: ${pj.toFixed(0)}% para empresas · ${pf.toFixed(0)}% para consumidor final`}</p>
      </section>

      <p className="resumo__legal">{AVISO_LEGAL}</p>
    </div>
  );
}
