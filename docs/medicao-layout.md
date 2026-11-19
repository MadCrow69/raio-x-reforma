# Medição de layout

Data: 2026-11-19. Medidor: `layout-audit.js` do protocolo de interface (regras em `scripts/README.md` do protocolo: rolagem, corte, vazamento, sobreposição, alvo de toque, tamanho de controle).

## Como foi medido

- Pilha real (`docker compose up --build`), navegador Chromium via Playwright, com o fluxo completo e o conjunto sintético de ~200 notas (`web/e2e/gerarNotas.ts`: 200 notas válidas, 3 arquivos ignorados, 296 itens na Auditoria).
- Para cada um dos 7 tamanhos: Enviar (após a leitura do ZIP), Confirmar (com a lista de classificações preenchida), Resultado (Resumo, Auditoria e Memória de cálculo, calculados nos motores oficiais).
- Reproduzir: subir a pilha e rodar, em `web/`:
  `LAYOUT_AUDIT_JS=<caminho do layout-audit.js> npm run test:e2e -- medirLayout`
  (sem a variável o teste é pulado). O resultado detalhado sai em `web/e2e/.resultados/medicao-layout.json` (não versionado).

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

Linhas da tabela da Auditoria visíveis sem rolar (20 por página): 15 em 1920×1080, 8 em 1366×768, 5 em 1366×657, 5 em 1024×657, 15 em 768×1024; em 390×844 e 360×800 a lista vira cartões.

## Observações

- Zero falhas prova geometria, não beleza nem fluxo.
- Em notebook real (1366×657) a Auditoria mostra 5 linhas sem rolar, contra 8 da tela-modelo do protocolo (referência de 2026-10-28). Não é falha do medidor; é o cabeçalho (título, busca e filtros) ocupando mais altura. Candidato a ajuste futuro.
- A rolagem vertical da página em Enviar/Confirmar nos tamanhos menores é esperada (conteúdo maior que a janela, sem rolagem aninhada).
