import Big from 'big.js';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ROTULO_MOTIVO_IGNORADO } from '../auditoria/rotulos';
import { agruparParaConfirmacao, carregarSugestoes, type Classificacoes } from '../classificacao/sugestoes';
import { calc } from '../dominio/decimal';
import { cnpjValido, normalizarCnpj } from '../dominio/cnpj';
import { separar } from '../dominio/separar';
import type { DocumentoIgnorado, MotivoIgnorado, ResultadoLeitura, TipoDocumento } from '../leitura/tipos';
import {
  atividadesParaTipos,
  carregarAtividades,
  DATA_CATALOGO,
  GRUPO_MERCADORIAS,
  GRUPO_SERVICOS,
  pedeFatorR,
  resolverAnexo,
  type AtividadeSimples,
} from '../motor/atividades';
import { ALIQUOTAS_REFERENCIA_2027, buscarAliquotasNominais } from '../motor/cliente';
import type { AliquotasNominais, ParametrosCalculo } from '../motor/tipos';
import { aliquotasSimples, LIMITE_SIMPLES, SUBLIMITE, type AliquotasSimples } from '../regras/simples/aliquotaEfetiva';
import type { OrigemCompras } from '../simulacao/simular';
import Alerta from '../ui/componentes/Alerta';
import Botao from '../ui/componentes/Botao';
import Campo, { CampoNumero } from '../ui/componentes/Campo';
import Esqueleto from '../ui/componentes/Esqueleto';
import ListaAgrupada, { ItemListaRecolhivel } from '../ui/componentes/ListaAgrupada';
import { contar, formatarMoeda, formatarNumeroBR } from '../ui/formatar';
import ArquivosIgnorados from './ArquivosIgnorados';
import { NOTA_SEXTA_FAIXA } from './avisos';
import './Confirmar.css';
import ConfirmarClassificacao from './ConfirmarClassificacao';
import { opcaoEscolhida } from './escolhaClassificacao';
import SeletorAtividade from './SeletorAtividade';
import { useCarregamento } from './useCarregamento';

/** O que a pessoa preencheu no passo 2 (só em memória): permite voltar do passo 3 sem perder nada. */
export interface RascunhoConfirmacao {
  cnpjTexto: string;
  rbt12: Big | null;
  folha: Big | null;
  percentualCompras: Big | null;
  atividadeEscolhida: Record<string, string>;
  trocas: Record<string, string>;
}

export interface ResultadoConfirmacao {
  cnpjEmpresa: string;
  parametros: ParametrosCalculo;
  origemCompras: OrigemCompras;
  rascunho: RascunhoConfirmacao;
}

export interface ConfirmarProps {
  leitura: ResultadoLeitura;
  /** CNPJ detectado nas notas (o mais frequente como emitente). */
  cnpjInicial: string;
  /** Preenchimento anterior (volta do passo 3): restaura cada campo e cada escolha de classificação. */
  rascunho?: RascunhoConfirmacao;
  aoVoltar: () => void;
  aoConfirmar: (resultado: ResultadoConfirmacao) => void;
}

/** Percentual de compras sobre o faturamento quando não há notas de compra (editável). */
export const PERCENTUAL_COMPRAS_PADRAO = '40';

const AJUDA_RBT12 =
  'Receita bruta dos 12 meses anteriores ao mês anterior ao da apuração (a partir de 2027: Res. CGSN 140, art. 21, II, “a”, na redação da Res. CGSN 190). Em início de atividade, veja o art. 22, § 2º.';
const AJUDA_FOLHA =
  'Salários, pró-labore e encargos (FGTS e INSS patronal) pagos nos 12 meses. Com folha de 28% ou mais do faturamento vale o Anexo III; abaixo disso, o V (LC 123, art. 18, § 5º-J).';

const ZERO = new Big(0);
const CEM = new Big(100);

