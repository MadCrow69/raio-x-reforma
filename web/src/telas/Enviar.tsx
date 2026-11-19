import { ArrowRight, CircleAlert, CircleCheck, FileUp, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent } from 'react';
import { ROTULO_MOTIVO_IGNORADO, ROTULO_TIPO } from '../auditoria/rotulos';
import { lerArquivos } from '../leitura/lerArquivos';
import type { DocumentoIgnorado, MotivoIgnorado, ResultadoLeitura, TipoDocumento } from '../leitura/tipos';
import { ANO_SIMULADO } from '../motor/montarRequisicoes';
import Aviso, { type DadosAviso } from '../ui/componentes/Aviso';
import Botao from '../ui/componentes/Botao';
import Esqueleto from '../ui/componentes/Esqueleto';
import ListaAgrupada, { ItemLista, ItemListaRecolhivel } from '../ui/componentes/ListaAgrupada';
import { contar, formatarPeriodo } from '../ui/formatar';
import ArquivosIgnorados from './ArquivosIgnorados';
import './Enviar.css';

export interface EnviarProps {
  /** Entrega a leitura e os arquivos que a geraram (o fluxo os guarda para o "Voltar" do passo 2). */
  aoContinuar: (leitura: ResultadoLeitura, arquivos: File[]) => void;
  /** Volta do passo 2: reabre o passo 1 com os arquivos e a leitura de antes. */
  inicial?: { leitura: ResultadoLeitura; arquivos: File[] };
}

const ORDEM_TIPOS: TipoDocumento[] = ['NFE', 'NFCE', 'NFSE'];

const PRIVACIDADE =
  'Seus arquivos são lidos no seu navegador. Só os valores dos itens vão para o cálculo e nada é guardado.';

function arquivosDoEvento(lista: FileList | null | undefined): File[] {
  return lista ? Array.from(lista) : [];
}

