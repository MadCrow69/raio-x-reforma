# Raio-X da Reforma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SPA que lê XMLs (NF-e, NFC-e, NFS-e nacional) de uma empresa do Simples, recalcula cada item com os motores oficiais da Receita e mostra auditoria por item + simulação "Simples × IBS/CBS no regime regular".

**Architecture:** Navegador faz leitura dos XMLs, regras próprias e interface; os dois motores oficiais (Java, sem alteração) rodam em Docker atrás de um Caddy que também serve a SPA. O XML nunca sai do navegador — só os dados de cálculo dos itens vão aos motores. Tudo sobe com `docker compose up`.

**Tech Stack:** Vite + React + TypeScript (SPA) · Vitest + happy-dom · Playwright · big.js (dinheiro) · fflate (ZIP) · lucide-react (ícones) · Caddy · Docker Compose · motores `calculadora-rtc-regime-regular` e `calculadora-rtc-simples-nacional` (Java 21, Release 15).

**Spec:** `docs/superpowers/specs/2026-11-18-raio-x-reforma-design.md`

## Global Constraints

- Motores oficiais **sem nenhum patch**: compilados de commit fixado (`ARG` no Dockerfile) dos repositórios `ReceitaFederal/calculadora-rtc-regime-regular` e `ReceitaFederal/calculadora-rtc-simples-nacional`.
- **Nenhum workflow em `.github/workflows/`** sem autorização do usuário (cota do Actions). A atualização automática de release do spec §7 fica fora deste plano.
- Nada de XML ou dado fiscal enviado a outro lugar que não os motores locais; nada persistido (sem localStorage de dados fiscais).
- Dinheiro sempre em `Big` (big.js), nunca `number`; arredondamento só na exibição (2 casas, `Big.roundHalfEven`).
- Toda regra própria (tabelas do Simples, fórmulas da comparação) em **fonte única nomeada**, com o dispositivo legal citado em comentário ou campo `fonte`.
- Veredito **nunca categórico**: textos permitidos — "O regime regular tende a ser melhor", "O Simples tende a ser melhor", "Depende dos seus clientes". Aviso legal sempre visível no Resumo: "Simulação educativa. Não substitui a orientação do seu contador."
- Nada que pareça oficial: sem brasão, sem "gov.br", sem cores da Receita. Rodapé: "Cálculos feitos com os motores open source da Receita Federal (licença MIT). Projeto independente, sem vínculo com a Receita Federal."
- Notas anteriores a 2027 são enviadas aos motores com `data`/`dhFatoGerador` = mesmo dia/mês em **2027**; a tela avisa "notas de 2026 simuladas como se fossem de 2027".
- Visual estilo Apple (HIG): fonte `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`; ícones Lucide traço 1.75; destaque `#0A84FF` (escuro) / `#007AFF` (claro); semânticas verde `#34C759`, âmbar `#FF9F0A`, vermelho `#FF3B30`; modo escuro via `prefers-color-scheme`.
- Padrão global do autor onde o HIG não define (`~/.claude/skills/ux-ui-defensive/padrao.md`): 4 estados de lista, busca + filtros, ordenação em todas as colunas, paginação 20/50/100, uma rolagem por tela, medição em 1920×1080, 1366×768, 1366×657, 1024×657, 768×1024, 390×844, 360×800 com ~200 notas. Casca com menu lateral **não se aplica**.
- Todo texto visível com acentuação correta.
- Licença MIT no repo + arquivo `NOTICE` mantendo o copyright "Copyright (c) 2026 Receita Federal do Brasil" dos motores.
- Antes de adotar cada biblioteca, consultar a documentação atual (versão estável vigente).
- Commits e push direto na `main` (autorizado), sem "Co-Authored-By".

## Review Focus

1. **CNPJ alfanumérico** (vigente desde jul/2026) em emitente/destinatário — deve ser reconhecido como PJ e casar com o CNPJ da empresa; teste em Task 4.
2. **Devolução e nota cancelada** (`finNFe=4`, XML de evento `procEventoNFe`) — devolução não conta como venda nem compra; evento é ignorado com motivo; teste em Task 3.
3. **Mesma nota duas vezes** (solta e dentro do ZIP, ou `procNFe` e `NFe` nu) — conta uma vez, pela chave de acesso; teste em Task 3.
4. **XML em ISO-8859-1 / com BOM / sem `procNFe`** — lido igual a UTF-8; teste em Task 3.
5. **RBT12 fora do Simples** (zero, > R$ 4.800.000,00) ou acima do sublimite (> R$ 3.600.000,00) — bloqueia ou avisa em vez de calcular número absurdo; teste em Task 6.

---

### Task 1: Spike — motores oficiais em Docker (portão)

Descartável quanto ao código de teste; os Dockerfiles e o compose ficam. **Se qualquer verificação falhar, parar e reportar ao usuário antes da Task 2.**

