import { RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import { ACHADOS_SEM_CALCULO, ESTADO_AUDITORIA_INICIAL, SEM_FILTROS, type EstadoAuditoria, type FocoMemoria } from '../auditoria/tabela';
import type { ResultadoSimulacao } from '../simulacao/simular';
import Botao from '../ui/componentes/Botao';
import { idAba, idPainel } from '../ui/componentes/idsAbas';
import Segmentado from '../ui/componentes/Segmentado';
import { formatarCnpj } from '../ui/formatar';
import './Resultado.css';
import Auditoria from './Auditoria';
import Memoria from './Memoria';
import Resumo, { type FocoAuditoria } from './Resumo';

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

/** Passo 3: resultado em três abas (Resumo, Auditoria em tabela e Memória de cálculo). */
export default function Resultado({ cnpjEmpresa, simulacao, auditoria, sextaFaixa, notasCompra, comprasSemCredito, aoNovaAnalise }: ResultadoProps) {
  const idBase = useId();
  const [aba, setAba] = useState<Aba>('RESUMO');
  // Filtros, busca e ordem da Auditoria sobrevivem à troca de aba; foco = item aberto a partir de uma linha.
  const [estadoAuditoria, setEstadoAuditoria] = useState<EstadoAuditoria>(ESTADO_AUDITORIA_INICIAL);
  const [foco, setFoco] = useState<FocoMemoria | null>(null);
  const comAchado = auditoria.filter((l) => l.achado !== 'OK');

  /** Atalhos do Resumo: abrem a Auditoria já filtrada no que o aviso conta. */
  function verAuditoria(alvo: FocoAuditoria) {
    setEstadoAuditoria({
      ...ESTADO_AUDITORIA_INICIAL,
      filtros: { ...SEM_FILTROS, achado: ACHADOS_SEM_CALCULO, papel: [alvo === 'COMPRAS_SEM_CREDITO' ? 'COMPRA' : 'VENDA'] },
    });
    setAba('AUDITORIA');
  }

  function abrirMemoria(l: LinhaAuditoria) {
    setFoco({ chave: l.chave, item: l.item });
    setAba('MEMORIA');
  }

  return (
    <div className={aba === 'RESUMO' ? 'resultado' : 'resultado resultado--lista'}>
      {/* Nas telas de lista a barra é uma linha só (empresa · abas · Nova análise): sobra altura para as linhas da tabela. */}
      <header className={aba === 'RESUMO' ? 'resultado__cabecalho' : 'resultado__cabecalho resultado__cabecalho--compacto'}>
        <div className="resultado__titulos">
          <h1 className="resultado__titulo">Resultado</h1>
          {cnpjEmpresa && <p className="resultado__empresa">{formatarCnpj(cnpjEmpresa)}</p>}
        </div>
        <div className="resultado__abas">
          <Segmentado
            modo="abas"
            idBase={idBase}
            rotulo="Seções do resultado"
            valor={aba}
            aoMudar={(a) => {
              setAba(a);
              setFoco(null);
            }}
            opcoes={[
              { valor: 'RESUMO', rotulo: 'Resumo' },
              { valor: 'AUDITORIA', rotulo: 'Auditoria', contador: comAchado.length },
              { valor: 'MEMORIA', rotulo: 'Memória de cálculo' },
            ]}
          />
        </div>
        <Botao variante="secundario" icone={RotateCcw} onClick={aoNovaAnalise} className="resultado__nova">
          Nova análise
        </Botao>
      </header>

      <div role="tabpanel" id={idPainel(idBase, aba)} aria-labelledby={idAba(idBase, aba)} className="resultado__painel">
        {aba === 'RESUMO' && (
          <Resumo
            simulacao={simulacao}
            sextaFaixa={sextaFaixa}
            notasCompra={notasCompra}
            comprasSemCredito={comprasSemCredito}
            aoVerAuditoria={verAuditoria}
          />
        )}
        {aba === 'AUDITORIA' && (
          <Auditoria linhas={auditoria} estado={estadoAuditoria} aoMudarEstado={setEstadoAuditoria} aoAbrirMemoria={abrirMemoria} />
        )}
        {aba === 'MEMORIA' && <Memoria linhas={auditoria} foco={foco} aoLimparFoco={() => setFoco(null)} />}
      </div>
    </div>
  );
}
