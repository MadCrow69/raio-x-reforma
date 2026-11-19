# Fontes — alíquota efetiva do Simples e parcelas de CBS/IBS (2027–2028)

Dados: `anexos-2027.json`. Cálculo: `aliquotaEfetiva.ts`. Conferência automática das tabelas contra as fontes: `conferir-fontes.py`.
Percentuais em pontos (`4.00` = 4%). Nenhum número deste diretório vem de fonte secundária.

## Fontes primárias

| Fonte | O que forneceu |
|---|---|
| LC 214/2025, art. 519 e Anexos XVIII a XXII — <https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm> (baixada em 18/11/2026, SHA-256 `e15cbb2c…a09ba5`) | Nova redação dos Anexos I a V da LC 123/2006. Tabelas "Para os anos-calendário 2027 e 2028": faixas, alíquota nominal, parcela a deduzir, repartição com CBS e IBS e a nota (*) do teto de ISS. Efeitos a partir de 1º/1/2027 pelo art. 544, III (redação da LC 227/2026). |
| LC 227/2026, art. 174 — <https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm> (SHA-256 `05d032ee…0a50`) | Nova redação da partilha do Anexo XX (Anexo III) para 2027–2028: CBS das faixas 3 e 4 passou de 16,42% (soma 100,01%) para 16,41%. No Anexo XXI (Anexo IV) mudou só a partilha de 2029 em diante. Também dá a redação do art. 18, § 1º-B, I, da LC 123 (teto de 5% do ISS). |
| Resolução CGSN nº 190/2026 (DOU 10/8/2026), arts. 1º e 6º — <https://www.in.gov.br/web/dou/-/resolucao-cgsn-n-190-de-4-de-agosto-de-2026-724454118> (SHA-256 `6dea9a64…efea`) | Anexos I a V da Res. CGSN 140/2018 com efeitos a partir de 1º/1/2027: mesmas tabelas da LC, publicadas de forma independente (conferência célula a célula). Art. 21, III (teto de ISS) e IV (6ª faixa) e as notas "Quando o valor do RBT12 for superior ao limite da 5ª faixa…" de cada anexo. |
| Perguntas e Respostas do Simples Nacional, Receita Federal (atualizado parcialmente em 09/10/2026), pergunta 5.3.1 — <http://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf> (SHA-256 `08667b6c…0d73f`) | Exemplo oficial da fórmula da alíquota efetiva "considerando a regra até o ano calendário 2026 e 2027": Anexo I, RBT12 R$ 220.000,00 → 4,60%; R$ 25.000,00 × 4,60% = R$ 1.150,00. Usado no teste de cruzamento. A pergunta 5.3.2 (regra de 2027) remete os exemplos ao futuro manual do PGDAS-RTC: **não há exemplo oficial publicado da parcela de CBS/IBS**. |
| Motor oficial do Simples (repositório `calculadora-rtc-simples-nacional`, Release 15, ROADMAP e `ItemSimplesInput`) | Confirma que `pCBSSN`/`pIBSSN` são informados pelo chamador, em pontos percentuais. O motor não traz tabela de faixas nem de repartição (nem nas migrações V0047/V0050 do Flyway), então não houve o que cruzar com ele. |

A LC 123/2006 consolidada no Planalto ainda mostra os Anexos de 2018 (com PIS/Cofins) e só remete à LC 214 ("Vide"). Por isso a transcrição saiu do texto da própria LC 214, descartando o texto tachado (redação revogada).

## Transição em 2027

- **CBS substitui PIS/Pasep e Cofins na repartição.** O art. 542, XXXVI, "a", da LC 214 revoga os incisos IV e V do art. 13 da LC 123 a partir de 1º/1/2027. Nas tabelas de 2027–2028, a coluna CBS fica onde estavam PIS e Cofins.
- **O IBS já tem parcela em 2027**, pequena: de 0,15% a 0,27% da alíquota efetiva nas faixas 1–5. Na 6ª faixa, a parcela vem da regra do sublimite (ver abaixo).
- **ICMS e ISS continuam** até 2032 (revogação pelo art. 543 da LC 214, a partir de 2033). **IPI continua** no Anexo II.
- **Alíquota nominal da 6ª faixa** em 2027–2028: 18,90% (I), 29,90% (II), 32,90% (III e IV), 30,40% (V). De 2029 em diante: 19,00%, 30,00%, 33,00%, 33,00% e 30,50%.
- As faixas 1–5 têm a mesma alíquota nominal e parcela a deduzir das tabelas de 2018. Só muda a repartição.

## Convenções do JSON

- `ate`: limite superior da faixa. A faixa é a primeira com `RBT12 ≤ ate`.
- `-` na tabela oficial (tributo fora da repartição da faixa, por exemplo ICMS/ISS/IBS na 6ª faixa) é omitido no JSON e vira 0 ao carregar (`reparticao` sempre tem `CBS` e `IBS`).
- Cada faixa soma exatamente 100,00% (testado).

## Regras implementadas que mudam pCBSSN/pIBSSN