**Files:**
- Create: `motores/regime-regular.Dockerfile`, `motores/simples-nacional.Dockerfile`, `motores/README.md`
- Create: `docker-compose.yml`
- Create: `docs/spike-motores.md`
- Create: `web/src/motor/__fixtures__/regular-nfe-2027.json`, `simples-nfe-2027.json`, `simples-nfse-2027.json`, `regular-scenario-simples-por-fora.json`

**Interfaces:**
- Produces: serviços compose `motor-regular` e `motor-simples` (rede interna), portas internas registradas em `docs/spike-motores.md`; fixtures de resposta reais dos motores usadas pelas Tasks 7–9.

- [ ] **Step 1:** `motores/regime-regular.Dockerfile` multi-stage: `git clone` + `checkout ${COMMIT_REGULAR}` → `./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf` (gera `calculadora/db/calculadora-pro.db`) → `./mvnw -DskipTests package` → imagem `eclipse-temurin:21-jre` rodando `java -Dspring.profiles.active=offline -jar api-regime-geral.jar` com o `.db` em `./calculadora/db/`. Estágio extra nomeado `base` que só contém o `.db` (reutilizado pelo motor do Simples e pela Task 5).
- [ ] **Step 2:** `motores/simples-nacional.Dockerfile`: mesmo padrão com `${COMMIT_SIMPLES}`, copiando o `.db` do estágio `base` do regime regular (o repositório do Simples não traz scripts de banco). Registrar no `motores/README.md` os dois commits fixados (Release 15).
- [ ] **Step 3:** `docker compose up -d --build` → Expected: os dois containers `healthy`/rodando; `GET /api/swagger-ui.html` responde 200 em cada um (via `docker compose exec` ou porta publicada só no spike).
- [ ] **Step 4:** Chamar `POST /api/calculadora/observabilidade/regime-geral` com o exemplo de `docs/exemplos.md` do repositório oficial, trocando `dhFatoGerador` para `2027-03-10` → Expected: 200, itens 1–3 `CALCULO_SIMULADO`, item 4 `INCONSISTENCIA_ENTRADA` com `REG-011`. Salvar resposta em `regular-nfe-2027.json`.
- [ ] **Step 5:** Chamar `POST /api/calculadora/observabilidade/simples-nacional` com `tpDoc=55`, `CRT=1`, `data=2027-03-15`, 1 item `cAtivSN=01`, `cClassTrib=000001`, `baseCalculo=950.00`, `valorImpostoSeletivo=0.00`, `pCBSSN=2.75`, `pIBSSN=1.25` → Expected: item calculado. Salvar em `simples-nfe-2027.json`. Repetir com `tpDoc=91` (NFS-e) e uma atividade de serviço (07–14) → `simples-nfse-2027.json`.
- [ ] **Step 6:** Descobrir e registrar em `docs/spike-motores.md` qual chamada representa o **cenário "IBS/CBS por fora"** de uma empresa do Simples (`CRT=3` + `tpRegimeIBSCBS=2` no motor do Simples, ou o motor do regime regular) — com a resposta salva em `regular-scenario-simples-por-fora.json`. Registrar também: se `municipio`/`uf` do regime regular é o do destino (local da operação), e o formato das rotas `GET /api/calculadora/dados-abertos/aliquota-uniao|aliquota-uf|aliquota-municipio` e `GET /api/calculadora/simples-nacional/atividades?data=2027-01-01` (salvar exemplos).
- [ ] **Step 7:** `docker compose down`. Commit.

```bash
git add motores docker-compose.yml docs/spike-motores.md web/src/motor/__fixtures__
git commit -m "spike: motores oficiais da Receita rodando em Docker"
git push
```

---

### Task 2: Esqueleto da SPA + Caddy + licença

**Files:**
- Create: `web/` (Vite React TS), `web/vitest.config.ts`, `web/src/main.tsx`, `web/src/App.tsx`
- Create: `caddy/Caddyfile`, `caddy/Dockerfile` (build da SPA + Caddy)
- Modify: `docker-compose.yml` (serviço `web`, única porta publicada `8080`)
- Create: `LICENSE` (MIT, autor do projeto), `NOTICE`, `README.md`, `.gitignore`, `.editorconfig`

**Interfaces:**
- Produces: rotas Caddy `/motor/regular/*` → `motor-regular` (prefixo removido, mantém `/api/...`) e `/motor/simples/*` → `motor-simples`; SPA em `/`. Limite de corpo 2 MiB por requisição nas rotas `/motor/*`.

- [ ] **Step 1:** Teste `web/src/App.test.tsx`: renderiza `<App />` e encontra o título "Raio-X da Reforma".
- [ ] **Step 2:** `npm --prefix web test` → FAIL (App não existe).
- [ ] **Step 3:** Criar o projeto Vite/React/TS e `App` com o título; `Caddyfile` com as rotas acima; serviço `web` no compose.
- [ ] **Step 4:** `npm --prefix web test` → PASS. `docker compose up -d --build` → `curl -s localhost:8080/` contém "Raio-X da Reforma"; `curl -s localhost:8080/motor/regular/api/calculadora/dados-abertos/ufs` retorna JSON. `docker compose down`.
- [ ] **Step 5:** README: o que é, aviso de projeto independente, "como rodar" (`docker compose up --build` → `http://localhost:8080`), créditos aos motores oficiais. Commit + push.

