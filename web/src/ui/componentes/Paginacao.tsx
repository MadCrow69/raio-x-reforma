import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import './Paginacao.css';

export interface PaginacaoProps {
  total: number;
  /** Página atual, a partir de 1. */
  pagina: number;
  tamanho: number;
  tamanhos: readonly number[];
  aoMudarPagina: (pagina: number) => void;
  aoMudarTamanho: (tamanho: number) => void;
}

const n = (v: number) => v.toLocaleString('pt-BR');

/** "1–20 de 200 itens", tamanho da página e anterior/próxima (listas inteiras em memória). */
export default function Paginacao({ total, pagina, tamanho, tamanhos, aoMudarPagina, aoMudarTamanho }: PaginacaoProps) {
  const idTamanho = useId();
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const atual = Math.min(pagina, paginas);
  const inicio = total === 0 ? 0 : (atual - 1) * tamanho + 1;
  const fim = Math.min(total, atual * tamanho);
  return (
    <nav className="paginacao" aria-label="Paginação">
      <p className="paginacao__faixa">{`${n(inicio)}–${n(fim)} de ${n(total)} ${total === 1 ? 'item' : 'itens'}`}</p>
      <div className="paginacao__controles">
        <label htmlFor={idTamanho} className="paginacao__rotulo">
          Itens por página
        </label>
        <select id={idTamanho} className="paginacao__tamanho" value={tamanho} onChange={(e) => aoMudarTamanho(Number(e.target.value))}>
          {tamanhos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="button" className="paginacao__botao" aria-label="Página anterior" title="Página anterior" disabled={atual <= 1} onClick={() => aoMudarPagina(atual - 1)}>
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span className="paginacao__pagina">{`${n(atual)} / ${n(paginas)}`}</span>
        <button type="button" className="paginacao__botao" aria-label="Próxima página" title="Próxima página" disabled={atual >= paginas} onClick={() => aoMudarPagina(atual + 1)}>
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
