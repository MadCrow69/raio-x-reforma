# Build a partir da raiz do repositório: docker build -f caddy/Dockerfile .
# Requer o contexto adicional `base` (motores/regime-regular.Dockerfile, alvo base):
#   docker compose build web   (compose já declara additional_contexts)
FROM node:22 AS spa
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Exporta, do banco oficial do motor, as sugestões de cClassTrib por NCM/NBS.
FROM alpine:3 AS sugestoes
RUN apk add --no-cache sqlite
COPY --from=base /calculadora/db/calculadora-pro.db /tmp/calculadora-pro.db
COPY motores/exportar-sugestoes.sql /tmp/exportar-sugestoes.sql
RUN mkdir -p /dados     && sqlite3 -noheader /tmp/calculadora-pro.db < /tmp/exportar-sugestoes.sql > /dados/sugestoes-classificacao.json     && test -s /dados/sugestoes-classificacao.json

FROM caddy:2
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=spa /app/web/dist /srv
COPY --from=sugestoes /dados /srv/dados
