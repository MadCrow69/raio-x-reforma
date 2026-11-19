# Motor oficial do Simples Nacional — Receita Federal / SERPRO. Sem patches.
# O repositório não traz scripts de banco: o .db vem do estágio `base` do regime regular
# (contexto nomeado `base`; ver motores/README.md).
ARG COMMIT_SIMPLES=c5b0f01c8351c3f0d0795cc617b29d233e9f98df

FROM eclipse-temurin:21-jdk AS build
ARG COMMIT_SIMPLES
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git . \
    && git checkout ${COMMIT_SIMPLES}
RUN ./mvnw -DskipTests package --batch-mode

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /src/target/api-simples-nacional.jar ./api-simples-nacional.jar
COPY --from=base /calculadora/db ./calculadora/db
EXPOSE 8082
ENTRYPOINT ["java", "-Dspring.profiles.active=offline", "-jar", "api-simples-nacional.jar"]
