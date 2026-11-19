import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import type { Documento } from '../leitura/tipos';
import type { ParametrosCalculo } from '../motor/tipos';
import { analisar, FalhaDoMotor } from '../simulacao/analisar';
import type { OrigemCompras, ResultadoSimulacao } from '../simulacao/simular';
import Alerta from '../ui/componentes/Alerta';
import Botao from '../ui/componentes/Botao';
import './Calculando.css';

export interface CalculandoProps {
  vendas: Documento[];
  compras: Documento[];
  parametros: ParametrosCalculo;
  origemCompras: OrigemCompras;
  aoConcluir: (auditoria: LinhaAuditoria[], simulacao: ResultadoSimulacao, comprasSemCredito: number) => void;
  /** Volta ao passo 2 (arquivos e empresa preservados) para corrigir o que impediu a comparação. */
  aoVoltar: () => void;
}

type Falha = { tipo: 'REVISAR' | 'REPETIR'; mensagem: string };

const MENSAGEM_INESPERADA = 'Algo deu errado ao calcular. Tente de novo; se o erro continuar, volte e revise os dados.';

function falhaDe(e: unknown): Falha {
  // RangeError é o simular dizendo que não há base para comparar: repetir não resolve, é preciso revisar.
  if (e instanceof RangeError) return { tipo: 'REVISAR', mensagem: e.message };
  if (e instanceof FalhaDoMotor) return { tipo: 'REPETIR', mensagem: e.message };
  return { tipo: 'REPETIR', mensagem: MENSAGEM_INESPERADA };
}

/** Passo 3: calcula (vendas nos dois cenários do Simples, compras no regular), mostra o progresso e entrega o resultado. */
export default function Calculando({ vendas, compras, parametros, origemCompras, aoConcluir, aoVoltar }: CalculandoProps) {
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // O cálculo roda uma vez por tentativa; as props mais recentes ficam numa ref para não reiniciá-lo.
  const entrada = useRef({ vendas, compras, parametros, origemCompras, aoConcluir });
  useEffect(() => {
    entrada.current = { vendas, compras, parametros, origemCompras, aoConcluir };
  });

  useEffect(() => {
    let cancelado = false;
    analisar(entrada.current, (feitos, total) => {
      if (!cancelado) setProgresso({ feitos, total });
    })
      .then((r) => {
        if (!cancelado) entrada.current.aoConcluir(r.auditoria, r.simulacao, r.comprasSemCredito);
      })
      .catch((e: unknown) => {
        if (!cancelado) setFalha(falhaDe(e));
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  function tentarDeNovo() {
    setFalha(null);
    setProgresso(null);
    setTentativa((t) => t + 1);
  }

  if (falha) {
    return (
      <div className="calculando">
        <header className="calculando__cabecalho">
          <h1 className="calculando__titulo">Não foi possível comparar</h1>
        </header>
        <Alerta tipo="erro">{falha.mensagem}</Alerta>
        <div className="calculando__acoes">
          {falha.tipo === 'REPETIR' && (
            <Botao variante="primario" icone={RotateCcw} onClick={tentarDeNovo}>
              Tentar novamente
            </Botao>
          )}
          <Botao variante={falha.tipo === 'REVISAR' ? 'primario' : 'secundario'} icone={ArrowLeft} onClick={aoVoltar}>
            Voltar e revisar
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="calculando">
      <header className="calculando__cabecalho">
        <h1 className="calculando__titulo">Calculando com os motores oficiais</h1>
        <p className="calculando__lide">
          Cada nota passa pelo motor do Simples Nacional e pelo do regime regular. Pode levar alguns instantes; mantenha esta página aberta.
        </p>
      </header>
      <div className="calculando__cartao">
        <progress
          className="calculando__barra"
          aria-label="Progresso do cálculo"
          value={progresso?.feitos ?? 0}
          max={progresso?.total || 1}
        />
        <p className="calculando__contagem">
          {progresso ? `${progresso.feitos.toLocaleString('pt-BR')} de ${progresso.total.toLocaleString('pt-BR')} notas` : 'Preparando o cálculo…'}
        </p>
      </div>
      <p className="sr-only" role="status">
        Calculando…
      </p>
    </div>
  );
}
