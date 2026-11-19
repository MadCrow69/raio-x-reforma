import { ChevronDown, Search } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import type { AtividadeSimples } from '../motor/atividades';
import Folha from '../ui/componentes/Folha';
import './SeletorAtividade.css';

/** Acima deste número de opções a lista ganha busca (padrão de interface). */
export const OPCOES_PARA_BUSCA = 8;

export interface SeletorAtividadeProps {
  /** Ex.: "Atividade das NF-e e NFC-e" */
  rotulo: string;
  opcoes: AtividadeSimples[];
  /** cAtivSN escolhido. */
  valor?: string;
  aoMudar: (codigo: string) => void;
  /** Mensagem sob o campo (ex.: atividade indisponível). */
  erro?: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Botão que mostra a atividade escolhida e abre a lista numa Folha (janela no computador, folha de baixo
 * no celular), com busca quando há mais de 8 opções. Escolher fecha a folha.
 */
export default function SeletorAtividade({ rotulo, opcoes, valor, aoMudar, erro }: SeletorAtividadeProps) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const idRotulo = useId();
  const idValor = useId();
  const idErro = useId();
  const escolhida = opcoes.find((o) => o.codigo === valor);
  const comBusca = opcoes.length > OPCOES_PARA_BUSCA;
  const termo = semAcento(busca.trim());
  const filtradas = termo ? opcoes.filter((o) => semAcento(`${o.codigo} ${o.descricao}`).includes(termo)) : opcoes;

  function fechar() {
    setAberta(false);
    setBusca('');
  }

  function escolher(codigo: string) {
    aoMudar(codigo);
    fechar();
  }

  // Setas só movem o foco (a seleção nativa do radio fecharia a folha antes de a pessoa decidir); Enter escolhe.
  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const radios = [...e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const i = radios.indexOf(document.activeElement as HTMLInputElement);
    if (i < 0) return;
    const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (passo) {
      e.preventDefault();
      radios[(i + passo + radios.length) % radios.length].focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      radios[i].click();
    }
  }

  return (
    <div className="seletor-atividade">
      <span id={idRotulo} className="seletor-atividade__rotulo">
        {rotulo}
      </span>
      <button
        type="button"
        className={['seletor-atividade__botao', erro && 'seletor-atividade__botao--erro'].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        aria-labelledby={`${idRotulo} ${idValor}`}
        title={escolhida?.descricao}
        aria-describedby={erro ? idErro : undefined}
        onClick={() => setAberta(true)}
      >
        <span id={idValor} className="seletor-atividade__valor">
          {escolhida ? (
            <>
              <strong>{escolhida.codigo}</strong>
              {' · '}
              {escolhida.descricao}
            </>
          ) : (
            <span className="seletor-atividade__vazio">Escolher atividade</span>
          )}
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>
      {erro && (
        <p id={idErro} className="seletor-atividade__erro">
          {erro}
        </p>
      )}

      <Folha aberta={aberta} titulo={rotulo} aoFechar={fechar}>
        {comBusca && (
          <label className="seletor-atividade__busca">
            <Search size={16} aria-hidden />
            <input
              type="search"
              aria-label="Buscar atividade"
              placeholder="Buscar por código ou descrição"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
        )}
        <div role="radiogroup" aria-label={rotulo} className="seletor-atividade__lista" onKeyDown={aoTeclar}>
          {filtradas.map((o) => {
            const idOpcao = `${idRotulo}-${o.codigo}`;
            return (
              <div key={o.codigo} className="seletor-atividade__opcao">
                <input
                  type="radio"
                  id={idOpcao}
                  name={idRotulo}
                  defaultChecked={o.codigo === valor}
                  onClick={() => escolher(o.codigo)}
                />
                <label htmlFor={idOpcao} className="seletor-atividade__textos">
                  <span className="seletor-atividade__descricao">
                    <strong>{o.codigo}</strong> {o.descricao}
                  </span>
                  <span className="seletor-atividade__anexo">
                    {o.disponivel ? `Anexo ${o.rotuloAnexo}` : `Anexo ${o.rotuloAnexo} · indisponível`}
                  </span>
                </label>
              </div>
            );
          })}
          {filtradas.length === 0 && <p className="seletor-atividade__vazia">Nenhuma atividade encontrada.</p>}
        </div>
      </Folha>
    </div>
  );
}