---

### Task 3: Leitura de documentos (XML/ZIP → `Documento`)

**Files:**
- Create: `web/src/leitura/tipos.ts`, `web/src/leitura/lerArquivos.ts`, `web/src/leitura/nfe.ts`, `web/src/leitura/nfse.ts`
- Create: `web/src/leitura/__fixtures__/` (XMLs sintéticos: NF-e 55 com e sem grupo IBSCBS, NFC-e 65, NFS-e nacional, NFS-e municipal, evento de cancelamento, devolução, ISO-8859-1 com BOM)
- Test: `web/src/leitura/lerArquivos.test.ts`, `nfe.test.ts`, `nfse.test.ts`

**Interfaces:**
- Produces:
```ts
export type TipoDocumento = 'NFE' | 'NFCE' | 'NFSE';
export type MotivoIgnorado = 'XML_INVALIDO' | 'TIPO_NAO_SUPORTADO' | 'NFSE_MUNICIPAL' | 'EVENTO' | 'DEVOLUCAO' | 'DUPLICADO' | 'OUTRA_EMPRESA';
export interface GrupoIbsCbsNota { cst: string; cClassTrib: string; vBC: Big; vCBS: Big; vIBSUF: Big; vIBSMun: Big; }
export interface ItemDocumento {
  numero: number; descricao: string; ncm?: string; nbs?: string; cfop?: string;
  baseCalculo: Big;          // vProd + vFrete + vSeg + vOutro − vDesc (NF-e); vServ − descontos incondicionados (NFS-e)
  valorIS: Big;              // 0 quando ausente
  ibscbsNota?: GrupoIbsCbsNota;
}
export interface Parte { documento: string; tipo: 'PJ' | 'PF' | 'ESTRANGEIRO'; municipioIbge?: string; uf?: string; }
export interface Documento {
  chave: string; tipo: TipoDocumento; tpDoc: 55 | 65 | 91;
  emissao: string;           // ISO 8601 com offset, como no XML
  emitente: Parte & { crt?: string }; destinatario?: Parte;
  itens: ItemDocumento[]; arquivo: string;
}
export interface DocumentoIgnorado { arquivo: string; motivo: MotivoIgnorado; detalhe?: string; }
export interface ResultadoLeitura { documentos: Documento[]; ignorados: DocumentoIgnorado[]; }
export function lerArquivos(arquivos: File[]): Promise<ResultadoLeitura>;
export function lerNFe(xml: Document, arquivo: string): Documento | DocumentoIgnorado;
export function lerNFSe(xml: Document, arquivo: string): Documento | DocumentoIgnorado;
```

- [ ] **Step 1:** Testes (um `it` por linha):
  - NF-e 55 sem grupo IBSCBS → `tipo:'NFE'`, `tpDoc:55`, itens com `baseCalculo` = vProd+vFrete+vSeg+vOutro−vDesc, `ibscbsNota` indefinido.
  - NF-e 55 com grupo IBSCBS → `ibscbsNota.cClassTrib`, `vCBS` preenchidos.
  - NFC-e 65 → `tipo:'NFCE'`, `destinatario` indefinido quando não há `dest`.
  - NFS-e nacional → `tipo:'NFSE'`, `tpDoc:91`, item único com `nbs`.
  - NFS-e municipal (raiz diferente da nacional) → `{ motivo:'NFSE_MUNICIPAL' }`.
  - `procEventoNFe` → `{ motivo:'EVENTO' }`; `finNFe=4` → `{ motivo:'DEVOLUCAO' }`.
  - **Review Focus 3:** mesma chave em `procNFe` solto e `NFe` dentro de ZIP → 1 documento + 1 ignorado `DUPLICADO`.
  - **Review Focus 4:** XML ISO-8859-1 com BOM e acentos na descrição → descrição correta.
  - Arquivo não-XML → `XML_INVALIDO`; ZIP com subpastas → lê todos os `.xml`.
- [ ] **Step 2:** `npm --prefix web test -- leitura` → FAIL.
- [ ] **Step 3:** Implementar com `DOMParser` (seletores por `localName`, ignorando namespace); encoding pelo prólogo do XML via `TextDecoder`; ZIP via `fflate.unzipSync`; deduplicação pela chave de acesso.
- [ ] **Step 4:** `npm --prefix web test -- leitura` → PASS.
- [ ] **Step 5:** Commit + push.

---

### Task 4: Empresa, vendas e compras

**Files:**
- Create: `web/src/dominio/cnpj.ts`, `web/src/dominio/separar.ts`
- Test: `web/src/dominio/cnpj.test.ts`, `web/src/dominio/separar.test.ts`

