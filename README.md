# Raio-X da Reforma

Aplicação web de código aberto que lê XMLs fiscais (NF-e/NFC-e) no próprio
navegador e consulta os motores de cálculo oficiais da Receita Federal para
mostrar o impacto da Reforma Tributária (IBS, CBS e IS).

> **Projeto independente, sem vínculo com a Receita Federal.**

## Como rodar

Requisitos: Docker com Compose v2.17 ou superior.

```bash
docker compose up --build
```

Depois acesse http://localhost:8080.

O primeiro build leva vários minutos, porque compila os motores oficiais com
Maven. Os builds seguintes usam o cache do Docker.

Somente o serviço `web` (Caddy) publica porta no host (`8080`, HTTP, uso local).
Os motores ficam numa rede interna e são alcançados pela mesma origem:

- `/motor/regular/api/...` → motor do regime regular
- `/motor/simples/api/...` → motor do Simples Nacional

## Desenvolvimento da interface

```bash
cd web
npm ci
npm test
npm run build
```

Detalhes dos motores em [`motores/README.md`](motores/README.md).

## Créditos

Os cálculos são feitos pelos motores oficiais da Receita Federal do Brasil,
usados sem modificações:

- [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular)
- [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional)

Ver [`NOTICE`](NOTICE).

## Licença

[MIT](LICENSE) © 2026 MadCrow69.
