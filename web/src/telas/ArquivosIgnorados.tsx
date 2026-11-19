import { FileX } from 'lucide-react';
import { useState } from 'react';
import type { DocumentoIgnorado } from '../leitura/tipos';
import Botao from '../ui/componentes/Botao';
import './ArquivosIgnorados.css';

/** Arquivos ignorados mostrados por vez dentro de cada motivo (o resto vem em "Mostrar mais"). */
const IGNORADOS_POR_PAGINA = 20;

/** Lista de arquivos/notas que ficaram fora da análise; o detalhe comum a todos é dito uma vez só, em cima. */
export default function ArquivosIgnorados({ itens }: { itens: DocumentoIgnorado[] }) {
  const [visiveis, setVisiveis] = useState(IGNORADOS_POR_PAGINA);
  const restantes = itens.length - visiveis;
  // Mesmo detalhe em todos (o caso comum): diz uma vez só, em cima, e a lista fica só com os nomes.
  const detalheComum = itens.every((d) => d.detalhe === itens[0].detalhe) ? itens[0].detalhe : undefined;
  return (
    <>
      {detalheComum && <p className="ignorados__explicacao">{detalheComum}</p>}
      <ul className="ignorados">
        {itens.slice(0, visiveis).map((d, i) => (
          <li key={`${d.arquivo}-${i}`} className="ignorados__item">
            <FileX size={16} className="ignorados__icone" aria-hidden />
            <span className="ignorados__textos">
              <span className="ignorados__arquivo">{d.arquivo}</span>
              {!detalheComum && d.detalhe && <span className="ignorados__detalhe">{d.detalhe}</span>}
            </span>
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <Botao variante="simples" onClick={() => setVisiveis((v) => v + IGNORADOS_POR_PAGINA)}>
          Mostrar mais {Math.min(restantes, IGNORADOS_POR_PAGINA)} de {restantes}
        </Botao>
      )}
    </>
  );
}