**Interfaces:**
- Consumes: `Documento`, `DocumentoIgnorado` (Task 3).
- Produces:
```ts
export function normalizarCnpj(valor: string): string;           // remove máscara, maiúsculas; aceita alfanumérico
export function cnpjValido(cnpj: string): boolean;               // DV oficial, inclusive alfanumérico
export function detectarEmpresa(docs: Documento[]): string | null; // CNPJ emitente mais frequente
export interface Separacao { vendas: Documento[]; compras: Documento[]; ignorados: DocumentoIgnorado[]; }
export function separar(docs: Documento[], cnpjEmpresa: string): Separacao; // emitente=empresa → venda; destinatário=empresa → compra; senão OUTRA_EMPRESA
export function participacaoPJ(vendas: Documento[]): { pj: Big; pf: Big; percentualPJ: Big }; // por baseCalculo
```

- [ ] **Step 1:** Testes: CNPJ numérico válido/inválido; **Review Focus 1:** CNPJ alfanumérico válido (`12ABC34501DE35`, conferir DV na documentação oficial da Receita e usar exemplo publicado) → `true` e `tipo:'PJ'`; `detectarEmpresa` com 3 notas do CNPJ A e 1 do B → A; `separar` coloca nota de terceiro em ignorados `OUTRA_EMPRESA`; `participacaoPJ` com 600 PJ + 400 PF → `percentualPJ = 60`.
- [ ] **Step 2:** `npm --prefix web test -- dominio` → FAIL.
- [ ] **Step 3:** Implementar. Comparação de CNPJ sempre pelo valor normalizado (código, não texto livre).
- [ ] **Step 4:** → PASS. Commit + push.

---

### Task 5: Sugestão de cClassTrib a partir da base oficial

**Files:**
- Create: `motores/exportar-sugestoes.sql`
- Modify: `caddy/Dockerfile` (estágio que roda `sqlite3 calculadora-pro.db < exportar-sugestoes.sql` sobre o `.db` do estágio `base` e publica `/dados/sugestoes-classificacao.json`)
- Create: `web/src/classificacao/sugestoes.ts`
- Test: `web/src/classificacao/sugestoes.test.ts`

**Interfaces:**
- Consumes: `ItemDocumento` (Task 3).
- Produces:
```ts
export interface OpcaoClassificacao { cst: string; cClassTrib: string; descricao: string; reducaoCbs: Big; reducaoIbs: Big; }
export interface TabelaSugestoes { ncm: Record<string, OpcaoClassificacao[]>; nbs: Record<string, OpcaoClassificacao[]>; padrao: OpcaoClassificacao; }
export interface GrupoClassificacao { chave: string; tipo: 'NCM' | 'NBS'; codigo: string; itens: number; valor: Big; opcoes: OpcaoClassificacao[]; sugerida: OpcaoClassificacao; origem: 'NOTA' | 'TABELA' | 'PADRAO'; }
export function carregarSugestoes(): Promise<TabelaSugestoes>;   // GET /dados/sugestoes-classificacao.json
export function agruparParaConfirmacao(itens: ItemDocumento[], tabela: TabelaSugestoes): GrupoClassificacao[];
export type Classificacoes = Record<string, OpcaoClassificacao>; // chave do grupo → escolha confirmada
```

- [ ] **Step 1:** SQL: `NCM_APLICAVEL` (`NCMA_NCM_CD`, vigente em 2027-01-01) ⨝ `CLASSIFICACAO_TRIBUTARIA` (`CLTR_CD`, `CLTR_DESCRICAO`) ⨝ `SITUACAO_TRIBUTARIA` (CST); idem `NBS_APLICAVEL`; deduplicar por `CLTR_CD`; `padrao` = CST `000` / cClassTrib `000001`. Saída JSON via `json_group_object`.
- [ ] **Step 2:** Testes de `agruparParaConfirmacao`: 3 itens de mesmo NCM sem grupo na nota → 1 grupo com `itens:3`; NCM sem vínculo → `origem:'PADRAO'`, `sugerida.cClassTrib:'000001'`; item com `ibscbsNota` → `origem:'NOTA'` com o cClassTrib da nota; NCM vinculado por prefixo (posição de 4 dígitos na tabela) → casa com NCM de 8 dígitos que começa com ele.
- [ ] **Step 3:** → FAIL; implementar; → PASS.
- [ ] **Step 4:** `docker compose build web` e `curl -s localhost:8080/dados/sugestoes-classificacao.json | head -c 300` → JSON com chaves `ncm`, `nbs`, `padrao`. Commit + push.

---

### Task 6: Regras do Simples — alíquota efetiva e repartição de CBS/IBS

**Files:**
- Create: `web/src/regras/simples/anexos-2027.json`, `web/src/regras/simples/aliquotaEfetiva.ts`, `web/src/regras/simples/FONTES.md`
- Test: `web/src/regras/simples/aliquotaEfetiva.test.ts`

