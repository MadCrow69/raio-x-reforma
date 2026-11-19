# Raio-X da Reforma — design

Data: 2026-11-18 · Status: rascunho para aprovação

## 1. Intenção

Projeto open source (MIT) para compartilhar no LinkedIn e dar visibilidade ao GitHub do autor.
A pessoa sobe os XMLs das notas de uma empresa do Simples Nacional e recebe, numa tela só:

1. **Auditoria** — cada item recalculado com o **motor oficial da Receita Federal** (CBS/IBS/IS), apontando erros (CST × cClassTrib × NCM/NBS incompatíveis, valor divergente).
2. **Simulação** — "fico no Simples (IBS/CBS por dentro do DAS) ou passo IBS/CBS para o regime regular (por fora)?", usando as notas reais da empresa em vez de números digitados.

Diferencial frente aos simuladores existentes (Receita, Alterdata, Ozai): **parte das notas reais** e **calcula com o motor oficial sem alteração**. Momento: a próxima janela de opção (2º semestre/2027) está prevista para março/2027 — lançar antes.

Público: **contador e empresário**, na mesma tela (topo para o empresário, abas para o contador).

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Demo pública que abre e funciona no primeiro clique (link do post) — **adiada**: MVP roda só local (ver §10).
- `docker compose up` sobe tudo localmente (quem clona o repo consegue rodar).
- Resultado rastreável: cada número leva à memória de cálculo do motor oficial.

**Não-objetivos (fora do MVP)**
- Painel com várias empresas do escritório (uma empresa por análise).
- Contas, login, histórico, armazenamento de XML.
- Geração de DANFSe (fica como fase 2, usando o `calculadora-rtc-gerador-danfse`).
- Substituir o PGDAS-D ou a orientação do contador.

**Anti-objetivos (falha mesmo se "funcionar")**
- Parecer produto oficial da Receita (logo, nome, cores gov.br).
- Guardar XML ou dado fiscal de cliente no servidor.
- Veredito categórico ("recomendamos X") — sempre "tende a ser melhor" + aviso.
- Número sem origem: valor que não se explica pela memória de cálculo ou por regra documentada do projeto.
- Modificar o código dos motores oficiais (perde o argumento "motor oficial").

## 3. Fatos verificados nos repositórios oficiais (Release 15, out/2026)

- `calculadora-rtc-regime-regular` (Java 21, Spring Boot, SQLite somente leitura): `POST /api/calculadora/observabilidade/regime-geral` calcula por item sem interromper nos erros, devolve `estadoItem`, códigos `REG-xxx` com `pointer` e `memoriaCalculo`. Também expõe dados abertos (cClassTrib, CST, NCM, NBS, alíquotas União/UF/município) e validação de XML contra XSD.
- `calculadora-rtc-simples-nacional` (mesma stack): `POST /api/calculadora/observabilidade/simples-nacional`. Entrada por item: `cAtivSN`, `cClassTrib`, `baseCalculo`, `valorImpostoSeletivo`, **`pIBSSN` e `pCBSSN` (alíquotas efetivas do Simples para IBS e CBS) informadas pelo chamador**; por operação: `data`, `tpDoc`, `CRT`, `tpRegimeIBSCBS`, `tpEnteGov`. **O motor não calcula a alíquota efetiva** (RBT12 → faixa → repartição); isso fica com o PGDAS-D, e a integração está prevista só para a Release 16.
- Documentos habilitados no cálculo do Simples a partir de 2027-01-01: NF-e (55), NFC-e (65), NFS-e (91), CT-e, CT-e OS, BP-e, BP-e TM, NFCom (migrações V0050/V0051).
- **O repositório do Simples não traz scripts de banco.** As tabelas do Simples (V0047, V0049–V0051) estão no `flyway/` do repositório do regime regular. Inferência (não verificado): os dois motores usam o mesmo `calculadora-pro.db` gerado a partir do regime regular. Confirmar no spike (§8).
- Licença MIT em todos; manter o aviso de copyright da Receita Federal.

## 4. Abordagens consideradas

| | Abordagem | Prós | Contras |
|---|---|---|---|
| **A (escolhida)** | **SPA no navegador lê os XMLs e aplica as regras próprias; motores oficiais em containers sem alteração, atrás de um proxy (Caddy) com limite de requisições** | XML nunca sai do navegador — só os dados de cálculo dos itens vão ao motor (argumento forte no post); quase nenhum backend próprio para manter; `docker compose up` simples | Regras próprias (alíquota efetiva, comparação) ficam em TypeScript no front — precisam de testes unitários fortes; motor exposto publicamente exige limite de taxa |
| B | Backend próprio (Node/TS) recebe os XMLs e orquestra os motores | Teste ponta a ponta mais fácil; motores escondidos | XML passa pelo servidor (perde o argumento de privacidade); mais infraestrutura e código |
| C | Fork dos motores Java com endpoints próprios | Uma chamada só | Perde "motor oficial sem alteração"; conflito de merge a cada release da Receita |

