import { X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Folha.css';

export interface FolhaProps {
  aberta: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  /** Botões fixos no pé da folha (o miolo é que rola). */
  rodape?: ReactNode;
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal: no computador, janela centrada (M, 720 px) com folga das bordas; abaixo de 768 px,
 * folha que sobe de baixo (até 92% da altura). Foco vai para dentro ao abrir, fica preso no Tab,
 * Esc e "Fechar" fecham, e o foco volta para quem abriu. Clique no fundo não fecha (não perde edição).
 */
export default function Folha({ aberta, titulo, aoFechar, children, rodape }: FolhaProps) {
  const idTitulo = useId();
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const origem = document.activeElement as HTMLElement | null;
    const primeiro = dialogo.current?.querySelector<HTMLElement>(FOCAVEIS);
    primeiro?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
      origem?.focus();
    };
  }, [aberta]);

  if (!aberta) return null;

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      aoFechar();
      return;
    }
    if (e.key !== 'Tab' || !dialogo.current) return;
    const focaveis = [...dialogo.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return createPortal(
    <div className="folha-fundo">
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="folha"
        onKeyDown={aoTeclar}
      >
        <div className="folha__alca" aria-hidden />
        <header className="folha__topo">
          <h2 id={idTitulo} className="folha__titulo">
            {titulo}
          </h2>
          <button type="button" className="folha__fechar" aria-label="Fechar" title="Fechar" onClick={aoFechar}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="folha__miolo">{children}</div>
        {rodape && <footer className="folha__rodape">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  );
}