/** Passo 1: soltar/escolher XMLs e ZIPs; mostra o que foi lido e o que ficou de fora, com o motivo. */
export default function Enviar({ aoContinuar, inicial }: EnviarProps) {
  const [arquivos, setArquivos] = useState<File[]>(inicial?.arquivos ?? []);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(inicial?.leitura ?? null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<DadosAviso | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const arquivosRef = useRef<File[]>(inicial?.arquivos ?? []);
  const geracao = useRef(0);
  const idMotivo = useId();

  async function adicionar(novos: File[]) {
    if (novos.length === 0) return;
    const anteriores = arquivosRef.current;
    const todos = [...anteriores, ...novos];
    arquivosRef.current = todos;
    setArquivos(todos);
    setLendo(true);
    setAviso(null);
    const minha = ++geracao.current;
    try {
      // Relê tudo: a deduplicação pela chave de acesso fica num lugar só (lerArquivos).
      const r = await lerArquivos(todos);
      if (minha === geracao.current) setLeitura(r);
    } catch {
      if (minha !== geracao.current) return;
      arquivosRef.current = anteriores;
      setArquivos(anteriores);
      setAviso({
        tipo: 'erro',
        titulo: 'Não foi possível ler os arquivos',
        detalhe: 'Envie de novo. Se o erro continuar, confira se os arquivos não estão abertos em outro programa.',
      });
    } finally {
      if (minha === geracao.current) setLendo(false);
    }
  }

  function recomecar() {
    geracao.current++;
    arquivosRef.current = [];
    setArquivos([]);
    setLeitura(null);
    setLendo(false);
    setAviso(null);
  }

  const adicionarRef = useRef(adicionar);
  useEffect(() => {
    adicionarRef.current = adicionar;
  });

  // Arquivo solto fora da área não pode abrir o XML no navegador (perderia a análise): entra também.
  useEffect(() => {
    const aoArrastarSobre = (e: globalThis.DragEvent) => e.preventDefault();
    const aoSoltar = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      void adicionarRef.current(arquivosDoEvento(e.dataTransfer?.files));
    };
    window.addEventListener('dragover', aoArrastarSobre);
    window.addEventListener('drop', aoSoltar);
    return () => {
      window.removeEventListener('dragover', aoArrastarSobre);
      window.removeEventListener('drop', aoSoltar);
    };
  }, []);

  function aoArrastar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!arrastando) setArrastando(true);
  }

  function aoSair(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    void adicionar(arquivosDoEvento(e.dataTransfer?.files));
  }

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    void adicionar(arquivosDoEvento(e.target.files));
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
  }

  function abrirSeletor(e: MouseEvent) {
    // Clique no botão ou no próprio input já abre o seletor (o clique do input sobe até aqui).
    if ((e.target as HTMLElement).closest('button, input')) return;
    entrada.current?.click();
  }

  const resumo = useMemo(() => (leitura ? resumir(leitura) : null), [leitura]);
  const temArquivos = arquivos.length > 0;
  const podeContinuar = !lendo && leitura !== null && leitura.documentos.length > 0;

  return (
    <div className="enviar">
      <header className="enviar__cabecalho">
        <h1 className="enviar__titulo">Envie as notas da empresa</h1>
        <p className="enviar__lide">
          Fico no Simples ou passo o IBS e a CBS para fora dele? Descubra com as notas reais da empresa,
          calculadas pelos motores oficiais da Receita Federal.
        </p>
      </header>

      <div
        data-testid="zona-envio"
        className={['zona-envio', temArquivos && 'zona-envio--compacta', arrastando && 'zona-envio--arrastando']
          .filter(Boolean)
          .join(' ')}
        onDragEnter={aoArrastar}
        onDragOver={aoArrastar}
        onDragLeave={aoSair}
        onDrop={aoSoltar}
        onClick={abrirSeletor}
      >
        <span className="zona-envio__icone" aria-hidden>
          <FileUp size={temArquivos ? 22 : 28} />
        </span>
        <div className="zona-envio__textos">
          <p className="zona-envio__titulo">
            {temArquivos ? 'Arraste mais arquivos para somar' : 'Arraste os XMLs ou um ZIP das notas'}
          </p>
          {(arrastando || !temArquivos) && (
            <p className="zona-envio__detalhe">
              {arrastando ? 'Solte para ler as notas.' : 'NF-e, NFC-e e NFS-e nacional, de vendas e de compras.'}
            </p>
          )}
        </div>
        <Botao
          variante={temArquivos ? 'secundario' : 'primario'}
          onClick={() => entrada.current?.click()}
          className="zona-envio__botao"
        >
          {temArquivos ? 'Adicionar arquivos' : 'Escolher arquivos'}
        </Botao>
        <input
          ref={entrada}
          type="file"
          multiple
          accept=".xml,.zip"
          hidden
          onChange={aoEscolher}
        />
      </div>

      <p className="enviar__privacidade">
        <ShieldCheck size={16} aria-hidden />
        <span>{PRIVACIDADE}</span>
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {lendo ? 'Lendo arquivos…' : resumo ? resumo.anuncio : ''}
      </p>

      {lendo && <Esqueleto rotulo={`Lendo ${contar(arquivos.length, 'arquivo', 'arquivos')}…`} linhas={2} />}

      {!lendo && leitura && resumo && (
        <div className="enviar__resultado">
          <ListaAgrupada
            titulo="Leitura"
            rodape={
              <>
                {contar(arquivos.length, 'arquivo enviado', 'arquivos enviados')}
                {resumo.temNotasAnterioresA2027 &&
                  ` · Notas anteriores a ${ANO_SIMULADO} serão simuladas como se fossem de ${ANO_SIMULADO}.`}
              </>
            }
          >
            {leitura.documentos.length > 0 ? (
              <ItemLista
                icone={<CircleCheck size={22} color="var(--cor-sucesso)" aria-hidden />}
                titulo={resumo.notas}
                detalhe={resumo.porTipo}
                valor={resumo.periodo}
              />
            ) : (
              <ItemLista
                icone={<CircleAlert size={22} color="var(--cor-erro)" aria-hidden />}
                titulo="Nenhuma nota lida"
                detalhe="Nenhum arquivo é uma NF-e, NFC-e ou NFS-e nacional válida."
              />
            )}
            {leitura.ignorados.length > 0 && (
              <ItemLista
                icone={<CircleAlert size={22} color="var(--cor-alerta)" aria-hidden />}
                titulo={resumo.ignorados}
                detalhe={
                  leitura.ignorados.length === 1
                    ? 'Fica fora do cálculo. Veja o motivo abaixo.'
                    : 'Ficam fora do cálculo. Veja os motivos abaixo.'
                }
              />
            )}
          </ListaAgrupada>

          {resumo.gruposIgnorados.length > 0 && (
            <ListaAgrupada titulo="Ignorados por motivo">
              {resumo.gruposIgnorados.map((g) => (
                <ItemListaRecolhivel key={g.motivo} titulo={ROTULO_MOTIVO_IGNORADO[g.motivo]} valor={g.itens.length}>
                  <ArquivosIgnorados itens={g.itens} />
                </ItemListaRecolhivel>
              ))}
            </ListaAgrupada>
          )}
        </div>
      )}

      <div className="enviar__acoes">
        {temArquivos && (
          <Botao variante="simples" icone={RotateCcw} onClick={recomecar}>
            Recomeçar
          </Botao>
        )}
        <div className="enviar__continuar">
          {!podeContinuar && (
            <p id={idMotivo} className="enviar__motivo">
              {lendo ? 'Lendo arquivos…' : 'Envie ao menos uma nota válida para continuar.'}
            </p>
          )}
          <Botao
            variante="primario"
            icone={ArrowRight}
            iconeDepois
            disabled={!podeContinuar}
            aria-describedby={podeContinuar ? undefined : idMotivo}
            onClick={() => leitura && aoContinuar(leitura, arquivos)}
          >
            Continuar
          </Botao>
        </div>
      </div>

      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
    </div>
  );
}

