import { Download, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import { ROTULO_ACHADO } from '../auditoria/rotulos';
import type { ResultadoSimulacao } from '../simulacao/simular';
import Botao from '../ui/componentes/Botao';
import { idAba, idPainel } from '../ui/componentes/idsAbas';
import ListaAgrupada, { ItemLista } from '../ui/componentes/ListaAgrupada';
import Segmentado from '../ui/componentes/Segmentado';
import { contar, formatarCnpj } from '../ui/formatar';
import './Resultado.css';
import Resumo from './Resumo';

export interface ResultadoProps {
  cnpjEmpresa?: string;
  simulacao: ResultadoSimulacao;
  auditoria: LinhaAuditoria[];
  /** Alguma atividade usada caiu na 6ª faixa do Simples. */
  sextaFaixa: boolean;
  /** Notas de compra lidas, quando há. */
  notasCompra?: number;
  /** Itens de compra sem crédito calculável (compras reais). */
  comprasSemCredito?: number;
  aoNovaAnalise: () => void;
}

type Aba = 'RESUMO' | 'AUDITORIA' | 'MEMORIA';

const ORDEM_ACHADOS = Object.keys(ROTULO_ACHADO) as (keyof typeof ROTULO_ACHADO)[];

/** Passo 3: resultado em três abas. Auditoria e Memória são listas mínimas aqui; a tabela completa vem na tarefa seguinte. */
export default function Resultado({ cnpjEmpresa, simulacao, auditoria, sextaFaixa, notasCompra, comprasSemCredito, aoNovaAnalise }: ResultadoProps) {
  const idBase = useId();
  const [aba, setAba] = useState<Aba>('RESUMO');
  const comAchado = auditoria.filter((l) => l.achado !== 'OK');
  const porAchado = ORDEM_ACHADOS.map((a) => ({ achado: a, n: auditoria.filter((l) => l.achado === a).length })).filter((x) => x.n > 0);
  const comMemoria = auditoria.filter((l) => l.memoria !== '').length;

  return (
    <div className="resultado">
      <header className="resultado__cabecalho">
        <div className="resultado__titulos">
          <h1 className="resultado__titulo">Resultado</h1>
          {cnpjEmpresa && <p className="resultado__empresa">{formatarCnpj(cnpjEmpresa)}</p>}
        </div>
        <Botao variante="secundario" icone={RotateCcw} onClick={aoNovaAnalise}>
          Nova análise
        </Botao>
      </header>

      <Segmentado
        modo="abas"
        idBase={idBase}
        rotulo="Seções do resultado"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: 'RESUMO', rotulo: 'Resumo' },
          { valor: 'AUDITORIA', rotulo: 'Auditoria', contador: comAchado.length },
          { valor: 'MEMORIA', rotulo: 'Memória de cálculo' },
        ]}
      />

      <div role="tabpanel" id={idPainel(idBase, aba)} aria-labelledby={idAba(idBase, aba)} className="resultado__painel">
        {aba === 'RESUMO' && (
          <Resumo
            simulacao={simulacao}
            sextaFaixa={sextaFaixa}
            notasCompra={notasCompra}
            comprasSemCredito={comprasSemCredito}
            aoVerAuditoria={() => setAba('AUDITORIA')}
          />
        )}
        {aba === 'AUDITORIA' && (
          <>
            <ListaAgrupada
              titulo="Auditoria"
              rodape={`${contar(auditoria.length, 'item analisado', 'itens analisados')} · ${comAchado.length.toLocaleString('pt-BR')} com achado`}
            >
              {porAchado.map(({ achado, n }) => (
                <ItemLista key={achado} titulo={ROTULO_ACHADO[achado]} valor={n.toLocaleString('pt-BR')} />
              ))}
            </ListaAgrupada>
            <div className="resultado__acoes">
              <Botao variante="secundario" icone={Download} disabled>
                Exportar CSV
              </Botao>
            </div>
          </>
        )}
        {aba === 'MEMORIA' && (
          <ListaAgrupada titulo="Memória de cálculo">
            <ItemLista titulo={`${contar(comMemoria, 'item com memória de cálculo', 'itens com memória de cálculo')} do motor`} />
          </ListaAgrupada>
        )}
      </div>
    </div>
  );
}
