import { useMemo, useState } from 'react';
import type { LinhaAuditoria } from '../auditoria/auditar';
import { ROTULO_ORIGEM_MEMORIA, ROTULO_PAPEL } from '../auditoria/rotulos';
import { TAMANHO_PADRAO, TAMANHOS_PAGINA, idLinha, mesmoFoco, normalizar, type FocoMemoria } from '../auditoria/tabela';
import Botao from '../ui/componentes/Botao';
import Paginacao from '../ui/componentes/Paginacao';
import { contar } from '../ui/formatar';
import './Memoria.css';
import SeloAchado from './SeloAchado';

export interface MemoriaProps {
  linhas: LinhaAuditoria[];
  /** Item aberto a partir da Auditoria: mostra só ele, até "Ver todos os itens". */
  foco: FocoMemoria | null;
  aoLimparFoco: () => void;
}

function Item({ l }: { l: LinhaAuditoria }) {
  const origem = l.origemMemoria;
  return (
    <article className="memoria__item" aria-label={`Memória de cálculo do item ${l.item} da nota ${l.numeroNota}`}>
      <header className="memoria__topo">
        <h3 className="memoria__titulo">{`Nota ${l.numeroNota} · item ${l.item}`}</h3>
        <SeloAchado achado={l.achado} />
      </header>
      <p className="memoria__descricao">{l.descricao}</p>
      <p className="memoria__meta">{[ROTULO_PAPEL[l.papel], l.ncmOuNbs && `NCM/NBS ${l.ncmOuNbs}`].filter(Boolean).join(' · ')}</p>
      {l.memoria !== '' ? (
        <>
          {origem && <p className={`memoria__origem memoria__origem--${origem.toLowerCase()}`}>{ROTULO_ORIGEM_MEMORIA[origem]}</p>}
          <pre className="memoria__texto">{l.memoria}</pre>
        </>
      ) : (
        <div className="memoria__sem">
          <p>O motor não devolveu memória de cálculo para este item.</p>
          {l.erros.length > 0 && (
            <ul className="memoria__erros">
              {l.erros.map((e) => (
                <li key={`${e.code}${e.pointer ?? ''}`}>
                  <strong>{e.code}</strong>
                  {` · ${e.title}${e.detail ? `. ${e.detail}` : ''}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

/** Aba Memória de cálculo: o texto do cálculo de cada item, com busca; a origem do texto vem sempre rotulada. */
export default function Memoria({ linhas, foco, aoLimparFoco }: MemoriaProps) {
  const [busca, setBusca] = useState('');
  const [tamanho, setTamanho] = useState<number>(TAMANHO_PADRAO);
  const [pagina, setPagina] = useState(1);

  const comMemoria = useMemo(() => linhas.filter((l) => l.memoria !== ''), [linhas]);
  const q = normalizar(busca.trim());
  const filtradas = useMemo(
    () => (q ? comMemoria.filter((l) => [l.numeroNota, l.descricao, l.memoria].some((t) => normalizar(t).includes(q))) : comMemoria),
    [comMemoria, q],
  );
  const paginas = Math.max(1, Math.ceil(filtradas.length / tamanho));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((atual - 1) * tamanho, atual * tamanho);
  const emFoco = foco ? linhas.find((l) => mesmoFoco(l, foco)) : undefined;

  return (
    <section className="memoria" aria-labelledby="memoria-titulo">
      <div className="memoria__cabecalho">
        <h2 id="memoria-titulo" className="memoria__secao">
          Memória de cálculo
        </h2>
        <p className="memoria__resumo">{contar(comMemoria.length, 'item com memória', 'itens com memória')}</p>
      </div>

      {emFoco ? (
        <>
          <div className="memoria__foco">
            <p>Mostrando só o item escolhido na Auditoria.</p>
            <Botao variante="secundario" onClick={aoLimparFoco}>
              Ver todos os itens
            </Botao>
          </div>
          <div className="memoria__lista">
            <Item l={emFoco} />
          </div>
        </>
      ) : comMemoria.length === 0 ? (
        <div className="memoria__vazio">
          <p className="memoria__vazio-titulo">Nenhum item tem memória de cálculo</p>
          <p className="memoria__vazio-texto">O motor não devolveu o detalhe do cálculo para nenhum item.</p>
        </div>
      ) : (
        <>
          <label className="memoria__busca">
            <input
              type="search"
              aria-label="Buscar por nota, descrição ou texto da memória"
              placeholder="Buscar por nota, descrição ou texto da memória"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              autoComplete="off"
            />
          </label>
          {filtradas.length === 0 ? (
            <div className="memoria__vazio">
              <p className="memoria__vazio-titulo">Nenhum item para esta busca</p>
              <Botao
                variante="simples"
                onClick={() => {
                  setBusca('');
                  setPagina(1);
                }}
              >
                Limpar busca
              </Botao>
            </div>
          ) : (
            <>
              <div className="memoria__lista">
                {visiveis.map((l) => (
                  <Item key={idLinha(l)} l={l} />
                ))}
              </div>
              <Paginacao
                total={filtradas.length}
                pagina={atual}
                tamanho={tamanho}
                tamanhos={TAMANHOS_PAGINA}
                aoMudarPagina={setPagina}
                aoMudarTamanho={(t) => {
                  setTamanho(t);
                  setPagina(1);
                }}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
