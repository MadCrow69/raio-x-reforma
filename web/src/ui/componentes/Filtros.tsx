import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useCelular } from '../useCelular';
import Botao from './Botao';
import Folha from './Folha';
import './Filtros.css';

export interface OpcaoFiltro {
  valor: string;
  rotulo: string;
  /** Quantas linhas teriam esta opção, dados os demais filtros. */
  contagem: number;
}

export interface DimensaoFiltro {
  id: string;
  rotulo: string;
  opcoes: OpcaoFiltro[];
  selecionados: string[];
}

export interface FiltrosProps {
  busca: string;
  aoBuscar: (texto: string) => void;
  rotuloBusca: string;
  dimensoes: DimensaoFiltro[];
  aoSelecionar: (dimensao: string, valores: string[]) => void;
  aoLimparTudo: () => void;
  /** Resultados com os filtros atuais ("Ver N resultados" na folha do celular). */
  totalResultados: number;
  /** Botões ao lado de "Filtros" (ex.: Exportar). */
  acoes?: ReactNode;
}

/** Mais que isto e a lista de opções ganha busca própria (padrão de interface §8). */
const OPCOES_PARA_BUSCA = 8;

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const rotuloOpcao = (d: DimensaoFiltro, valor: string) => d.opcoes.find((o) => o.valor === valor)?.rotulo ?? valor;

function resumo(d: DimensaoFiltro): string {
  if (d.selecionados.length === 0) return d.rotulo;
  const extra = d.selecionados.length > 1 ? ` +${d.selecionados.length - 1}` : '';
  return `${d.rotulo}: ${rotuloOpcao(d, d.selecionados[0])}${extra}`;
}