**Interfaces:**
- Produces:
```ts
export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V';
export interface Faixa { ate: Big; aliquotaNominal: Big; parcelaDeduzir: Big; reparticao: Record<string, Big>; } // inclui chaves 'CBS' e 'IBS'
export interface AliquotasSimples { anexo: Anexo; faixa: number; efetivaTotal: Big; pCBSSN: Big; pIBSSN: Big; dasSemCbsIbs: Big; } // percentuais em pontos (ex.: 2.75)
export type ErroRbt12 = 'RBT12_INVALIDO' | 'ACIMA_LIMITE_SIMPLES';
export function aliquotasSimples(anexo: Anexo, rbt12: Big): AliquotasSimples | { erro: ErroRbt12 };
export function anexoPorFatorR(anexoSemFatorR: Anexo, anexoComFatorR: Anexo, folha12: Big, rbt12: Big): Anexo; // r ≥ 0,28 → com Fator R
export const SUBLIMITE = Big(3_600_000); export const LIMITE_SIMPLES = Big(4_800_000);
```

- [ ] **Step 1: Pesquisa (fonte primária).** Transcrever para `anexos-2027.json` os Anexos I–V da LC 123/2006 **na redação vigente em 2027 após a LC 214/2025** (faixas, alíquota nominal, parcela a deduzir, repartição por tributo incluindo CBS e IBS). Cada anexo com campo `fonte` (lei, artigo, URL do Planalto). Registrar em `FONTES.md` qualquer regra de redistribuição (ex.: teto de ISS na faixa 5 do Anexo III) e se ela afeta a parcela de CBS/IBS. **Se a repartição de 2027 não estiver publicada em fonte oficial, parar e reportar ao usuário.**
- [ ] **Step 2:** Testes:
  - Anexo I, RBT12 = 150.000 → `faixa:1`, `efetivaTotal` = alíquota nominal da faixa 1 (PD = 0).
  - Fórmula: `efetivaTotal = (rbt12 × nominal − PD) / rbt12` conferida num valor da faixa 3 calculado à mão no próprio teste.
  - `pCBSSN = efetivaTotal × reparticao.CBS`, `pIBSSN = efetivaTotal × reparticao.IBS`; `dasSemCbsIbs = efetivaTotal − pCBSSN − pIBSSN`.
  - Soma da repartição de cada faixa = 100%.
  - Um caso cruzado com exemplo publicado por fonte oficial (Receita/CGSN), citado no teste.
  - **Review Focus 5:** RBT12 = 0 → `RBT12_INVALIDO`; RBT12 = 4.800.000,01 → `ACIMA_LIMITE_SIMPLES`; RBT12 = 3.700.000 → calcula (aviso de sublimite é responsabilidade da UI, Task 11).
  - `anexoPorFatorR('V','III', 28.000, 100.000)` → `'III'`; com folha 27.999 → `'V'`.
- [ ] **Step 3:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 7: Cliente dos motores

**Files:**
- Create: `web/src/motor/tipos.ts`, `web/src/motor/cliente.ts`, `web/src/motor/montarRequisicoes.ts`
- Test: `web/src/motor/montarRequisicoes.test.ts`, `web/src/motor/cliente.test.ts`

**Interfaces:**
- Consumes: `Documento` (T3), `Classificacoes` (T5), `AliquotasSimples` (T6), fixtures e achados da Task 1.
- Produces:
```ts
export interface AliquotasNominais { cbs: Big; ibsEstadual: Big; ibsMunicipal: Big; }
export interface ParametrosCalculo { classificacoes: Classificacoes; atividadePorTipo: Partial<Record<TipoDocumento, string>>; aliquotasSimples: Record<string, AliquotasSimples>; /* por cAtivSN */ }
export type EstadoItem = 'CALCULO_SIMULADO' | 'INCONSISTENCIA_ENTRADA' | 'FALHA_TECNICA' | 'NAO_IMPLEMENTADO' | 'NAO_CALCULADO';
export interface ErroMotor { code: string; title: string; pointer?: string; detail: string; }
export interface ItemCalculado { chave: string; numero: number; estado: EstadoItem; vCBS: Big; vIBSUF: Big; vIBSMun: Big; erros: ErroMotor[]; memoria: string; }
export type Cenario = 'SIMPLES_POR_DENTRO' | 'SIMPLES_POR_FORA' | 'REGULAR_AUDITORIA';
export function dataEm2027(emissaoIso: string): string; // mesmo dia/mês em 2027; 29/02 → 28/02
export function montarRequisicao(doc: Documento, cenario: Cenario, p: ParametrosCalculo, nominais: AliquotasNominais): { url: string; corpo: unknown };
export function buscarAliquotasNominais(uf: string, municipioIbge: string, data: string): Promise<AliquotasNominais>;
export function calcular(docs: Documento[], cenario: Cenario, p: ParametrosCalculo, aoProgredir?: (feitos: number, total: number) => void): Promise<ItemCalculado[]>;
```

