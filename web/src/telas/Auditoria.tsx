import type Big from 'big.js';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import { paraCsv } from '../auditoria/csv';
import {
  DIMENSOES, TAMANHOS_PAGINA, filtrar, idLinha, opcoesDe, ordenar, semCalculo,
  SEM_FILTROS, type ColunaId, type Dimensao, type EstadoAuditoria,
} from '../auditoria/tabela';
import { baixarTexto } from '../ui/baixar';
import Aviso, { type DadosAviso } from '../ui/componentes/Aviso';
import Botao from '../ui/componentes/Botao';
import Filtros, { type DimensaoFiltro } from '../ui/componentes/Filtros';
import Paginacao from '../ui/componentes/Paginacao';
import Tabela, { type ColunaTabela } from '../ui/componentes/Tabela';
import { contar, formatarMoeda } from '../ui/formatar';
import { ROTULO_PAPEL, ROTULO_TIPO } from '../auditoria/rotulos';
import './Auditoria.css';
import SeloAchado from './SeloAchado';

export interface AuditoriaProps {
  linhas: LinhaAuditoria[];
  /** Busca, filtros, ordem e página: ficam com quem hospeda a tela, para sobreviverem à troca de aba. */
  estado: EstadoAuditoria;
  aoMudarEstado: (estado: EstadoAuditoria) => void;
  /** Abre a Memória de cálculo focada neste item. */
  aoAbrirMemoria: (linha: LinhaAuditoria) => void;
}

const NOME_ARQUIVO = 'raio-x-auditoria.csv';
const ROTULO_DIMENSAO: Record<Dimensao, string> = { achado: 'Achado', erro: 'Código de erro', papel: 'Papel', tipo: 'Tipo de nota' };

const moeda = (v?: Big) => (v ? formatarMoeda(v) : '—');

const dicaErros = (l: LinhaAuditoria) => (l.erros.length > 0 ? l.erros.map((e) => `${e.code} — ${e.title}`).join('\n') : undefined);

function Erros({ l }: { l: LinhaAuditoria }) {
  if (l.erros.length === 0) return null;
  const [primeiro, ...resto] = l.erros;
  return (
    <>
      <strong className="auditoria__codigo">{primeiro.code}</strong>
      {` · ${primeiro.title}`}
      {resto.length > 0 && ` +${resto.length}`}
    </>
  );
}

const valorMotor = (l: LinhaAuditoria) => (semCalculo(l) ? '—' : formatarMoeda(l.vMotor));

const COLUNAS: ColunaTabela<LinhaAuditoria, ColunaId>[] = [
  { id: 'nota', titulo: 'Nota', abre: true, celula: (l) => l.numeroNota },
  { id: 'papel', titulo: 'Papel', celula: (l) => ROTULO_PAPEL[l.papel] },
  { id: 'tipo', titulo: 'Tipo', celula: (l) => ROTULO_TIPO[l.tipo] },
  { id: 'item', titulo: 'Item', numerica: true, celula: (l) => l.item },
  { id: 'descricao', titulo: 'Descrição', elastica: true, celula: (l) => l.descricao, dica: (l) => l.descricao },
  { id: 'ncmOuNbs', titulo: 'NCM/NBS', celula: (l) => l.ncmOuNbs },
  { id: 'cst', titulo: 'CST', celula: (l) => l.cst },
  { id: 'cClassTrib', titulo: 'cClassTrib', celula: (l) => l.cClassTrib },
  { id: 'achado', titulo: 'Achado', celula: (l) => <SeloAchado achado={l.achado} /> },
  { id: 'erro', titulo: 'Código de erro', trunca: true, celula: (l) => <Erros l={l} />, dica: dicaErros },
  { id: 'vNota', titulo: 'Valor na nota', numerica: true, celula: (l) => moeda(l.vNota) },
  { id: 'vMotor', titulo: 'Valor do motor', numerica: true, celula: valorMotor },
  { id: 'diferenca', titulo: 'Diferença', numerica: true, celula: (l) => moeda(l.diferenca) },
];