function ListaOpcoes({ d, aoSelecionar }: { d: DimensaoFiltro; aoSelecionar: (valores: string[]) => void }) {
  const [texto, setTexto] = useState('');
  const idBusca = useId();
  const comBusca = d.opcoes.length > OPCOES_PARA_BUSCA;
  const q = normalizar(texto.trim());
  // Selecionados fixos no topo; o resto na ordem recebida.
  const fixas = d.opcoes.filter((o) => d.selecionados.includes(o.valor));
  const demais = d.opcoes.filter((o) => !d.selecionados.includes(o.valor) && (!q || normalizar(o.rotulo).includes(q)));
  const alternar = (valor: string) =>
    aoSelecionar(d.selecionados.includes(valor) ? d.selecionados.filter((v) => v !== valor) : [...d.selecionados, valor]);
  return (
    <div className="filtros__lista">
      {comBusca && (
        <div className="filtros__busca-opcoes">
          <Search size={16} aria-hidden />
          <input id={idBusca} type="search" aria-label={`Buscar em ${d.rotulo}`} placeholder="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      )}
      <ul className="filtros__opcoes">
        {[...fixas, ...demais].map((o) => (
          <li key={o.valor}>
            <label className={o.contagem === 0 ? 'filtros__opcao filtros__opcao--vazia' : 'filtros__opcao'}>
              <input type="checkbox" checked={d.selecionados.includes(o.valor)} onChange={() => alternar(o.valor)} />
              <span className="filtros__opcao-rotulo">{o.rotulo}</span>
              <span className="filtros__opcao-contagem">{o.contagem.toLocaleString('pt-BR')}</span>
            </label>
          </li>
        ))}
        {demais.length === 0 && fixas.length === 0 && <li className="filtros__sem-opcoes">Nenhuma opção encontrada</li>}
      </ul>
    </div>
  );
}

/**
 * Busca única + botão "Filtros" (com contador) que abre a barra com um botão por dimensão; cada
 * dimensão abre a sua lista (popover no computador, folha de baixo no celular). Com a barra fechada,
 * os filtros ativos aparecem como pílulas removíveis.
 */
export default function Filtros({ busca, aoBuscar, rotuloBusca, dimensoes, aoSelecionar, aoLimparTudo, totalResultados, acoes }: FiltrosProps) {
  const idBarra = useId();
  const celular = useCelular();
  const [barra, setBarra] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const total = dimensoes.reduce((n, d) => n + d.selecionados.length, 0);
  const dimensaoAberta = dimensoes.find((d) => d.id === aberta);

  useEffect(() => {
    if (!aberta || celular) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberta(null);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberta, celular]);

  function alternarBarra() {
    setBarra(!barra);
    setAberta(null);
  }

  const lista = (d: DimensaoFiltro) => <ListaOpcoes d={d} aoSelecionar={(v) => aoSelecionar(d.id, v)} />;
  const limpar = (d: DimensaoFiltro) => (
    <Botao variante="simples" disabled={d.selecionados.length === 0} aria-label={`Limpar ${d.rotulo}`} onClick={() => aoSelecionar(d.id, [])}>
      Limpar
    </Botao>
  );

  return (
    <div className="filtros" ref={raiz}>
      <div className="filtros__topo">
        <label className="filtros__busca">
          <Search size={18} aria-hidden />
          <input type="search" aria-label={rotuloBusca} placeholder={rotuloBusca} value={busca} onChange={(e) => aoBuscar(e.target.value)} autoComplete="off" />
        </label>
        <Botao variante="secundario" icone={SlidersHorizontal} aria-expanded={barra} aria-controls={idBarra} onClick={alternarBarra}>
          Filtros
          {total > 0 && <span className="filtros__contador">{total}</span>}
        </Botao>
        {acoes}
      </div>

      {barra && (
        <div id={idBarra} role="group" aria-label="Filtrar por" className="filtros__barra">
          {dimensoes.map((d) => {
            const painel = `${idBarra}-${d.id}`;
            const aberto = aberta === d.id;
            return (
              <div key={d.id} className="filtros__dimensao">
                <button
                  type="button"
                  className={d.selecionados.length > 0 ? 'filtros__botao filtros__botao--ativo' : 'filtros__botao'}
                  aria-expanded={aberto}
                  aria-controls={painel}
                  onClick={() => setAberta(aberto ? null : d.id)}
                >
                  <span className="filtros__botao-texto">{resumo(d)}</span>
                  <ChevronDown size={16} aria-hidden />
                </button>
                {aberto && !celular && (
                  <div
                    id={painel}
                    role="group"
                    aria-label={d.rotulo}
                    className="filtros__popover"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAberta(null);
                    }}
                  >
                    {lista(d)}
                    <div className="filtros__rodape">{limpar(d)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!barra && total > 0 && (
        <div className="filtros__pilulas">
          {dimensoes.flatMap((d) =>
            d.selecionados.map((v) => (
              <button
                key={`${d.id}:${v}`}
                type="button"
                className="filtros__pilula"
                aria-label={`Remover filtro ${d.rotulo}: ${rotuloOpcao(d, v)}`}
                onClick={() => aoSelecionar(d.id, d.selecionados.filter((x) => x !== v))}
              >
                <span className="filtros__pilula-texto">{`${d.rotulo}: ${rotuloOpcao(d, v)}`}</span>
                <X size={14} aria-hidden />
              </button>
            )),
          )}
          <Botao variante="simples" onClick={aoLimparTudo}>
            Limpar filtros
          </Botao>
        </div>
      )}

      {celular && dimensaoAberta && (
        <Folha
          aberta
          titulo={dimensaoAberta.rotulo}
          aoFechar={() => setAberta(null)}
          rodape={
            <>
              {limpar(dimensaoAberta)}
              <Botao variante="primario" onClick={() => setAberta(null)}>
                {`Ver ${totalResultados.toLocaleString('pt-BR')} ${totalResultados === 1 ? 'resultado' : 'resultados'}`}
              </Botao>
            </>
          }
        >
          {lista(dimensaoAberta)}
        </Folha>
      )}
    </div>
  );
}