interface Resumo {
  /** Frase para o leitor de tela ao terminar a leitura. */
  anuncio: string;
  notas: string;
  ignorados: string;
  porTipo: string;
  periodo: string;
  temNotasAnterioresA2027: boolean;
  gruposIgnorados: { motivo: MotivoIgnorado; itens: DocumentoIgnorado[] }[];
}

function resumir(leitura: ResultadoLeitura): Resumo {
  const porTipo = new Map<TipoDocumento, number>();
  for (const d of leitura.documentos) porTipo.set(d.tipo, (porTipo.get(d.tipo) ?? 0) + 1);

  const porMotivo = new Map<MotivoIgnorado, DocumentoIgnorado[]>();
  for (const d of leitura.ignorados) {
    const grupo = porMotivo.get(d.motivo);
    if (grupo) grupo.push(d);
    else porMotivo.set(d.motivo, [d]);
  }

  const emissoes = leitura.documentos.map((d) => d.emissao);
  const notas = contar(leitura.documentos.length, 'nota lida', 'notas lidas');
  const ignorados = contar(leitura.ignorados.length, 'arquivo ignorado', 'arquivos ignorados');
  return {
    anuncio: leitura.ignorados.length > 0 ? `${notas}, ${ignorados}.` : `${notas}.`,
    notas,
    ignorados,
    porTipo: ORDEM_TIPOS.filter((t) => porTipo.has(t))
      .map((t) => `${porTipo.get(t)?.toLocaleString('pt-BR')} ${ROTULO_TIPO[t]}`)
      .join(' · '),
    periodo: formatarPeriodo(emissoes),
    temNotasAnterioresA2027: emissoes.some((e) => e.slice(0, 4) < ANO_SIMULADO),
    gruposIgnorados: [...porMotivo]
      .map(([motivo, itens]) => ({ motivo, itens }))
      .sort((a, b) => b.itens.length - a.itens.length),
  };
}
