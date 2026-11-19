import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { proximaOrdem, type OrdemTabela } from './ordem';
import './Tabela.css';

export interface ColunaTabela<L, C extends string> {
  id: C;
  titulo: string;
  /** Número/dinheiro: alinhado à direita, algarismos tabulares. */
  numerica?: boolean;
  /** A única coluna que estica e corta o texto com reticências. */
  elastica?: boolean;
  /** Texto longo e não elástico (ex.: código + título do erro): limita a largura e corta com reticências. */
  trunca?: boolean;
  /** Largura mínima em px das colunas curtas (a elástica não tem). */
  largura?: number;
  celula: (linha: L) => ReactNode;
  /** Texto inteiro da célula, mostrado ao passar o mouse quando ela corta o conteúdo. */
  dica?: (linha: L) => string | undefined;
  /** Esta célula é o botão que abre o item (alvo de teclado da linha clicável). */
  abre?: boolean;
}

export interface TabelaProps<L, C extends string> {
  /** Nome da tabela (leitor de tela). */
  legenda: string;
  colunas: ColunaTabela<L, C>[];
  linhas: L[];
  chaveLinha: (linha: L) => string;
  ordem: OrdemTabela<C> | null;
  aoOrdenar: (ordem: OrdemTabela<C>) => void;
  /** Clique na linha (e Enter/Espaço no botão da coluna `abre`). */
  aoAbrir?: (linha: L) => void;
  rotuloAbrir?: (linha: L) => string;
  /** Conteúdo do cartão no celular: a troca é pela largura do contêiner (< 640 px), não da janela. */
  cartao: (linha: L) => ReactNode;
  rotuloCartoes: string;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

const classes = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ') || undefined;

/**
 * Tabela ordenável de dados já em memória: cabeçalho fixo, só o corpo rola, coluna elástica única.
 * Em contêiner estreito (< 640 px) as linhas viram cartões e a ordenação passa para um seletor.
 */
export default function Tabela<L, C extends string>({
  legenda, colunas, linhas, chaveLinha, ordem, aoOrdenar, aoAbrir, rotuloAbrir, cartao, rotuloCartoes,
}: TabelaProps<L, C>) {
  const idOrdenar = useId();
  return (
    <div className="tabela">
      <div className="tabela__ordenar-cartoes">
        <label htmlFor={idOrdenar} className="tabela__ordenar-rotulo">
          Ordenar por
        </label>
        <select
          id={idOrdenar}
          className="tabela__ordenar-select"
          value={ordem?.coluna ?? ''}
          onChange={(e) => e.target.value && aoOrdenar({ coluna: e.target.value as C, direcao: 'asc' })}
        >
          <option value="">Ordem original</option>
          {colunas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tabela__ordenar-sentido"
          disabled={!ordem}
          aria-label={ordem?.direcao === 'desc' ? 'Ordem decrescente: mudar para crescente' : 'Ordem crescente: mudar para decrescente'}
          title={ordem?.direcao === 'desc' ? 'Decrescente' : 'Crescente'}
          onClick={() => ordem && aoOrdenar({ coluna: ordem.coluna, direcao: ordem.direcao === 'asc' ? 'desc' : 'asc' })}
        >
          {ordem?.direcao === 'desc' ? <ArrowDown size={18} aria-hidden /> : <ArrowUp size={18} aria-hidden />}
        </button>
      </div>

      <div className="tabela__rolagem">
        <table className="tabela__tabela">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr>
              {colunas.map((c) => {
                const ativa = ordem?.coluna === c.id;
                const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ativa ? ARIA_SORT[ordem.direcao] : 'none'}
                    className={classes(c.numerica && 'tabela__num', c.elastica && 'tabela__elastica')}
                    style={c.largura ? { minWidth: c.largura } : undefined}
                  >
                    <button type="button" className="tabela__ordenar" onClick={() => aoOrdenar(proximaOrdem(ordem, c.id))}>
                      {c.titulo}
                      <Icone size={14} aria-hidden className={classes('tabela__seta', ativa && 'tabela__seta--ativa')} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={chaveLinha(l)} className={aoAbrir ? 'tabela__linha--clicavel' : undefined} onClick={aoAbrir && (() => aoAbrir(l))}>
                {colunas.map((c) => {
                  const conteudo = c.celula(l);
                  return (
                    <td key={c.id} className={classes(c.numerica && 'tabela__num', c.elastica && 'tabela__elastica', c.trunca && 'tabela__trunca')} title={c.dica?.(l)}>
                      {c.abre && aoAbrir ? (
                        <button type="button" className="tabela__abrir" aria-label={rotuloAbrir?.(l)}>
                          {conteudo}
                        </button>
                      ) : (
                        conteudo
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="tabela__cartoes" aria-label={rotuloCartoes}>
        {linhas.map((l) => (
          <li key={chaveLinha(l)} className="tabela__cartao">
            {aoAbrir ? (
              <button type="button" className="tabela__cartao-botao" aria-label={rotuloAbrir?.(l)} onClick={() => aoAbrir(l)}>
                {cartao(l)}
              </button>
            ) : (
              cartao(l)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