/** Rótulo do grupo de atividade e tipos de nota que ele cobre. */
const GRUPOS = [
  { id: 'MERCADORIAS', tipos: GRUPO_MERCADORIAS, rotulo: 'Atividade das NF-e e NFC-e', nome: 'NF-e e NFC-e' },
  { id: 'SERVICOS', tipos: GRUPO_SERVICOS, rotulo: 'Atividade das NFS-e', nome: 'NFS-e' },
] as const;
type IdGrupo = (typeof GRUPOS)[number]['id'];

/** Primeiro ponto do fluxo que exige uma decisão da pessoa: cadastro da empresa, regime e classificação. */
export default function Confirmar({ leitura, cnpjInicial, rascunho, aoVoltar, aoConfirmar }: ConfirmarProps) {
  const idMotivo = useId();
  const inicialCnpj = rascunho?.cnpjTexto ?? cnpjInicial;
  const [cnpjTexto, setCnpjTexto] = useState(inicialCnpj);
  const [cnpjEfetivo, setCnpjEfetivo] = useState(normalizarCnpj(inicialCnpj));
  const [rbt12, setRbt12] = useState<Big | null>(rascunho?.rbt12 ?? null);
  const [folha, setFolha] = useState<Big | null>(rascunho?.folha ?? null);
  const [percentualCompras, setPercentualCompras] = useState<Big | null>(
    rascunho ? rascunho.percentualCompras : new Big(PERCENTUAL_COMPRAS_PADRAO),
  );
  const [atividadeEscolhida, setAtividadeEscolhida] = useState<Partial<Record<IdGrupo, string>>>(rascunho?.atividadeEscolhida ?? {});
  const [trocas, setTrocas] = useState<Record<string, string>>(rascunho?.trocas ?? {});
  const [calculando, setCalculando] = useState(false);

  const atividades = useCarregamento(carregarAtividades);
  const sugestoes = useCarregamento(carregarSugestoes);

  // ---- empresa: separação refeita a cada CNPJ válido (a mesma função do reducer) ----
  const cnpjOk = cnpjValido(cnpjTexto);
  const separacao = useMemo(() => separar(leitura.documentos, cnpjEfetivo), [leitura, cnpjEfetivo]);
  const { vendas, compras } = separacao;
  const ignoradosPorMotivo = useMemo(() => {
    const m = new Map<MotivoIgnorado, DocumentoIgnorado[]>();
    for (const d of separacao.ignorados) m.set(d.motivo, [...(m.get(d.motivo) ?? []), d]);
    return [...m];
  }, [separacao.ignorados]);

  function mudarCnpj(texto: string) {
    const t = texto.toUpperCase();
    setCnpjTexto(t);
    if (cnpjValido(t)) setCnpjEfetivo(normalizarCnpj(t));
  }

  // ---- atividades por tipo de nota presente nas vendas ----
  const tiposPresentes = new Set<TipoDocumento>(vendas.map((d) => d.tipo));
  const gruposNecessarios = GRUPOS.filter((g) => g.tipos.some((t) => tiposPresentes.has(t)));
  const catalogo = atividades.situacao === 'pronto' ? atividades.dados : null;
  const escolhidas = gruposNecessarios.map((g) => ({
    grupo: g,
    atividade: catalogo?.find((a) => a.codigo === atividadeEscolhida[g.id]),
  }));

  // ---- faturamento ----
  const rbt12Erro =
    rbt12 === null
      ? undefined
      : rbt12.lte(ZERO)
        ? 'Informe o faturamento dos últimos 12 meses (maior que zero).'
        : rbt12.gt(LIMITE_SIMPLES)
          ? `Acima do limite do Simples Nacional (${formatarMoeda(LIMITE_SIMPLES)}): a empresa não pode optar pelo Simples.`
          : undefined;
  const acimaDoSublimite = rbt12 !== null && !rbt12Erro && rbt12.gt(SUBLIMITE);
  const rbt12Valido = rbt12 !== null && !rbt12Erro ? rbt12 : null;

  // ---- Fator R e alíquotas por atividade escolhida ----
  const precisaFolha = escolhidas.some((e) => e.atividade && pedeFatorR(e.atividade));
  const indisponivel = (a: AtividadeSimples) => !a.disponivel || a.modoFatorR === 'INDISPONIVEL';
  const resolvidas = escolhidas.flatMap((e) => {
    const a = e.atividade;
    if (!a || indisponivel(a) || !rbt12Valido) return [];
    const anexo = resolverAnexo(a, rbt12Valido, folha);
    if (!anexo) return [];
    const aliquotas = aliquotasSimples(anexo, rbt12Valido);
    return 'erro' in aliquotas ? [] : [{ atividade: a, aliquotas }];
  });
  const mensagensFatorR = rbt12Valido && folha
    ? resolvidas
        .filter((r) => pedeFatorR(r.atividade))
        .map((r) => {
          const razao = calc(folha).div(rbt12Valido).times(CEM).round(1, 0); // truncado: 27,99% nunca vira "28,0%"
          return `Fator R de ${razao.toFixed(1).replace('.', ',')}%: Anexo ${r.aliquotas.anexo}.`;
        })
    : [];
  const naSextaFaixa = resolvidas.some((r) => r.aliquotas.faixa === 6);

  // ---- compras ----
  const semCompras = compras.length === 0;
  const percentualInvalido = semCompras && (percentualCompras === null || percentualCompras.gt(CEM));

  // ---- classificação ----
  const tabela = sugestoes.situacao === 'pronto' ? sugestoes.dados : null;
  const grupos = useMemo(
    () => (tabela ? agruparParaConfirmacao([...vendas, ...compras].flatMap((d) => d.itens), tabela) : []),
    [tabela, vendas, compras],
  );

  // ---- o que falta para calcular ----
  const motivo = (() => {
    if (!cnpjOk) return 'Corrija o CNPJ para continuar.';
    if (vendas.length === 0) return 'Sem notas de venda desta empresa para calcular.';
    if (rbt12 === null) return 'Informe o faturamento dos últimos 12 meses.';
    if (rbt12Erro) return 'Corrija o faturamento para continuar.';
    if (atividades.situacao !== 'pronto') return 'Aguarde as atividades do Simples Nacional.';
    const semAtividade = escolhidas.find((e) => !e.atividade);
    if (semAtividade) return `Escolha a ${semAtividade.grupo.rotulo.replace('Atividade', 'atividade')}.`;
    if (escolhidas.some((e) => e.atividade && indisponivel(e.atividade))) return 'Escolha uma atividade disponível.';
    if (precisaFolha && folha === null) return 'Informe a folha de salários dos últimos 12 meses.';
    if (percentualInvalido) return 'Corrija o percentual de compras.';
    if (sugestoes.situacao !== 'pronto') return 'Aguarde as sugestões de classificação.';
    return null;
  })();

  async function calcular() {
    if (motivo || !rbt12Valido) return;
    setCalculando(true);
    try {
      const classificacoes: Classificacoes = Object.fromEntries(grupos.map((g) => [g.chave, opcaoEscolhida(g, trocas)]));
      const atividadePorTipo: ParametrosCalculo['atividadePorTipo'] = {};
      const aliquotasPorAtividade: Record<string, AliquotasSimples> = {};
      for (const e of escolhidas) {
        if (!e.atividade) continue;
        for (const t of e.grupo.tipos) if (tiposPresentes.has(t)) atividadePorTipo[t] = e.atividade.codigo;
      }
      for (const r of resolvidas) aliquotasPorAtividade[r.atividade.codigo] = r.aliquotas;

      let origemCompras: OrigemCompras;
      if (semCompras && percentualCompras) {
        origemCompras = {
          tipo: 'ESTIMADA',
          percentualSobreFaturamento: percentualCompras,
          aliquotaNominalTotal: await aliquotaNominalDaEmpresa(vendas),
        };
      } else {
        // Os créditos reais dependem do cálculo dos motores: quem calcula (passo 3) os soma e substitui este zero.
        origemCompras = { tipo: 'REAL', creditos: ZERO };
      }
      aoConfirmar({
        cnpjEmpresa: cnpjEfetivo,
        parametros: { classificacoes, atividadePorTipo, aliquotasSimples: aliquotasPorAtividade },
        origemCompras,
        rascunho: { cnpjTexto, rbt12: rbt12Valido, folha, percentualCompras, atividadeEscolhida, trocas },
      });
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="confirmar">
      <header className="confirmar__cabecalho">
        <h1 className="confirmar__titulo">Confirme a empresa</h1>
        <p className="confirmar__lide">
          Confira o CNPJ, informe o faturamento e a atividade no Simples Nacional e revise a classificação de cada produto
          ou serviço. Nada disso sai do seu navegador.
        </p>
      </header>

      <section className="confirmar__secao" aria-labelledby={`${idMotivo}-empresa`}>
        <h2 id={`${idMotivo}-empresa`} className="confirmar__subtitulo">
          Empresa
        </h2>
        <div className="confirmar__cartao">
          <Campo
            rotulo="CNPJ da empresa"
            value={cnpjTexto}
            onChange={mudarCnpj}
            erro={cnpjOk ? undefined : 'CNPJ inválido: confira os dígitos.'}
            ajuda="É o CNPJ que mais emitiu notas nos arquivos. Se estiver errado, troque: as notas são separadas de novo."
            maxLength={18}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <p className="confirmar__contagem">
            {contar(vendas.length, 'nota de venda', 'notas de venda')} · {contar(compras.length, 'nota de compra', 'notas de compra')}
          </p>
          {vendas.length === 0 && (
            <Alerta tipo="erro">Nenhuma nota de venda deste CNPJ. Confira o CNPJ ou volte e envie as notas emitidas pela empresa.</Alerta>
          )}
        </div>
        {ignoradosPorMotivo.length > 0 && (
          <ListaAgrupada
            titulo="Fora da análise"
            rodape={`${contar(separacao.ignorados.length, 'nota', 'notas')} sem relação com este CNPJ ${
              separacao.ignorados.length === 1 ? 'não entra' : 'não entram'
            } no cálculo.`}
          >
            {ignoradosPorMotivo.map(([m, itens]) => (
              <ItemListaRecolhivel key={m} titulo={ROTULO_MOTIVO_IGNORADO[m]} valor={itens.length}>
                <ArquivosIgnorados itens={itens} />
              </ItemListaRecolhivel>
            ))}
          </ListaAgrupada>
        )}
      </section>

      <section className="confirmar__secao" aria-labelledby={`${idMotivo}-regime`}>
        <h2 id={`${idMotivo}-regime`} className="confirmar__subtitulo">
          Simples Nacional
        </h2>
        <div className="confirmar__cartao">
          <CampoNumero
            rotulo="Faturamento dos últimos 12 meses"
            prefixo="R$"
            aoMudar={setRbt12}
            textoInicial={textoMoeda(rascunho?.rbt12)}
            erro={rbt12Erro}
            ajuda={AJUDA_RBT12}
            placeholder="0,00"
          />
          {acimaDoSublimite && (
            <Alerta tipo="alerta">Acima do sublimite: IBS e ICMS/ISS podem ser cobrados fora do Simples</Alerta>
          )}

          {atividades.situacao === 'carregando' && <Esqueleto rotulo="Carregando as atividades do Simples Nacional…" linhas={1} />}
          {atividades.situacao === 'erro' && (
            <FalhaDeCarga mensagem="Não foi possível carregar as atividades do Simples Nacional." aoTentar={atividades.tentarDeNovo} />
          )}
          {catalogo &&
            escolhidas.map(({ grupo, atividade }) => (
              <SeletorAtividade
                key={grupo.id}
                rotulo={grupo.rotulo}
                opcoes={atividadesParaTipos(catalogo, [...grupo.tipos])}
                valor={atividade?.codigo}
                aoMudar={(codigo) => setAtividadeEscolhida((a) => ({ ...a, [grupo.id]: codigo }))}
                erro={
                  atividade && indisponivel(atividade)
                    ? `A atividade ${atividade.codigo} não está disponível nos motores oficiais para 2027 (Fator R sem dados). Escolha outra para calcular.`
                    : undefined
                }
              />
            ))}

          {precisaFolha && (
            <>
              <CampoNumero
                rotulo="Folha de salários dos últimos 12 meses"
                prefixo="R$"
                aoMudar={setFolha}
                textoInicial={textoMoeda(rascunho?.folha)}
                ajuda={AJUDA_FOLHA}
                placeholder="0,00"
              />
              {mensagensFatorR.map((m) => (
                <p key={m} className="confirmar__resultado" role="status">
                  {m}
                </p>
              ))}
            </>
          )}

          {naSextaFaixa && <Alerta tipo="info">{NOTA_SEXTA_FAIXA}</Alerta>}
        </div>
      </section>

      <section className="confirmar__secao" aria-labelledby={`${idMotivo}-compras`}>
        <h2 id={`${idMotivo}-compras`} className="confirmar__subtitulo">
          Compras
        </h2>
        <div className="confirmar__cartao">
          {semCompras ? (
            <CampoNumero
              rotulo="Compras ≈ % do faturamento"
              selo="estimado"
              sufixo="%"
              textoInicial={rascunho ? textoPercentual(rascunho.percentualCompras) : PERCENTUAL_COMPRAS_PADRAO}
              aoMudar={setPercentualCompras}
              erro={percentualInvalido ? 'Informe um percentual entre 0 e 100.' : undefined}
              ajuda="Não há notas de compra nos arquivos. O crédito de IBS/CBS é estimado por este percentual do faturamento."
            />
          ) : (
            <p className="confirmar__contagem">
              Créditos calculados com {contar(compras.length, 'nota de compra', 'notas de compra')}.
            </p>
          )}
        </div>
      </section>

      {sugestoes.situacao === 'carregando' && <Esqueleto rotulo="Carregando as sugestões de classificação…" linhas={4} />}
      {sugestoes.situacao === 'erro' && (
        <FalhaDeCarga mensagem="Não foi possível carregar as sugestões de classificação." aoTentar={sugestoes.tentarDeNovo} />
      )}
      {tabela && (
        <ConfirmarClassificacao
          grupos={grupos}
          trocas={trocas}
          aoEscolher={(chave, cClassTrib) => setTrocas((t) => ({ ...t, [chave]: cClassTrib }))}
        />
      )}

      <div className="confirmar__acoes">
        <Botao variante="simples" icone={ArrowLeft} onClick={aoVoltar}>
          Voltar
        </Botao>
        <div className="confirmar__calcular">
          {motivo && (
            <p id={idMotivo} className="confirmar__motivo">
              {motivo}
            </p>
          )}
          <Botao
            variante="primario"
            icone={Calculator}
            iconeDepois
            disabled={motivo !== null || calculando}
            aria-describedby={motivo ? idMotivo : undefined}
            onClick={() => void calcular()}
          >
            Calcular
          </Botao>
        </div>
      </div>
    </div>
  );
}

const textoMoeda = (v: Big | null | undefined) => (v ? formatarNumeroBR(v) : '');
const textoPercentual = (v: Big | null) => (v ? v.toString().replace('.', ',') : '');

function FalhaDeCarga({ mensagem, aoTentar }: { mensagem: string; aoTentar: () => void }) {
  return (
    <div className="confirmar__falha">
      <Alerta tipo="erro">{mensagem}</Alerta>
      <Botao variante="secundario" onClick={aoTentar}>
        Tentar novamente
      </Botao>
    </div>
  );
}

/** CBS + IBS estadual + IBS municipal (pontos percentuais) do local da empresa; sem local ou sem resposta, a referência de 2027. */
async function aliquotaNominalDaEmpresa(vendas: ResultadoLeitura['documentos']): Promise<Big> {
  const local = vendas.map((d) => d.emitente).find((e) => e.uf && e.municipioIbge);
  let n: AliquotasNominais = ALIQUOTAS_REFERENCIA_2027;
  if (local?.uf && local.municipioIbge) {
    try {
      n = await buscarAliquotasNominais(local.uf, local.municipioIbge, DATA_CATALOGO);
    } catch {
      n = ALIQUOTAS_REFERENCIA_2027;
    }
  }
  return n.cbs.plus(n.ibsEstadual).plus(n.ibsMunicipal);
}
