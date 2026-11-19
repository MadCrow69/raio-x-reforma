# Motor oficial do regime regular (IBS/CBS/IS) — Receita Federal / SERPRO. Sem patches.
# Estágios: build (clone + flyway + package) -> base (só o .db) -> runtime.
ARG COMMIT_REGULAR=150cccbe414d4a5edea703e4f7a424af5aa222c7

FROM eclipse-temurin:21-jdk AS build
ARG COMMIT_REGULAR
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git . \
    && git checkout ${COMMIT_REGULAR}
RUN mkdir -p calculadora/db \
    && ./mvnw flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --batch-mode --errors
RUN ./mvnw -DskipTests package --batch-mode

# Contém somente o banco SQLite; reutilizado pelo motor do Simples e pela Task 5.
FROM scratch AS base
COPY --from=build /src/calculadora/db/calculadora-pro.db /calculadora/db/calculadora-pro.db

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /src/target/api-regime-geral.jar ./api-regime-geral.jar
COPY --from=base /calculadora/db ./calculadora/db
EXPOSE 8080
ENTRYPOINT ["java", "-Dspring.profiles.active=offline", "-jar", "api-regime-geral.jar"]
