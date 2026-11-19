# Spike — motores oficiais da Receita em Docker

Resultado: **GO**. Os dois motores (Release 15, commits em `motores/README.md`) constroem sem patches, sobem em Docker
e respondem. Os fixtures em `web/src/motor/__fixtures__/` são respostas reais (não editadas) dos motores.

## Como rodar / expor no spike

```bash
docker compose -f docker-compose.yml -f docker-compose.spike.yml up -d --build   # spike: publica em loopback
docker compose down
```
`docker-compose.yml` não publica porta alguma (rede interna `interna`); `docker-compose.spike.yml` publica
`127.0.0.1:18080 -> motor-regular:8080` e `127.0.0.1:18082 -> motor-simples:8082`, só para verificação.
No Git Bash do Windows usar `MSYS_NO_PATHCONV=1` ao passar caminhos `/...` ao Docker.

## Fatos medidos

- Portas internas: regime regular **8080**, Simples **8082** (contexto `/api`; o yml do Simples cita 3000/9102 só nos comentários do `run-offline.sh`, o valor real é `server.port: 8082`). Actuator/métricas: 9101 (regular) e 9103 (Simples), não expostos.
- `GET /api/swagger-ui.html` responde **302** para `/api/swagger-ui/index.html` (200). O healthcheck do compose usa o destino final.
- O Simples usa o mesmo `calculadora-pro.db` do regime regular (copiado do estágio `base`): sobe e calcula. Versão do banco: V0059 (2026-09-30).
- Startup: ~25 s até `healthy`. Imagens: regular 422 MB, Simples 415 MB, `base` 5,5 MB (só o .db). RAM ociosa (`docker stats`): regular ~577 MiB, Simples ~474 MiB (JVM sem limite; não limitar abaixo de ~512 MiB sem testar).
- Build frio leva vários minutos (download Maven); cache de camadas Docker acelera as reconstruções.

## Chamadas (resultado)

1. Regime regular `POST /api/calculadora/observabilidade/regime-geral` com o exemplo oficial e `dhFatoGerador=2027-03-10` → 200; itens 1–3 `CALCULO_SIMULADO`, item 4 `INCONSISTENCIA_ENTRADA` `REG-011`; header `x-warning-dados-simulados`. Fixture `regular-nfe-2027.json`.
   - Item com NCM de IS (22030000) sem bloco `impostoSeletivo` → `REG-013`.
   - `aliquotasNominais` é obrigatório em 2027 e simula o cálculo (`CALCULO_SIMULADO`).
2. Simples `POST /api/calculadora/observabilidade/simples-nacional` (valores como **string**; `CRT`, `cAtivSN`, `cClassTrib`, `pIBSSN`, `pCBSSN` em camelCase exato):
   - `tpDoc=55`, `CRT=1`, `data=2027-03-15`, `cAtivSN=01`, base 950.00, `pCBSSN=2.75`, `pIBSSN=1.25` → `CALCULADO`, `vIBSSN=11.88`, `vCBSSN=26.12`, `totalItem=38.00` (`simples-nfe-2027.json`).
   - `tpDoc=91`, `cAtivSN=07` → mesmo cálculo (`simples-nfse-2027.json`).
   - Atividades têm `tpDocsAdmissiveis`: 01–04 → 55/65; 05 → 57/63/67/93; 06 → 62; 07–14 → 91; 90 → todos. Atividade incompatível com o `tpDoc` → item não calculado (sem erro).

## Cenário "IBS/CBS por fora" (empresa do Simples)

- **Motor do Simples**: `CRT=3` + `tpRegimeIBSCBS=2` (admitido só com CRT=3) → 200, `CALCULADO`, mas **`vIBSSN=0`/`vCBSSN=0`** e os valores aparecem em `vIBSPendSusp=11.88`/`vCBSPendSusp=26.12` (apuração por fora; nada vai no DAS). `CRT=3` sem `tpRegimeIBSCBS=2` → 422 `VSN-019`. Fixture `simples-scenario-crt3-por-fora.json`.
- **Motor do regime regular**: o valor efetivo do IBS/CBS apurado por fora (alíquotas cheias) vem de `POST /observabilidade/regime-geral` com `aliquotasNominais`. Fixture `regular-scenario-simples-por-fora.json` (NCM 61091000, cst 000/cClassTrib 000001, base 950.00, CBS 0.9, IBS 0.05+0.05 → vIBS 0.95, vCBS 8.55).
- Conclusão: o cenário é reproduzido combinando as duas chamadas (Simples com CRT=3/tpRegimeIBSCBS=2 para o enquadramento; regular para o valor).

## municipio / uf (regime regular)

NÃO VERIFICADO como "destino": o código só exige `municipio` (IBGE, obrigatório) e `uf` (opcional, derivada do município se ausente; validam-se entre si). O repositório não documenta se é local de destino/fornecimento; o motor usa esse local para buscar as alíquotas por UF/município. Com `aliquotasNominais` informadas em 2027 não há diferença observável no resultado. Tratar como "local da operação" até confirmação em NT/LC 214.

## Rotas de dados abertos (regime regular, base `/api/calculadora/dados-abertos`)

| Rota | Parâmetros | Resposta (2026-06-01) |
|---|---|---|
| `aliquota-uniao` | `data` | `{"aliquotaReferencia":0.9}` |
| `aliquota-uf` | `codigoUf` (IBGE, ex. 43), `data` | `{"aliquotaReferencia":0.1}` |
| `aliquota-municipio` | `codigoMunicipio` (IBGE), `data` | `{"aliquotaReferencia":0.0}` |

De 2027-01-01 em diante as três retornam **404** (`problem+json`, "Alíquota não encontrada"): alíquotas devem ir em `aliquotasNominais`. Fixtures `dados-abertos-aliquota-*.json`.
Simples: `GET /api/calculadora/simples-nacional/atividades?data=2027-01-01` → array de 15 objetos `{codigo, ordem, descricao, anexoSemFatorR, anexoComFatorR, sujeitaFatorR, rotuloAnexo, rotuloCurtoAnexo, disponivel, anexosFaltantes, modoFatorR, tpDocsAdmissiveis}` (`simples-atividades-2027.json`).