- [ ] **Step 1:** Testes de `montarRequisicao` (sem rede):
  - `SIMPLES_POR_DENTRO`, NF-e → URL `/motor/simples/api/calculadora/observabilidade/simples-nacional`, `CRT:'1'`, `tpDoc:'55'`, `data` em 2027, itens com `cAtivSN` da atividade do tipo, `cClassTrib` confirmado, `baseCalculo` string com 2 casas, `pCBSSN`/`pIBSSN` da atividade.
  - `SIMPLES_POR_FORA` → corpo conforme o achado da Task 1 Step 6.
  - `REGULAR_AUDITORIA` → URL `/motor/regular/api/calculadora/observabilidade/regime-geral`, `dhFatoGerador` em 2027, `aliquotasNominais` preenchido, `municipio`/`uf` conforme Task 1.
  - Item sem atividade para o tipo de documento → não enviado; vira `ItemCalculado` com `estado:'NAO_CALCULADO'` e erro `{ code:'RXR-001', title:'Atividade do Simples não informada para este tipo de nota' }`.
  - `dataEm2027('2024-02-29T10:00:00-03:00')` → `'2027-02-28T10:00:00-03:00'`.
- [ ] **Step 2:** Testes de `calcular` com `fetch` simulado devolvendo as fixtures da Task 1: mapeia `objetos[].estadoItem`, `erros`, valores; no máximo **4 requisições simultâneas**; falha de rede num documento → itens dele `FALHA_TECNICA`, os outros seguem.
- [ ] **Step 3:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 8: Auditoria

**Files:**
- Create: `web/src/auditoria/auditar.ts`, `web/src/auditoria/csv.ts`
- Test: `web/src/auditoria/auditar.test.ts`, `web/src/auditoria/csv.test.ts`

**Interfaces:**
- Consumes: `Documento`, `ItemCalculado`.
- Produces:
```ts
export type Achado = 'OK' | 'ERRO_MOTOR' | 'VALOR_DIVERGENTE' | 'SEM_GRUPO_NA_NOTA' | 'NAO_CALCULADO';
export interface LinhaAuditoria { chave: string; numeroNota: string; papel: 'VENDA' | 'COMPRA'; tipo: TipoDocumento; item: number; descricao: string; ncmOuNbs: string; cst: string; cClassTrib: string; estado: EstadoItem; achado: Achado; erros: ErroMotor[]; vNota?: Big; vMotor: Big; diferenca?: Big; memoria: string; }
export const TOLERANCIA = Big('0.01'); // por tributo, em R$
export function auditar(vendas: Documento[], compras: Documento[], calculados: ItemCalculado[]): LinhaAuditoria[];
export function paraCsv(linhas: LinhaAuditoria[]): string; // separador ';', decimal ',', UTF-8 com BOM
```

- [ ] **Step 1:** Testes: item com grupo na nota igual ao motor → `OK`; diferença de R$ 0,02 em vCBS → `VALOR_DIVERGENTE`, `diferenca = 0.02`; diferença de R$ 0,01 → `OK`; erro `REG-011` → `ERRO_MOTOR`; nota sem grupo → `SEM_GRUPO_NA_NOTA` (sem comparação de valor); CSV abre com acentos corretos (BOM) e valores `1234,56`.
- [ ] **Step 2:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 9: Simulação e veredito

**Files:**
- Create: `web/src/simulacao/simular.ts`, `web/src/simulacao/FORMULAS.md`
- Test: `web/src/simulacao/simular.test.ts`

**Interfaces:**
- Consumes: `Documento`, `ItemCalculado` (cenários `SIMPLES_POR_DENTRO` e `SIMPLES_POR_FORA`), `AliquotasSimples`, `participacaoPJ`.
- Produces:
```ts
export type OrigemCompras = { tipo: 'REAL'; creditos: Big } | { tipo: 'ESTIMADA'; percentualSobreFaturamento: Big };
export interface ResultadoCenario { impostoMes: Big; creditoClientePJMes: Big; }
export type Veredito = 'REGULAR_TENDE_MELHOR' | 'SIMPLES_TENDE_MELHOR' | 'DEPENDE_DOS_CLIENTES' | 'EMPATE';
export interface ResultadoSimulacao { meses: string[]; faturamentoMes: Big; simples: ResultadoCenario; regular: ResultadoCenario; diferencaMes: Big; veredito: Veredito; origemCompras: 'REAL' | 'ESTIMADA'; percentualPJ: Big; notas2026Simuladas: boolean; }
export const EMPATE_PERCENTUAL = Big('0.5'); // diferença < 0,5% do imposto do Simples = empate
export function simular(entrada: { vendas: Documento[]; compras: Documento[]; porDentro: ItemCalculado[]; porFora: ItemCalculado[]; aliquotasPorAtividade: Record<string, AliquotasSimples>; origemCompras: OrigemCompras; }): ResultadoSimulacao;
```
- Fórmulas (decisão do usuário, spec §10), documentadas em `FORMULAS.md` com dispositivos legais:
  - `simples.impostoMes` = Σ vendas do mês × `efetivaTotal` da atividade (DAS completo), média dos meses cobertos.
  - `regular.impostoMes` = Σ vendas × `dasSemCbsIbs` + (Σ vCBS+vIBS do cenário por fora − créditos), média mensal. Créditos `REAL` = Σ vCBS+vIBS das compras (grupo da nota ou recalculado); `ESTIMADA` = faturamento × percentual × alíquotas nominais.
  - `creditoClientePJMes` = Σ vCBS+vIBS dos itens vendidos a PJ no cenário.
  - `diferencaMes = simples.impostoMes − regular.impostoMes`. Veredito: |diferença| < `EMPATE_PERCENTUAL` × simples → `EMPATE`; se o sinal da diferença e o do (regular.credito − simples.credito) apontam lados opostos → `DEPENDE_DOS_CLIENTES`; senão o lado de menor imposto.

