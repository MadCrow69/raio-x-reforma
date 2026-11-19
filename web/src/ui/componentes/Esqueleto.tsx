import './Esqueleto.css';

export interface EsqueletoProps {
  /** Texto para o leitor de tela (ex.: "Lendo 12 arquivos…"). */
  rotulo: string;
  linhas?: number;
}

/** Estado "carregando" de uma lista: linhas fantasmas com brilho (parado em prefers-reduced-motion). */
export default function Esqueleto({ rotulo, linhas = 3 }: EsqueletoProps) {
  return (
    <div className="esqueleto" role="status" aria-busy="true">
      <span className="sr-only">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto__linha" aria-hidden>
          <span className="esqueleto__bloco esqueleto__bloco--icone" />
          <span className="esqueleto__textos">
            <span className="esqueleto__bloco esqueleto__bloco--titulo" />
            <span className="esqueleto__bloco esqueleto__bloco--detalhe" />
          </span>
        </div>
      ))}
    </div>
  );
}