1. **Teto de 5% do ISS na 5ª faixa (Anexos III e IV)**: LC 123, art. 18, § 1º-B, I (redação da LC 214, art. 517, com a LC 227); nota (*) dos Anexos XX e XXI da LC 214 e dos Anexos III e IV da Res. CGSN 140 (redação da Res. 190). Quando a efetiva passa de **14,92537%** (Anexo III) ou **12,5%** (Anexo IV), o ISS fica em 5% e cada tributo recebe `(efetiva − 5) × percentual da linha "5ª Faixa, com alíquota efetiva superior a…"`. O limiar usado é o do texto da nota. A linha da tabela traz "14,93%", que é só o arredondamento de 14,92537%. A soma dos percentuais continua igual à efetiva. Campo `tetoIss` do JSON.
2. **6ª faixa (RBT12 acima de R$ 3.600.000,00)**: Res. CGSN 140, art. 21, IV (redação da Res. 190), e notas "Quando o valor do RBT12 for superior ao limite da 5ª faixa, para a parcela que não exceder o sublimite…" de cada anexo. Os tributos federais (incluindo a CBS) usam a efetiva da 6ª faixa. ICMS, ISS e IBS usam `[(RBT12 × nominal da 5ª) − PD da 5ª] / RBT12 × percentual da 5ª faixa`. Nesse caso `efetivaTotal` é a soma dos percentuais de todos os tributos (efetiva da 6ª + ICMS/ISS/IBS da 5ª), para que `dasSemCbsIbs` represente o DAS sem CBS/IBS. O aviso de sublimite e o CRT=2 (IBS fora do DAS depois de ultrapassar o sublimite) ficam com a interface.
3. **Teto de 5% do ISS também na 6ª faixa (Anexos III, IV e V)**. Base: LC 123, art. 18, § 1º-B, I, e Res. CGSN 140, art. 21, III (redação da Res. 190): "o percentual efetivo máximo destinado ao ISS será de 5%, e eventual diferença será transferida, de forma proporcional, aos tributos federais e IBS da mesma faixa". Segundo a revisão da Task 6 (não conferido por mim), a Res. 140 anterior a 2027 também limitava o ISS a 5% na nota da 6ª faixa. Quando o ISS calculado pela regra do item 2 passa de 5 pontos, o ISS fica em 5 e o excedente é distribuído entre os tributos federais da 6ª faixa (pelos percentuais de repartição da 6ª) e o IBS (pelo percentual da 5ª faixa, o mesmo usado para o IBS na 6ª), proporcionalmente a esses percentuais. Exemplo: Anexo III, RBT12 4 mi → ISS 5,982765 vira 5; o excedente de 0,982765 é dividido por 35,09 + 15,04 + 19,29 + 30,58 + 0,17 = 100,17. O total (`efetivaTotal`) não muda. Isso muda pCBSSN, pIBSSN e `dasSemCbsIbs`. **INTERPRETAÇÃO pendente de ratificação humana:** a fórmula literal da nota da 6ª faixa na Res. 190 aplica o percentual cheio de ISS da 5ª faixa sem teto (decisão do coordenador na revisão da Task 6, aplicando o art. 21, III). Pesos alternativos possíveis, não adotados: os percentuais efetivos de cada tributo em vez dos percentuais de repartição. A diferença no IBS fica abaixo de 0,002 ponto.

## Regras registradas que não mudam pCBSSN/pIBSSN deste módulo

- **Anexo II, nota da 6ª faixa da Res. 190**: a fórmula do ICMS traz "RBT12 x 21% − R$ 125.640,00 … x 33,50%", números do Anexo III. É erro material da resolução. O código aplica a regra geral do art. 21, IV (5ª faixa do próprio Anexo II: 14,70%, R$ 85.500,00, 32,00%), substituição ratificada pelo coordenador na revisão da Task 6 e coberta por teste. A fórmula do IBS da mesma nota está correta (14,70%, R$ 85.500,00, 0,15%) e é a usada.
- **Deduções por tipo de receita** (locação de bens móveis sem ISS, LC 123 art. 18, § 5º-A; bens materiais sem ICMS e serviços sem ISS/ICMS, Res. 140 art. 25, I-A e X; exportação, ST e monofásicos): retiram a parcela de outro tributo, mas não mudam o percentual de CBS/IBS em pontos. No motor oficial, a exportação é tratada pelo `tpRBSN` do cClassTrib (V0047/V0050). Ficam com quem monta a apuração.
- **RBT12 a partir de 2027** (Res. 140 art. 21, II, "a", na redação da Res. 190; P&R 5.3.2): soma dos 12 meses antecedentes ao **mês anterior** ao do período de apuração. Isso define o valor que a interface pede, não este cálculo.
- **Início de atividade** (Res. 140 art. 22, § 2º): 1º e 2º mês pela 1ª faixa; do 3º ao 13º, média × 12. Responsabilidade de quem informa o RBT12.

## Fator R

`anexoPorFatorR`: LC 123, art. 18, §§ 5º-J e 5º-M. Com `folha12 / RBT12 ≥ 28%`, vale o anexo "com Fator R" (III); abaixo disso, o "sem Fator R" (V). A comparação é feita como `folha12 ≥ 0,28 × RBT12`, sem divisão. RBT12 ≤ 0 ou folha negativa geram erro (`RangeError`, em português).

## Divergência fora do escopo (2029+)

A Res. CGSN 190 repete 18,90% na 6ª faixa do Anexo I "a partir do ano-calendário 2029", e a LC 214 (Anexo XVIII) diz 19,00%. Não afeta 2027–2028. Revisar quando as tabelas de 2029 forem incorporadas.

## Como conferir de novo

`python -I web/src/regras/simples/conferir-fontes.py` baixa a LC 214 do Planalto e a Res. 190 do DOU e compara cada célula do JSON com as duas. O DOU costuma responder 403 para scripts: nesse caso salve a página e passe `--res190 arquivo.htm`. Em 18/11/2026: 0 divergências nas duas fontes. Teste de sensibilidade: alterar uma célula (por exemplo, CBS 16,41 → 16,42) gera DIVERGE.
