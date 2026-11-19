import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { GrupoClassificacao, OpcaoClassificacao } from '../classificacao/sugestoes';
import Botao from '../ui/componentes/Botao';
import ListaAgrupada, { ItemLista } from '../ui/componentes/ListaAgrupada';
import Segmentado from '../ui/componentes/Segmentado';
import { contar, formatarMoeda } from '../ui/formatar';
import './ConfirmarClassificacao.css';
import { opcaoEscolhida } from './escolhaClassificacao';

/** Grupos mostrados por vez (o resto vem em "Mostrar mais"). */
const GRUPOS_POR_PAGINA = 25;
/** Até este número de opções a escolha é um controle segmentado; acima, uma lista de seleção. */
const OPCOES_NO_SEGMENTADO = 3;

const ROTULO_ORIGEM: Record<GrupoClassificacao['origem'], string> = {
  NOTA: 'da nota',
  TABELA: 'tabela oficial — confirme se a redução se aplica',
  PADRAO: 'padrão',
};

/** NCM 61091000 → "6109.10.00"; outros códigos ficam como vêm. */
function formatarCodigo(g: GrupoClassificacao): string {
  if (g.tipo === 'SEM_CODIGO') return 'Sem NCM nem NBS';
  if (g.tipo === 'NBS') return `NBS ${g.codigo}`;
  const c = g.codigo;
  return `NCM ${c.length === 8 ? `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6)}` : c}`;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface ConfirmarClassificacaoProps {
  grupos: GrupoClassificacao[];
  /** chave do grupo → cClassTrib escolhido no lugar da sugestão. */
  trocas: Record<string, string>;
  aoEscolher: (chave: string, cClassTrib: string) => void;
}

/** Confirmação do cClassTrib por grupo de NCM/NBS: maior valor primeiro, com busca e "Mostrar mais". */
export default function ConfirmarClassificacao({ grupos, trocas, aoEscolher }: ConfirmarClassificacaoProps) {
  const idTitulo = useId();
  const [busca, setBusca] = useState('');
  const [visiveis, setVisiveis] = useState(GRUPOS_POR_PAGINA);

  const ordenados = useMemo(() => [...grupos].sort((a, b) => b.valor.cmp(a.valor)), [grupos]);
  const filtrados = useMemo(() => {
    const texto = semAcento(busca.trim());
    if (!texto) return ordenados;
    const digitos = texto.replace(/\D/g, '');
    return ordenados.filter((g) => {
      const o = opcaoEscolhida(g, trocas);
      return (
        (digitos !== '' && g.codigo.includes(digitos)) ||
        o.cClassTrib.includes(texto) ||
        semAcento(`${formatarCodigo(g)} ${o.descricao}`).includes(texto)
      );
    });
  }, [ordenados, busca, trocas]);

  const restantes = filtrados.length - visiveis;
  const total = contar(grupos.length, 'grupo', 'grupos');

  return (
    <section className="classificacao" aria-labelledby={idTitulo}>
      <header className="classificacao__cabecalho">
        <h2 id={idTitulo} className="classificacao__titulo">
          Classificação IBS/CBS
        </h2>
        <p className="classificacao__lide">
          Cada grupo de NCM ou NBS já vem com a classificação sugerida. Troque só o que estiver diferente na sua
          operação.
        </p>
      </header>

      <div className="classificacao__barra">
        <label className="classificacao__busca">
          <Search size={16} aria-hidden />
          <input
            type="search"
            aria-label="Buscar NCM ou NBS"
            placeholder="Buscar NCM, NBS ou classificação"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setVisiveis(GRUPOS_POR_PAGINA);
            }}
          />
        </label>
        <p className="classificacao__contagem" role="status">
          {busca.trim() ? `${filtrados.length.toLocaleString('pt-BR')} de ${total}` : total}
        </p>
      </div>

      <ListaAgrupada>
        {filtrados.slice(0, visiveis).map((g) => (
          <LinhaGrupo key={g.chave} grupo={g} escolhida={opcaoEscolhida(g, trocas)} aoEscolher={aoEscolher} />
        ))}
        {filtrados.length === 0 && <ItemLista titulo="Nenhum grupo encontrado." />}
      </ListaAgrupada>

      {restantes > 0 && (
        <Botao variante="simples" onClick={() => setVisiveis((v) => v + GRUPOS_POR_PAGINA)}>
          Mostrar mais {Math.min(restantes, GRUPOS_POR_PAGINA)} de {restantes}
        </Botao>
      )}
    </section>
  );
}

interface LinhaGrupoProps {
  grupo: GrupoClassificacao;
  escolhida: OpcaoClassificacao;
  aoEscolher: (chave: string, cClassTrib: string) => void;
}

function LinhaGrupo({ grupo, escolhida, aoEscolher }: LinhaGrupoProps) {
  const nome = formatarCodigo(grupo);
  const rotuloGrupo = `Classificação de ${nome}`;
  const opcoes = grupo.opcoes;
  return (
    <ItemLista
      titulo={nome}
      detalhe={`${contar(grupo.itens, 'item', 'itens')} · ${ROTULO_ORIGEM[grupo.origem]}`}
      valor={formatarMoeda(grupo.valor)}
      controle={
        <>
          {opcoes.length > 1 && opcoes.length <= OPCOES_NO_SEGMENTADO && (
            <Segmentado
              modo="escolha"
              rotulo={rotuloGrupo}
              opcoes={opcoes.map((o) => ({ valor: o.cClassTrib, rotulo: o.cClassTrib }))}
              valor={escolhida.cClassTrib}
              aoMudar={(c) => aoEscolher(grupo.chave, c)}
            />
          )}
          {opcoes.length > OPCOES_NO_SEGMENTADO && (
            <select
              className="classificacao__selecao"
              aria-label={rotuloGrupo}
              value={escolhida.cClassTrib}
              onChange={(e) => aoEscolher(grupo.chave, e.target.value)}
            >
              {opcoes.map((o) => (
                <option key={o.cClassTrib} value={o.cClassTrib}>
                  {o.cClassTrib} · {o.descricao}
                </option>
              ))}
            </select>
          )}
          <p className="classificacao__descricao">
            CST {escolhida.cst} · {escolhida.cClassTrib} · {escolhida.descricao}
          </p>
        </>
      }
    />
  );
}