- [ ] **Step 1:** Testes com números redondos montados à mão: (a) regular mais barato e crédito PJ maior no regular → `REGULAR_TENDE_MELHOR`; (b) Simples mais barato e crédito PJ maior no regular → `DEPENDE_DOS_CLIENTES`; (c) diferença de 0,3% → `EMPATE`; (d) compras `ESTIMADA` 40% → `origemCompras:'ESTIMADA'`; (e) notas de jan e fev → `meses:['2027-01','2027-02']` e média mensal; (f) nota emitida em 2026 → `notas2026Simuladas:true`.
- [ ] **Step 2:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 10: Base visual estilo Apple + passo 1 "Enviar"

**Files:**
- Create: `web/src/ui/tokens.css`, `web/src/ui/componentes/` (`Botao`, `Segmentado`, `ListaAgrupada`, `Folha`, `Aviso`, `Esqueleto`)
- Create: `web/src/telas/Enviar.tsx`, `web/src/fluxo/estado.ts`
- Modify: `web/src/App.tsx`
- Test: `web/src/telas/Enviar.test.tsx`

**Interfaces:**
- Consumes: `lerArquivos` (T3), `detectarEmpresa`/`separar` (T4).
- Produces:
```ts
export type Passo = 'ENVIAR' | 'CONFIRMAR' | 'CALCULANDO' | 'RESULTADO';
export interface EstadoFluxo { passo: Passo; leitura?: ResultadoLeitura; cnpjEmpresa?: string; separacao?: Separacao; parametros?: ParametrosCalculo; auditoria?: LinhaAuditoria[]; simulacao?: ResultadoSimulacao; erro?: string; }
export type AcaoFluxo =
  | { tipo: 'ARQUIVOS_LIDOS'; leitura: ResultadoLeitura }
  | { tipo: 'EMPRESA_CONFIRMADA'; cnpjEmpresa: string; parametros: ParametrosCalculo; origemCompras: OrigemCompras }
  | { tipo: 'CALCULO_CONCLUIDO'; auditoria: LinhaAuditoria[]; simulacao: ResultadoSimulacao }
  | { tipo: 'ERRO'; mensagem: string }
  | { tipo: 'NOVA_ANALISE' };
export function useFluxo(): [EstadoFluxo, (acao: AcaoFluxo) => void];
```

- [ ] **Step 1:** Testes: soltar 3 XMLs válidos + 1 inválido → mostra "3 notas lidas" e "1 arquivo ignorado" com o motivo em português; botão "Continuar" habilitado só com ≥ 1 nota; estado vazio com instrução "Arraste os XMLs ou um ZIP das notas"; texto de privacidade visível: "Seus arquivos são lidos no seu navegador. Só os valores dos itens vão para o cálculo e nada é guardado."
- [ ] **Step 2:** → FAIL; implementar tokens (escala 4/8/12/16/24/32, raios 8/12/16, cores e fontes das Global Constraints, modo escuro) e componentes; → PASS. Commit + push.

---

### Task 11: Passo 2 "Confirmar empresa"

**Files:**
- Create: `web/src/telas/Confirmar.tsx`, `web/src/telas/ConfirmarClassificacao.tsx`, `web/src/motor/atividades.ts`
- Test: `web/src/telas/Confirmar.test.tsx`

**Interfaces:**
- Consumes: `Separacao`, `agruparParaConfirmacao` (T5), `aliquotasSimples`/`anexoPorFatorR` (T6), `GET /motor/simples/api/calculadora/simples-nacional/atividades?data=2027-01-01` (formato registrado na Task 1).
- Produces: `ParametrosCalculo` completo + `OrigemCompras` no `EstadoFluxo`.

- [ ] **Step 1:** Testes:
  - CNPJ detectado aparece preenchido e editável; ao trocar, a contagem venda/compra é refeita.
  - Campo "Faturamento dos últimos 12 meses" (moeda BR); > R$ 3.600.000,00 → aviso âmbar "Acima do sublimite: IBS e ICMS/ISS podem ser cobrados fora do Simples"; > R$ 4.800.000,00 ou 0 → erro e "Calcular" desabilitado.
  - Seletor de atividade aparece **por tipo de nota presente** (NF-e/NFC-e e/ou NFS-e), com busca (> 8 opções).
  - Atividade com Fator R `OBRIGATORIO`/`OPCIONAL` → pede "Folha de salários dos últimos 12 meses".
  - Sem notas de compra → campo "Compras ≈ % do faturamento" (padrão 40, editável) e selo "estimado".
  - Lista de classificação agrupada por NCM/NBS: mostra quantidade de itens e valor, sugestão pré-selecionada, origem ("da nota", "tabela oficial", "padrão"); pode trocar a opção.