Escolha: **A**. O usuário delegou a decisão técnica ("pode seguir"); escolhida por privacidade, custo de manutenção e fidelidade ao motor oficial.

## 5. Decisões tomadas na conversa

**Do usuário**
- Nome: Raio-X da Reforma · repositório público `MadCrow69/raio-x-reforma`.
- Junta auditoria + simulação.
- Público: contador e empresário.
- Entrada: XML (aceitando também vendas e compras misturadas).
- Com XMLs de compra → crédito do regime regular calculado com dados reais; sem eles → campo "compras ≈ X% do faturamento" ajustável. Resultado marcado como **real** ou **estimado**.
- UX/front são vitais; visual **no estilo Apple (HIG)**.

**Propostas aceitas pelo usuário**
- Vários XMLs de uma vez **e** ZIP (descompactado no navegador).
- CNPJ da empresa = emitente mais frequente, exibido para confirmação; emitente = empresa → venda; destinatário = empresa → compra.
- Faturamento dos últimos 12 meses (RBT12) e atividade (catálogo oficial `GET /calculadora/simples-nacional/atividades`) informados pela pessoa; Fator R resolvido pelo modo que o motor devolve (`NAO_APLICAVEL`/`OPCIONAL`/`OBRIGATORIO`/`INDISPONIVEL`).
- Separação de clientes empresa × consumidor final pelo CNPJ/CPF do destinatário.
- Ano da simulação: 2027.
- Processa e descarta; nada armazenado.
- Auditoria: tabela por item com erro e código oficial, exportação CSV.
- Uma empresa por análise.

## 6. Experiência

**Fluxo (3 passos, uma página)**
1. **Enviar** — área de soltar arquivos (XMLs e/ou ZIP), contador de notas lidas, notas ignoradas com motivo (XML inválido, documento não suportado, outra empresa).
2. **Confirmar empresa** — CNPJ detectado (editável), RBT12, atividade do Simples, Fator R quando o motor pedir, "% de compras" quando não houver XMLs de compra.
3. **Resultado**:

```
Padaria Exemplo LTDA · 12.345.678/0001-90         [Nova análise]

O regime regular tende a ser melhor
Diferença estimada: R$ 1.240/mês
● compras reais · 312 notas · mar–mai/2027

[ Resumo | Auditoria  14 | Memória de cálculo ]

                       Simples        Regime regular
Imposto no mês         R$ 4.100       R$ 2.860
Crédito p/ cliente PJ  R$ 310         R$ 1.900
Vendas: 62% para empresas · 38% para consumidor final
```

- **Resumo** (empresário): veredito + diferença + comparação lado a lado + composição de clientes + aviso legal.
- **Auditoria** (contador): tabela por item — nota, item, NCM/NBS, CST, cClassTrib, estado (`CALCULO_SIMULADO`, `INCONSISTENCIA_ENTRADA`, …), código de erro com título e detalhe; busca, filtro por estado/código/tipo de documento, ordenação em todas as colunas, paginação 20/50/100, exportar CSV.
- **Memória de cálculo**: texto do motor por item, com link a partir de cada linha da auditoria e de cada número do resumo.

**Visual — estilo Apple (design system do projeto)**

