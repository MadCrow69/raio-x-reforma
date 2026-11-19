import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import './ListaAgrupada.css';

export interface ListaAgrupadaProps {
  /** Cabeçalho da seção (curto, vira nome acessível da lista). */
  titulo?: string;
  /** Nota abaixo da seção. */
  rodape?: ReactNode;
  children: ReactNode;
}

/** Lista agrupada "inset grouped": cartão arredondado com linhas separadas por fio. */
export default function ListaAgrupada({ titulo, rodape, children }: ListaAgrupadaProps) {
  const id = useId();
  return (
    <section className="lista-agrupada" aria-labelledby={titulo ? id : undefined}>
      {titulo && (
        <h2 id={id} className="lista-agrupada__titulo">
          {titulo}
        </h2>
      )}
      <ul className="lista-agrupada__cartao">{children}</ul>
      {rodape && <p className="lista-agrupada__rodape">{rodape}</p>}
    </section>
  );
}

export interface ItemListaProps {
  /** Ícone já colorido (ex.: <CircleCheck color=…/>), dentro de um quadrado de 28 px. */
  icone?: ReactNode;
  titulo: ReactNode;
  detalhe?: ReactNode;
  /** Valor à direita (número, data). */
  valor?: ReactNode;
  /** Controle da linha (ex.: escolher uma opção), numa faixa própria abaixo do texto, alinhada a ele. */
  controle?: ReactNode;
}

export function ItemLista({ icone, titulo, detalhe, valor, controle }: ItemListaProps) {
  return (
    <li className={['item-lista', controle && 'item-lista--com-controle'].filter(Boolean).join(' ')}>
      {icone && <span className="item-lista__icone">{icone}</span>}
      <span className="item-lista__textos">
        <span className="item-lista__titulo">{titulo}</span>
        {detalhe && <span className="item-lista__detalhe">{detalhe}</span>}
      </span>
      {valor !== undefined && <span className="item-lista__valor">{valor}</span>}
      {controle && <div className="item-lista__controle">{controle}</div>}
    </li>
  );
}

export interface ItemListaRecolhivelProps {
  titulo: ReactNode;
  /** Contador/valor à direita, visível com a linha recolhida. */
  valor?: ReactNode;
  children: ReactNode;
}

/** Linha que abre o detalhe por baixo (<details> nativo: teclado e leitor de tela de graça). Começa recolhida. */
export function ItemListaRecolhivel({ titulo, valor, children }: ItemListaRecolhivelProps) {
  return (
    <li className="item-lista item-lista--recolhivel">
      <details className="item-lista__details">
        <summary className="item-lista__resumo">
          <span className="item-lista__textos">
            <span className="item-lista__titulo">{titulo}</span>
          </span>
          {valor !== undefined && <span className="item-lista__valor">{valor}</span>}
          <ChevronRight className="item-lista__seta" size={18} aria-hidden />
        </summary>
        <div className="item-lista__conteudo">{children}</div>
      </details>
    </li>
  );
}