- [ ] **Step 2:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 12: Resultado — Resumo e cálculo com progresso

**Files:**
- Create: `web/src/telas/Calculando.tsx`, `web/src/telas/Resultado.tsx`, `web/src/telas/Resumo.tsx`
- Test: `web/src/telas/Resumo.test.tsx`

**Interfaces:**
- Consumes: `calcular` (T7), `auditar` (T8), `simular` (T9).

- [ ] **Step 1:** Testes do `Resumo` com `ResultadoSimulacao` fixo:
  - Título por veredito: `REGULAR_TENDE_MELHOR` → "O regime regular tende a ser melhor"; `DEPENDE_DOS_CLIENTES` → "Depende dos seus clientes" e mostra os dois números (imposto e crédito ao cliente PJ).
  - "Diferença estimada: R$ 1.240,00/mês" formatado em pt-BR.
  - Selo "compras reais" ou "compras estimadas"; "Vendas: 62% para empresas · 38% para consumidor final".
  - `notas2026Simuladas` → aviso "Notas de 2026 simuladas como se fossem de 2027".
  - Aviso legal sempre presente.
- [ ] **Step 2:** Orquestração em `Calculando`: `calcular(vendas,'SIMPLES_POR_DENTRO')`, `calcular(vendas,'SIMPLES_POR_FORA')` e, se houver compras, `calcular(compras,'REGULAR_AUDITORIA')`; auditoria = `auditar(vendas, compras, [...porDentro, ...comprasCalculadas])`; créditos `REAL` = Σ vCBS+vIBS do grupo da nota de compra quando existir, senão do motor. Mostra progresso "N de M notas" (callback de `calcular`); erro geral com "Tentar novamente".
- [ ] **Step 3:** → FAIL; implementar; `Resultado` com `Segmentado` [Resumo | Auditoria N | Memória de cálculo] e botão "Nova análise"; → PASS. Commit + push.

---

### Task 13: Auditoria (tabela) e Memória de cálculo

**Files:**
- Create: `web/src/telas/Auditoria.tsx`, `web/src/telas/Memoria.tsx`, `web/src/ui/componentes/Tabela.tsx`
- Test: `web/src/telas/Auditoria.test.tsx`

**Interfaces:**
- Consumes: `LinhaAuditoria[]`, `paraCsv` (T8).

- [ ] **Step 1:** Testes com 200 linhas geradas:
  - Paginação 20/50/100 (padrão 20); ordenação em todas as colunas de dado (asc/desc, valores numéricos ordenam como número).
  - Busca única (nota, descrição, NCM/NBS, cClassTrib) + filtros por Achado, código de erro, papel e tipo de nota, com contador no botão "Filtros" e pílulas removíveis.
  - Estados: vazio de filtro "Nenhum item para estes filtros · Limpar filtros".
  - Linha mostra código + título do erro; clicar abre a memória daquele item na aba Memória.
  - "Exportar CSV" baixa `raio-x-auditoria.csv` com o conteúdo de `paraCsv` das linhas **filtradas**.
  - Celular (contêiner < 640 px): linhas viram cartões.
- [ ] **Step 2:** → FAIL; implementar; → PASS. Commit + push.

---

### Task 14: Ponta a ponta, volume e medição de layout

**Files:**
- Create: `web/e2e/fluxo.spec.ts`, `web/e2e/gerarNotas.ts` (gera ~200 XMLs sintéticos de NF-e/NFC-e/NFS-e, vendas PJ/PF e compras)
- Create: `docs/medicao-layout.md`
- Modify: `README.md` (passo a passo com prints; espaço para GIF)

- [ ] **Step 1:** `gerarNotas.ts` com semente fixa: 150 vendas (60% PJ), 50 compras, 3 NCMs com redução, 1 NCM incompatível proposital, 2 duplicadas, 1 cancelamento.
- [ ] **Step 2:** `fluxo.spec.ts` contra `docker compose up` real: envia o ZIP → confirma (RBT12 = 1.200.000, atividade 01) → resultado mostra veredito, aba Auditoria tem ≥ 1 `REG-011`, CSV baixa. Run: `npx --prefix web playwright test` → PASS.
- [ ] **Step 3:** Medir as telas Enviar, Confirmar e Resultado (Resumo e Auditoria com 200 itens) nos 7 tamanhos com `~/.claude/skills/ux-ui-defensive/scripts/layout-audit.js` (instruções em `scripts/README.md`) → 0 falhas; registrar em `docs/medicao-layout.md`.
- [ ] **Step 4:** `docker compose down`; conferir que nenhum processo `node`/`java`/navegador aberto por esta tarefa ficou rodando. Commit + push.