> **Mudança 2026-11-19 (pedido do usuário):** cores, fonte e forma passaram a ser as do site MLK Data Flow (paleta "verde de placa" #0F4D32, dourado #D9A441 só no botão primário, Geist, cantos de 4px, borda de 1px, sem sombra decorativa nem degradê, só modo claro). Os padrões de interação abaixo (lista agrupada, segmentado, folha, título grande) continuam. Fonte única: `web/src/ui/tokens.css`.

- Título grande, listas agrupadas (inset grouped), controle segmentado para as abas, folhas que sobem de baixo no celular, cores do sistema (azul de destaque; semânticas verde/âmbar/vermelho), muito respiro, suporte a modo escuro.
- Fonte: pilha do sistema (`-apple-system`, `BlinkMacSystemFont`) com **Inter** como alternativa (SF Pro e SF Symbols não podem ser usados fora de plataformas Apple). Ícones **Lucide** traço fino.
- Interação segue convenções da web (a maioria dos contadores usa Windows).
- Onde o HIG não define, vale o padrão global do autor (`ux-ui-defensive/padrao.md`): quatro estados de lista (carregando/vazio/vazio de filtro/erro), filtros, ordenação, uma única rolagem por tela, medição em 7 tamanhos com ~200 itens. A casca com menu lateral do padrão **não se aplica** (ferramenta de fluxo único, sem navegação entre módulos).

## 7. Arquitetura (abordagem A)

```
Navegador (SPA)                                Servidor (docker compose)
┌──────────────────────────────┐               ┌──────────────────────────────────┐
│ leitura XML/ZIP              │               │ Caddy: HTTPS, limite de taxa,     │
│ separação venda/compra       │  JSON itens   │ CORS, serve a SPA                 │
│ regras próprias (TS, testadas)│ ───────────► │  ├─ motor regime regular (oficial)│
│ comparação + veredito        │               │  └─ motor Simples (oficial)       │
│ UI (estilo Apple)            │               │ calculadora-pro.db (gerado no build)│
└──────────────────────────────┘               └──────────────────────────────────┘
```

- **Motores oficiais**: compilados a partir de uma tag/commit fixado dos repositórios da Receita, sem patch. A base `calculadora-pro.db` é gerada no build da imagem pelo Flyway do regime regular.
- **Atualização**: GitHub Action verifica nova release dos repositórios oficiais, recompila, roda a suíte de regressão (§9) e abre PR — nunca atualiza produção sem teste verde.
- **Regras próprias** (vivem no front, cada uma em fonte única, nomeada e com a norma citada):
  - Tabelas dos Anexos do Simples (faixas, alíquota nominal, parcela a deduzir, repartição incluindo CBS/IBS) → `pCBSSN`/`pIBSSN` a partir do RBT12. Dados em arquivo de configuração versionado, não espalhados no código.
  - Comparação Simples × regime regular: imposto da empresa no mês e crédito transferido ao cliente PJ em cada cenário.
  - Estimativa de crédito sobre compras quando não houver XMLs de compra.
- **Hospedagem da demo**: a confirmar com o usuário (§10).

## 8. Primeiro passo: spike (descartável)

Antes do plano de implementação, provar em até 1 dia:
1. Os dois motores sobem em Docker a partir das tags da Release 15, sem alteração.
2. O `calculadora-pro.db` gerado pelo Flyway do regime regular serve ao motor do Simples.
3. Um XML real de NF-e e um de NFS-e (padrão nacional) viram chamadas válidas aos dois motores, com resultado e memória de cálculo.

Se algum item falhar, a arquitetura volta para revisão antes do plano.

## 9. Qualidade

- Testes unitários (Vitest) das regras próprias com casos tirados da LC 123/2006 e LC 214/2025; cada caso cita o dispositivo.
- Regressão: conjunto de XMLs de exemplo (sem dado real de cliente) com resultado esperado dos motores, rodado a cada atualização de release.
- Teste de interface (Playwright) do fluxo completo com ~200 notas; medição de layout em 7 tamanhos.
- Acentuação correta em todo texto visível.

## 10. Decisões do usuário após a revisão (2026-11-18)

- **cClassTrib ausente no XML (notas anteriores a 2027):** o sistema **sugere** o cClassTrib pela tabela oficial NCM↔cClassTrib (dados abertos do motor), **agrupado por NCM/NBS** (dezenas de linhas, não milhares), e a pessoa confirma. Notas anteriores a 2027 são enviadas ao motor com **data de fato gerador em 2027** e a tela avisa: "notas de 2026 simuladas como se fossem de 2027". XML que já traz o grupo IBS/CBS usa os códigos da nota (e a auditoria compara com o motor).
- **Veredito:** compara o imposto total da empresa no mês — DAS completo (com CBS/IBS por dentro) × DAS sem a parcela de CBS/IBS + IBS/CBS por fora (débitos − créditos de compras) —, com **preço líquido igual** nos dois cenários. Se o crédito transferido ao cliente PJ apontar o lado oposto, o veredito vira **"depende dos seus clientes"** e mostra os dois números. Fórmulas exatas com os dispositivos da LC 123/2006 e LC 214/2025 ficam documentadas no código e testadas.
- **Hospedagem:** **só local por enquanto** (`docker compose up`). Demo pública fica para depois que o usuário avaliar a capacidade do servidor. Consequência: o plano não inclui deploy nem CI de produção; o README ensina a rodar localmente.
- **NFS-e:** **entra no MVP**, apenas o **padrão nacional**. NFS-e municipal é ignorada com o motivo explicado na lista de notas ignoradas.

## 10.1 Decisões do autor do design (podem ser corrigidas)

- **Mais de uma atividade:** a pessoa informa uma atividade do Simples por tipo de documento (NF-e/NFC-e → atividade de comércio/indústria; NFS-e → atividade de serviço). Cada atividade resolve seu anexo e sua alíquota efetiva a partir do mesmo RBT12. Item sem atividade definida não é calculado e aparece com o motivo — nunca resultado silencioso.

## 11. Deixado para quem implementar

- Bibliotecas de leitura de ZIP e de componentes (pesquisar documentação atual antes de escolher).
- Formato do CSV de exportação.
- Textos de microcopy, respeitando: veredito nunca categórico, aviso legal sempre visível no resumo.