function Cartao({ l }: { l: LinhaAuditoria }) {
  return (
    <>
      <span className="auditoria__cartao-topo">
        <strong>{`Nota ${l.numeroNota} · item ${l.item}`}</strong>
        <SeloAchado achado={l.achado} />
      </span>
      <span className="auditoria__cartao-descricao">{l.descricao}</span>
      {l.erros.length > 0 && (
        <span className="auditoria__cartao-meta">
          <Erros l={l} />
        </span>
      )}
      <span className="auditoria__cartao-meta">
        {[ROTULO_PAPEL[l.papel], ROTULO_TIPO[l.tipo], l.ncmOuNbs && `NCM/NBS ${l.ncmOuNbs}`, `motor ${valorMotor(l)}`, `nota ${moeda(l.vNota)}`]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </>
  );
}

/** Auditoria: um item por linha, com busca, filtros, ordenação, paginação, exportação e acesso à memória de cálculo. */
export default function Auditoria({ linhas, estado, aoMudarEstado, aoAbrirMemoria }: AuditoriaProps) {
  const [aviso, setAviso] = useState<DadosAviso | null>(null);
  const { busca, filtros, ordem, tamanho } = estado;

  const filtradas = useMemo(() => filtrar(linhas, busca, filtros), [linhas, busca, filtros]);
  const ordenadas = useMemo(() => ordenar(filtradas, ordem), [filtradas, ordem]);
  const paginas = Math.max(1, Math.ceil(ordenadas.length / tamanho));
  const pagina = Math.min(estado.pagina, paginas);
  const visiveis = ordenadas.slice((pagina - 1) * tamanho, pagina * tamanho);

  const dimensoes = useMemo<DimensaoFiltro[]>(
    () =>
      DIMENSOES.map((d) => ({ id: d, rotulo: ROTULO_DIMENSAO[d], opcoes: opcoesDe(linhas, busca, filtros, d), selecionados: filtros[d] })).filter(
        (d) => d.opcoes.length > 0,
      ),
    [linhas, busca, filtros],
  );

  const mudar = (parcial: Partial<EstadoAuditoria>) => aoMudarEstado({ ...estado, pagina: 1, ...parcial });
  const limpar = () => mudar({ busca: '', filtros: SEM_FILTROS });
  const comAchado = linhas.filter((l) => l.achado !== 'OK').length;

  function exportar() {
    baixarTexto(NOME_ARQUIVO, paraCsv(ordenadas), 'text/csv;charset=utf-8');
    setAviso({ tipo: 'sucesso', titulo: `CSV exportado · ${contar(ordenadas.length, 'item', 'itens')}`, detalhe: NOME_ARQUIVO });
  }

  return (
    <section className="auditoria" aria-labelledby="auditoria-titulo">
      <div className="auditoria__cabecalho">
        <h2 id="auditoria-titulo" className="auditoria__titulo">
          Auditoria
        </h2>
        <p className="auditoria__resumo">{`${contar(linhas.length, 'item analisado', 'itens analisados')} · ${comAchado.toLocaleString('pt-BR')} com achado`}</p>
      </div>

      <Filtros
        busca={busca}
        aoBuscar={(texto) => mudar({ busca: texto })}
        rotuloBusca="Buscar por nota, descrição, NCM/NBS ou cClassTrib"
        dimensoes={dimensoes}
        aoSelecionar={(d, valores) => mudar({ filtros: { ...filtros, [d]: valores } })}
        aoLimparTudo={limpar}
        totalResultados={filtradas.length}
        acoes={
          <Botao variante="secundario" icone={Download} disabled={ordenadas.length === 0} onClick={exportar}>
            Exportar CSV
          </Botao>
        }
      />

      {linhas.length === 0 ? (
        <div className="auditoria__vazio">
          <p className="auditoria__vazio-titulo">Nenhum item foi analisado</p>
          <p className="auditoria__vazio-texto">As notas enviadas não tiveram itens para auditar.</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="auditoria__vazio">
          <p className="auditoria__vazio-titulo">Nenhum item para estes filtros</p>
          <Botao variante="simples" onClick={limpar}>
            Limpar filtros
          </Botao>
        </div>
      ) : (
        <>
          <Tabela
            legenda="Itens da auditoria"
            colunas={COLUNAS}
            linhas={visiveis}
            chaveLinha={idLinha}
            ordem={ordem}
            aoOrdenar={(o) => mudar({ ordem: o })}
            aoAbrir={aoAbrirMemoria}
            rotuloAbrir={(l) => `Abrir a memória de cálculo do item ${l.item} da nota ${l.numeroNota}`}
            cartao={(l) => <Cartao l={l} />}
            rotuloCartoes="Itens da auditoria"
          />
          <Paginacao
            total={ordenadas.length}
            pagina={pagina}
            tamanho={tamanho}
            tamanhos={TAMANHOS_PAGINA}
            aoMudarPagina={(p) => aoMudarEstado({ ...estado, pagina: p })}
            aoMudarTamanho={(t) => mudar({ tamanho: t })}
          />
        </>
      )}

      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
    </section>
  );
}
