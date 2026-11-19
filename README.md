# Raio-X da Reforma

Aplicação web de código aberto que lê os XMLs fiscais da empresa (NF-e, NFC-e e NFS-e nacional, de vendas e de compras) e
usa os **motores de cálculo oficiais da Receita Federal** para responder duas perguntas: as notas estão corretas para o
IBS/CBS (auditoria item a item) e, a partir de 2027, compensa ficar no Simples Nacional ou passar o IBS e a CBS para o
regime regular?

> **Projeto independente, sem vínculo com a Receita Federal.** Simulação educativa; não substitui a orientação do seu contador.

<!-- TODO: gravar o GIF do fluxo completo (enviar → confirmar → resultado), salvar em docs/demo.gif e descomentar:
![Demonstração do fluxo completo](docs/demo.gif)
-->

## Por que existe

A Reforma Tributária do consumo troca PIS, Cofins, ICMS e ISS por CBS e IBS, com início em 2026 e 2027 e transição até 2033.
Para quem está no Simples Nacional, a conta mudou: a empresa pode continuar com IBS/CBS dentro do DAS ou apurá-los por fora,
no regime regular. Nessa escolha entram o crédito que o cliente empresa recebe, o crédito das compras e as faixas do Simples.
Com as notas reais em mãos, dá para simular os dois cenários, em vez de usar uma média genérica.

## Como funciona

```
 navegador (React) ──► Caddy ──► motor regime regular  (IBS/CBS/IS)
   lê os XMLs            │
   e monta a análise     └─────► motor Simples Nacional
```

- **Seus XMLs não saem do navegador.** Eles são lidos e interpretados na própria página. Aos motores de cálculo vão só,
  por item: base de cálculo (e o valor do Imposto Seletivo, quando há), NCM ou NBS, CST e cClassTrib, quantidade e unidade
  padrão; e, por nota: o tipo de documento, a data de emissão (levada a 2027), o município (código IBGE) e a UF da
  operação, as alíquotas nominais, a atividade e os percentuais do Simples. O documento vai identificado por um número sequencial (`doc-1`,
  `doc-2`…): o XML, a chave de acesso, CNPJs/CPFs, nomes e descrições dos itens não saem do navegador. Nada é guardado.
- O Caddy é o único ponto de entrada: serve a interface e encaminha `/motor/regular/...` e `/motor/simples/...` para os motores,
  que ficam numa rede interna e rodam sem nenhuma alteração.
- Fluxo em três passos: **Enviar** (XMLs soltos ou ZIP) → **Confirmar** (CNPJ, faturamento, atividade no Simples e
  classificação IBS/CBS de cada NCM/NBS) → **Resultado** (Resumo com o veredito, Auditoria em tabela com exportação CSV e
  Memória de cálculo).

| Enviar | Confirmar |
|---|---|
| ![Passo 1: envio](docs/img/1-enviar.png) | ![Passo 2: confirmação](docs/img/2-confirmar.png) |
| **Resumo** | **Auditoria** |
| ![Resumo do resultado](docs/img/3-resumo.png) | ![Auditoria item a item](docs/img/4-auditoria.png) |

As telas acima usam notas **sintéticas** (CNPJs e nomes fictícios).

## Como rodar

Requisitos: Docker com Compose v2.17 ou superior.

```bash
docker compose up --build
```

Depois acesse http://localhost:8080. O primeiro build leva vários minutos, porque compila os motores oficiais com Maven; os
seguintes usam o cache do Docker. Só o serviço `web` (Caddy) publica porta no host, presa ao `127.0.0.1` (HTTP, uso local,
fora da rede). Para encerrar:
`docker compose down`.

Detalhes dos motores (commits fixados, banco, portas) em [`motores/README.md`](motores/README.md) e [`docs/spike-motores.md`](docs/spike-motores.md).

## Testes

Todos os comandos rodam dentro de `web/` (`npm ci` uma vez).

| Camada | Comando | Precisa da pilha no ar |
|---|---|---|
| Unitários (Vitest) | `npm test` | não |
| Motores ao vivo | `npm run test:live` | sim |
| Ponta a ponta (Playwright) | `npm run test:e2e` | sim |
| Build | `npm run build` | não |

### Testes ponta a ponta

O teste ponta a ponta usa o navegador de verdade contra os motores reais, com um conjunto de ~200 notas sintéticas geradas
de forma determinística por `web/e2e/gerarNotas.ts` (150 vendas, 50 compras, NCMs com redução, uma combinação NCM × cClassTrib
inválida, duplicadas e um evento que cancela uma das vendas). Sequência de comandos:

```bash
docker compose up --build -d          # na raiz do repositório; espere os motores ficarem saudáveis
cd web
npm ci
npx playwright install chromium       # uma vez
npm run test:e2e
cd .. && docker compose down
```

O teste envia o ZIP, confirma a empresa (faturamento de R$ 1.200.000,00, atividades 01 e 07), calcula nos dois motores,
confere a nota cancelada fora da análise, o veredito, a seção "Como chegamos aqui", o `REG-011` e o achado das compras de
2026 na Auditoria, o CSV exportado e as duas origens da Memória de cálculo. As medições de layout
nos 7 tamanhos de tela estão em [`docs/medicao-layout.md`](docs/medicao-layout.md).

## Limitações

- **Imposto Seletivo (IS) não é suportado:** itens com IS ficam fora da comparação e aparecem na Auditoria como não calculados.
- **Memória de cálculo do Simples é composta pelo Raio-X:** o motor do Simples não devolve a memória; a tela a monta a partir da
  resposta dele e a rotula como tal. A do regime regular vem do motor.
- **6ª faixa do Simples:** o cálculo segue uma interpretação do teto de 5% do ISS (Res. CGSN 190, art. 21, III), ainda pendente de
  confirmação; a tela avisa.
- **CBS e IBS somados:** a comparação trata os dois tributos juntos, sem separar as diferenças de cada um. Fórmulas e premissas em [`web/src/simulacao/FORMULAS.md`](web/src/simulacao/FORMULAS.md).
- **Créditos proporcionais à receita incluída:** o crédito das compras é rateado conforme a receita efetivamente incluída no
  cálculo e dividido pelos meses das compras (se o período das compras for diferente do das vendas, o Resumo avisa).
- **Compras de 2026:** o grupo IBS/CBS dessas notas traz as alíquotas de teste (CBS 0,9%, IBS 0,1%); o crédito usa o valor
  recalculado pelo motor com as alíquotas de 2027 e a Auditoria não compara os valores ("Nota anterior a 2027").
- **Compras de fornecedor do Simples sem grupo IBS/CBS na nota não geram crédito:** a lei limita esse crédito ao que o fornecedor
  recolheu no Simples (LC 214, art. 47, § 9º, II), valor que a nota não informa; o item conta como "sem crédito calculado" e o
  crédito pode estar subestimado.
- **Notas canceladas:** NF-e/NFC-e com o evento de cancelamento no mesmo envio saem da análise. A NFS-e nacional cancelada não é
  reconhecida (não há exemplo oficial do evento nos motores); envie só as NFS-e válidas.
- **Devoluções de venda são ignoradas, não abatidas:** a nota de devolução (finNFe = 4) fica fora da análise; o faturamento da venda
  original continua inteiro.
- **Saídas sem receita:** itens com CFOP de transferência (x.15x) ou de remessa e outras saídas (x.9xx, exceto x.933, serviço com
  ISSQN) e notas de entrada emitidas pela própria empresa (tpNF = 0) não entram no faturamento; o Resumo diz quantos itens ficaram
  de fora.
- **Filiais contam como outra empresa:** a empresa é identificada pelo CNPJ completo; notas de outro estabelecimento com a mesma raiz
  de CNPJ ficam fora da análise ("Outra empresa").
- **Arquivos:** só XML e ZIP (com até um nível de ZIP dentro de ZIP); arquivo com mais de 20 MB, ou que leve o envio a passar de
  300 MB descompactados, fica de fora com o motivo.
- **Alíquotas de 2027 de referência:** os dados abertos de 2027 ainda não existem (HTTP 404); o cálculo usa alíquotas de
  referência, e notas de 2026 são simuladas como se fossem de 2027.
- **Auditoria das vendas:** os valores recalculados vêm do motor do Simples (o certo para quem é do Simples); a validação de
  CST × cClassTrib × NCM/NBS vem do motor do regime regular, rodado nos mesmos itens, e seus erros (`REG-xxx`) entram na linha da
  venda. O valor destacado na nota (regime regular) pode divergir do valor do Simples por natureza: leia "valor divergente" como
  um ponto de atenção, não como erro da nota.

## Créditos

Os cálculos são feitos pelos motores oficiais da Receita Federal do Brasil, usados sem modificações:

- [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular)
- [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional)

Este projeto é independente e não possui vínculo com a Receita Federal do Brasil. Ver [`NOTICE`](NOTICE).

## Licença

[MIT](LICENSE) © 2026 MadCrow69.
