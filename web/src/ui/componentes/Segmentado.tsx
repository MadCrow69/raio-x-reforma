import { useId, useRef, type KeyboardEvent } from 'react';
import './Segmentado.css';

export interface OpcaoSegmentado<V extends string> {
  valor: V;
  rotulo: string;
  /** Número ao lado do rótulo (ex.: achados da auditoria). */
  contador?: number;
  /** id do painel que esta aba mostra (aria-controls). */
  idPainel?: string;
}

export interface SegmentadoProps<V extends string> {
  /** Nome acessível do grupo (aria-label do tablist). */
  rotulo: string;
  opcoes: OpcaoSegmentado<V>[];
  valor: V;
  aoMudar: (valor: V) => void;
}

/**
 * Controle segmentado com semântica de abas (WAI-ARIA tablist): só a aba selecionada entra na ordem do
 * Tab; ←/→ mudam de aba (circular), Home/End vão ao início/fim. Seleção acompanha o foco.
 */
export default function Segmentado<V extends string>({ rotulo, opcoes, valor, aoMudar }: SegmentadoProps<V>) {
  const base = useId();
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  function irPara(indice: number) {
    const n = opcoes.length;
    const alvo = ((indice % n) + n) % n;
    aoMudar(opcoes[alvo].valor);
    abas.current[alvo]?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const mapa: Record<string, number> = {
      ArrowRight: indice + 1,
      ArrowLeft: indice - 1,
      Home: 0,
      End: opcoes.length - 1,
    };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    irPara(mapa[e.key]);
  }

  return (
    <div role="tablist" aria-label={rotulo} className="segmentado">
      {opcoes.map((o, i) => {
        const selecionada = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              abas.current[i] = el;
            }}
            id={`${base}-${o.valor}`}
            type="button"
            role="tab"
            aria-selected={selecionada}
            aria-controls={o.idPainel}
            tabIndex={selecionada ? 0 : -1}
            className="segmentado__opcao"
            onClick={() => aoMudar(o.valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
          >
            {o.rotulo}
            {o.contador !== undefined && <span className="segmentado__contador">{o.contador}</span>}
          </button>
        );
      })}
    </div>
  );
}
