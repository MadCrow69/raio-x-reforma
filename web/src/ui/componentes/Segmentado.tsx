import { useRef, type KeyboardEvent } from 'react';
import { idAba, idPainel } from './idsAbas';
import './Segmentado.css';

export interface OpcaoSegmentado<V extends string> {
  valor: V;
  rotulo: string;
  /** Número ao lado do rótulo (ex.: achados da auditoria). */
  contador?: number;
}

interface PropsComuns<V extends string> {
  /** Nome acessível do grupo (aria-label). */
  rotulo: string;
  opcoes: OpcaoSegmentado<V>[];
  valor: V;
  aoMudar: (valor: V) => void;
}

/**
 * - `abas`: troca o painel mostrado (WAI-ARIA tablist/tab). Exige `idBase`; o painel de cada aba deve
 *   ter `role="tabpanel"`, `id={idPainel(idBase, valor)}` e `aria-labelledby={idAba(idBase, valor)}` (./idsAbas).
 * - `escolha`: escolhe um valor sem trocar de painel, como um filtro (radiogroup/radio).
 */
export type SegmentadoProps<V extends string> = PropsComuns<V> &
  ({ modo: 'abas'; idBase: string } | { modo: 'escolha' });

/**
 * Controle segmentado. Nos dois modos: só a opção selecionada entra na ordem do Tab (tabindex
 * móvel); ←/→ mudam de opção (circular), Home/End vão ao início/fim; a seleção acompanha o foco.
 */
export default function Segmentado<V extends string>(props: SegmentadoProps<V>) {
  const { rotulo, opcoes, valor, aoMudar } = props;
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function irPara(indice: number) {
    const n = opcoes.length;
    const alvo = ((indice % n) + n) % n;
    aoMudar(opcoes[alvo].valor);
    botoes.current[alvo]?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const mapa: Record<string, number> = {
      ArrowRight: indice + 1,
      ArrowDown: indice + 1,
      ArrowLeft: indice - 1,
      ArrowUp: indice - 1,
      Home: 0,
      End: opcoes.length - 1,
    };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    irPara(mapa[e.key]);
  }

  return (
    <div role={props.modo === 'abas' ? 'tablist' : 'radiogroup'} aria-label={rotulo} className="segmentado">
      {opcoes.map((o, i) => {
        const selecionada = o.valor === valor;
        const semantica =
          props.modo === 'abas'
            ? {
                role: 'tab',
                id: idAba(props.idBase, o.valor),
                'aria-selected': selecionada,
                'aria-controls': idPainel(props.idBase, o.valor),
              }
            : { role: 'radio', 'aria-checked': selecionada };
        return (
          <button
            key={o.valor}
            ref={(el) => {
              botoes.current[i] = el;
            }}
            type="button"
            {...semantica}
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
