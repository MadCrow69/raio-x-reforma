import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import './Aviso.css';

/** Tempo que um aviso comum fica na tela (padrão de interface §10). Erro não some sozinho. */
export const DURACAO_AVISO_MS = 5000;

export type TipoAviso = 'sucesso' | 'info' | 'erro';

export interface DadosAviso {
  tipo: TipoAviso;
  /** O que aconteceu. */
  titulo: string;
  /** Com quem/quanto, ou o que fazer (no erro: causa + ação). */
  detalhe?: string;
}

export interface AvisoProps {
  aviso: DadosAviso | null;
  aoFechar: () => void;
}

const ICONE: Record<TipoAviso, LucideIcon> = { sucesso: CircleCheck, info: Info, erro: CircleAlert };

/**
 * Aviso flutuante (canto inferior direito; topo no celular). A região `aria-live="polite"` existe
 * sempre, para o leitor de tela anunciar o aviso quando ele entra. Some em 5 s, pausa com o mouse
 * em cima ou com o foco dentro; aviso de erro fica até ser fechado.
 */
export default function Aviso({ aviso, aoFechar }: AvisoProps) {
  const [pausado, setPausado] = useState(false);
  const someSozinho = aviso !== null && aviso.tipo !== 'erro';
  // Ref: um aoFechar recriado a cada render do pai não pode reiniciar a contagem.
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (!someSozinho || pausado) return;
    const t = setTimeout(() => aoFecharRef.current(), DURACAO_AVISO_MS);
    return () => clearTimeout(t);
  }, [someSozinho, pausado, aviso]);

  const Icone = aviso ? ICONE[aviso.tipo] : null;
  return (
    <div role="status" aria-live="polite" className="aviso-regiao">
      {aviso && Icone && (
        <div
          className={`aviso aviso--${aviso.tipo}`}
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
          onFocus={() => setPausado(true)}
          onBlur={() => setPausado(false)}
        >
          <Icone className="aviso__icone" size={20} aria-hidden />
          <div className="aviso__texto">
            <p className="aviso__titulo">{aviso.titulo}</p>
            {aviso.detalhe && <p className="aviso__detalhe">{aviso.detalhe}</p>}
          </div>
          <button type="button" className="aviso__fechar" aria-label="Fechar aviso" title="Fechar aviso" onClick={aoFechar}>
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
