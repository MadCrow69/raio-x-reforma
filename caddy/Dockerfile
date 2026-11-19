# Build a partir da raiz do repositório: docker build -f caddy/Dockerfile .
# (a raiz como contexto permite estágios que copiam de `base`, ver Task 5)
FROM node:22 AS spa
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM caddy:2
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=spa /app/web/dist /srv
