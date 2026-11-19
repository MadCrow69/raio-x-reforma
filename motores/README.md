# Motores oficiais da Receita Federal

Os dois motores rodam **sem nenhum patch**, construídos a partir de commits fixados (Release 15):

| Motor | Repositório | Commit (`ARG`) |
|---|---|---|
| Regime regular (IBS/CBS/IS) | https://github.com/ReceitaFederal/calculadora-rtc-regime-regular | `COMMIT_REGULAR=150cccbe414d4a5edea703e4f7a424af5aa222c7` |
| Simples Nacional | https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional | `COMMIT_SIMPLES=c5b0f01c8351c3f0d0795cc617b29d233e9f98df` |

Para atualizar a release: trocar o `ARG` no Dockerfile (ou `--build-arg`) e refazer o spike de `docs/spike-motores.md`.

## Banco de dados (`calculadora-pro.db`)

O repositório do Simples não traz scripts de banco; as tabelas dele são criadas pelo Flyway do regime regular.
O Dockerfile do regime regular tem um estágio `base` (`FROM scratch`) que contém apenas
`/calculadora/db/calculadora-pro.db`.

```bash
docker build --target base -f motores/regime-regular.Dockerfile -t raio-x-reforma/base .
```

Mecanismo de reuso (contexto nomeado `base`): `motores/simples-nacional.Dockerfile` faz `COPY --from=base`.

- No compose: `additional_contexts: { base: "service:base" }` (o serviço `base` tem `replicas: 0`, só constrói a imagem `raio-x-reforma/base`).
- Fora do compose: `docker build --build-context base=docker-image://raio-x-reforma/base -f motores/simples-nacional.Dockerfile .`
- Outros Dockerfiles (Task 5): mesmo padrão, `COPY --from=base /calculadora/db ...`.

## Portas internas

Regime regular `8080`, Simples `8082` (contexto `/api`). Nenhuma é publicada no `docker-compose.yml`;
`docker-compose.spike.yml` publica em loopback só para verificação.
