# Medição de layout

Data: 2026-11-19 (refeita após a revisão final: seção "Como chegamos aqui" no Resumo, duas memórias nas vendas, nota cancelada e CSP). Medidor: `layout-audit.js` do protocolo de interface (regras em `scripts/README.md` do protocolo: rolagem, corte, vazamento, sobreposição, alvo de toque, tamanho de controle).

## Como foi medido

- Pilha real (`docker compose up --build`), navegador Chromium via Playwright, com o fluxo completo e o conjunto sintético de ~200 notas (`web/e2e/gerarNotas.ts`: 203 arquivos, 199 notas na análise, 4 ignorados — 2 duplicadas, 1 evento e a venda cancelada por ele).
- Para cada um dos 7 tamanhos: Enviar (após a leitura do ZIP), Confirmar (com a lista de classificações preenchida), Resultado (Resumo, Auditoria e Memória de cálculo, calculados nos motores oficiais).
- Reproduzir: subir a pilha e rodar, em `web/`:
  `LAYOUT_AUDIT_JS=<caminho do layout-audit.js> npm run test:e2e -- medirLayout`
  (sem a variável o teste é pulado). O resultado detalhado sai em `web/e2e/.resultados/medicao-layout.json` (não versionado).
- O medidor é injetado como script inline; como o Caddy serve a SPA com CSP `script-src 'self'`, só o `medirLayout.spec.ts` roda com `bypassCSP` (o `fluxo.spec.ts` roda com a CSP ativa e confere que nada é bloqueado).

## Resultado

35 medições (7 tamanhos × 5 telas): **0 falhas**.

| Tamanho | Enviar | Confirmar | Resultado · Resumo | Resultado · Auditoria | Resultado · Memória |
|---|---|---|---|---|---|
| 1920×1080 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 1366×768 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 1366×657 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 1024×657 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 768×1024 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 390×844 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |
| 360×800 | 0 falhas | 0 falhas | 0 falhas | 0 falhas | 0 falhas |

Linhas da tabela da Auditoria visíveis sem rolar (20 por página): 16 em 1920×1080, 9 em 1366×768, 8 em 1366×657, 8 em 1024×657, 15 em 768×1024; em 390×844 e 360×800 a lista vira cartões.

O Resumo, com a seção "Como chegamos aqui", passou a rolar a página (documento) em todos os tamanhos, inclusive 1920×1080: é a rolagem única da página, sem rolagem aninhada. Na primeira medição desta rodada houve 2 falhas em Enviar (390×844 e 360×800, `texto-vazando`): o detalhe da nota cancelada cita o caminho do evento, longo e sem espaços. Corrigido com `overflow-wrap: anywhere` em `.ignorados__explicacao`; a medição acima é a refeita.

## Observações

- Zero falhas prova geometria, não beleza nem fluxo.
- Em notebook real (1366×657) a Auditoria mostrava 5 linhas, contra 8 da tela-modelo. Ajustes, só nas telas de lista: a barra do Resultado virou uma linha (empresa · abas · Nova análise); em altura ≤ 700 px o título/contagem da Auditoria saem da vista (seguem para leitor de tela; a contagem está no selo da aba e no rodapé da tabela) e as margens verticais diminuem. Resultado: 8 linhas em 1366×657 (meta ≥ 8), 9 em 1366×768.
- A rolagem vertical da página em Enviar/Confirmar nos tamanhos menores é esperada (conteúdo maior que a janela, sem rolagem aninhada).
