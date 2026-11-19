# Fórmulas — simulação Simples × IBS/CBS por fora e veredito

Código: `simular.ts`. Testes: `simular.test.ts` (números redondos montados à mão, um caso por regra).
Valores em R$; percentuais em pontos (`10` = 10%). Nenhum valor é arredondado aqui: arredondar é papel da exibição. Toda divisão usa 40 casas decimais (`CASAS_DIVISAO`, `web/src/dominio/decimal.ts`), sem depender do `Big.DP` global.

## O que se compara (decisão do usuário, spec §10)

> "compara o imposto total da empresa no mês — DAS completo (com CBS/IBS por dentro) × DAS sem a parcela de CBS/IBS + IBS/CBS por fora (débitos − créditos de compras) —, com **preço líquido igual** nos dois cenários. Se o crédito transferido ao cliente PJ apontar o lado oposto, o veredito vira **"depende dos seus clientes"** e mostra os dois números."
> — `docs/superpowers/specs/2026-11-18-raio-x-reforma-design.md`, §10

Os dois cenários são do mesmo contribuinte, optante pelo Simples Nacional:

| Cenário | No código | Motor que calcula CBS/IBS |
|---|---|---|
| CBS/IBS dentro do DAS (regra padrão) | `simples` / `porDentro` (`SIMPLES_POR_DENTRO`) | motor do Simples |
| CBS/IBS por fora, pelo regime regular (opção) | `regular` / `porFora` (`SIMPLES_POR_FORA`) | motor do regime regular, alíquotas nominais de 2027 |

## Base legal

Fontes primárias, texto compilado do Planalto baixado em 19/11/2026:
- LC 214/2025 — <https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm> (SHA-256 `95466d3e…f9d5e1`). As alterações da LC 123/2006 estão nos arts. 516 e 517 da LC 214; as redações dadas depois pela LC 227/2026 aparecem nesse texto com a anotação "(Redação dada / Incluído pela Lei Complementar nº 227, de 2026)".
- LC 123/2006 — <https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm> (SHA-256 `17f3cb9d…e67a4`). O texto compilado ainda não incorpora as redações de 2027; para elas vale o texto da LC 214, arts. 516 e 517.
- LC 227/2026 — <https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm> (SHA-256 `5f2e7463…b1865a`). Conferido na fonte: o art. 174 da LC 227 dá nova redação ao art. 517 da LC 214, que por sua vez altera a LC 123, art. 13, §§ 9º a 11 (texto idêntico ao citado abaixo) e art. 23, §§ 1º, 1º-A, 2º e 3º.

| Regra | Dispositivo |
|---|---|
| O optante pelo Simples fica sujeito às regras do Simples para IBS/CBS, mas pode optar por apurá-los e recolhê-los pelo regime regular | LC 214, art. 41, §§ 2º e 3º; a opção é exercida nos termos da LC 123 (art. 41, § 4º) |
| Com a opção, as parcelas de IBS e CBS **não são cobradas pelo DAS** | LC 123, art. 13, § 9º, na redação do art. 517 da LC 214 dada pelo art. 174 da LC 227/2026: "hipótese em que as parcelas a eles relativas não serão cobradas pelo regime único" |
| Opção semestral (janeiro e julho), irretratável no semestre | LC 123, art. 13, § 10 (mesma origem do § 9º) |
| DAS = alíquota efetiva × receita bruta do mês | LC 123, art. 18, caput, §§ 1º-A e 3º; alíquota efetiva e parcelas de CBS/IBS: `web/src/regras/simples/FONTES.md` |
| Regime regular: saldo do mês = débitos − créditos; saldo negativo é **saldo a recuperar** (ressarcimento ou compensação) | LC 214, art. 45, caput, I e II, e § 3º, I e II; período mensal: art. 43 |
| Crédito das compras no regime regular = IBS/CBS destacados no documento fiscal e extintos | LC 214, art. 47, caput e § 2º, I; vale também para compras de optante pelo Simples (§ 3º) |
| Sem a opção, o optante pelo Simples **não** se credita de IBS/CBS das compras | LC 214, art. 47, § 9º, I |
| Cliente PJ no regime regular que compra de optante pelo Simples **sem** a opção: crédito "em montante equivalente ao devido por meio desse regime" | LC 214, art. 47, § 9º, II; LC 123, art. 23, § 1º-A (art. 517 da LC 214, na redação do art. 174 da LC 227/2026) e § 2º (alíquota informada no documento fiscal) |
| Cliente PJ que compra de optante **com** a opção: crédito do IBS/CBS destacado (regra geral) | LC 214, art. 47, caput e § 2º, I |

## Fórmulas

Notação: para cada item de venda incluído (ver "Itens incluídos"), `receita` = `baseCalculo` do item; `a` = `AliquotasSimples` da atividade (`cAtivSN`) do tipo de documento da nota; `dentro`/`fora` = `vCBS + vIBSUF + vIBSMun` do item no cenário correspondente; `n` = número de meses.

1. **Meses** (`meses`): os `'AAAA-MM'` distintos da emissão **original** (não levada a 2027) das notas de venda com pelo menos um item incluído, em ordem. `n = meses.length`. O mês original evita juntar meses iguais de anos diferentes (nov/2025 e nov/2026 seriam ambos "2027-11"); a simulação em 2027 já é sinalizada por `notas2026Simuladas`. Mês em que nenhuma venda foi incluída não dilui a média. Sem nota de venda, ou sem receita incluída ("Nenhum item foi calculado nos dois cenários; não há base para comparar."), não há média: `RangeError`.
2. **Faturamento** (`faturamentoMes`) = Σ receita ÷ n.
3. **Simples, DAS completo** (`simples.impostoMes`) = Σ receita × `a.efetivaTotal` / 100 ÷ n. (LC 123, art. 18.)
4. **Regular** (`regular.impostoMes`) = (Σ receita × `a.dasSemCbsIbs` / 100 + Σ fora) ÷ n − créditosMes. (LC 123, art. 13, § 9º; LC 214, art. 45.)
   - **Sem piso em zero.** Se os créditos passam dos débitos, o valor fica negativo: é o saldo a recuperar do art. 45, § 3º, II, que pode ser ressarcido ou compensado. Teste: créditos 500 → −340.
5. **Créditos das compras** (`créditosMes`), conforme `origemCompras`:
   - `REAL`: `creditos` é o **total do período** (Σ vCBS + vIBSUF + vIBSMun das compras, do grupo IBS/CBS da nota ou recalculado pelo motor), somado por quem chama `simular`. Como os débitos só cobrem os itens incluídos, os créditos são proporcionalizados pela receita incluída: créditosMes = `creditos` × (Σ receita incluída ÷ Σ receita de todos os itens de venda) ÷ n. **Premissa**: as compras se relacionam com a receita de forma proporcional. O campo `compras` da entrada não é lido por `simular`.
   - `ESTIMADA`: créditosMes = faturamentoMes × `percentualSobreFaturamento` / 100 × `aliquotaNominalTotal` / 100, em que `aliquotaNominalTotal` = CBS + IBS estadual + IBS municipal, em pontos. Supõe que todas as compras estimadas dão crédito cheio à alíquota nominal.
6. **Crédito do cliente PJ** (`creditoClientePJMes`), só itens vendidos a destinatário `PJ`:
   - `simples` = Σ dentro ÷ n (montante equivalente ao cobrado pelo Simples: LC 214, art. 47, § 9º, II; LC 123, art. 23, § 1º-A).
   - `regular` = Σ fora ÷ n (IBS/CBS destacados: LC 214, art. 47, caput).
7. **Diferença** (`diferencaMes`) = simples.impostoMes − regular.impostoMes. Positiva = regular mais barato.
8. **Veredito**, com `diferencaCredito` = regular.creditoClientePJMes − simples.creditoClientePJMes:
   1. `EMPATE` se diferencaMes = 0 ou |diferencaMes| < `EMPATE_PERCENTUAL` / 100 × simples.impostoMes (limite estrito: exatamente 0,5% não é empate).
   2. Regular mais barato (diferencaMes > 0): `DEPENDE_DOS_CLIENTES` se diferencaCredito < 0; senão `REGULAR_TENDE_MELHOR`.
   3. Simples mais barato (diferencaMes < 0): `DEPENDE_DOS_CLIENTES` se diferencaCredito > 0; senão `SIMPLES_TENDE_MELHOR`.
   - Sem vendas a PJ, diferencaCredito = 0 e o custo decide.
9. **`percentualPJ`**: `participacaoPJ` (`web/src/dominio/separar.ts`) aplicada às vendas só com os itens incluídos (Σ receita PJ ÷ Σ receita × 100).
10. **`notas2026Simuladas`**: alguma nota de venda emitida antes de 2027 (ano da emissão < `ANO_SIMULADO`).

`EMPATE_PERCENTUAL` = 0,5 é **parâmetro do projeto** (brief da Task 9), não número legal: abaixo de 0,5% do imposto do Simples a diferença é tratada como empate.

### Itens incluídos

Os dois cenários somam a **mesma receita**. Um item de venda entra em todas as somas (receita, DAS, débitos por fora, créditos PJ) só quando:
- o tipo da nota tem atividade em `atividadePorTipo` **e** essa atividade tem alíquotas em `aliquotasPorAtividade`; e
- o item está `CALCULO_SIMULADO` em `porDentro` **e** em `porFora` (junção por chave da nota + número do item: `chaveItem`, `web/src/motor/tipos.ts`).

Os demais saem de todas as somas e são contados em `itensExcluidos`. Os meses vêm só das notas com item incluído (item 1) e os créditos `REAL` são reduzidos na mesma proporção da receita (item 5).

## Premissas

- **Preço líquido igual** nos dois cenários (spec §10): a receita do item é a mesma; só muda o imposto.
- **Crédito do cliente PJ = CBS/IBS de cada cenário** (dentro: o calculado pelo motor do Simples; fora: o destacado pelo motor do regime regular). Supõe que o cliente PJ está no regime regular e pode se creditar (não é uso ou consumo pessoal, LC 214, art. 57).
- **Créditos `REAL`**: supõem que os débitos das compras foram extintos (condição do art. 47, caput) e que as compras acompanham a receita de forma proporcional (base do rateio do item 5).
- Notas de 2026 simuladas como se fossem de 2027 (spec §10), com as alíquotas de 2027.

## Limitações conhecidas

- **Efeito de preço para consumidor final (B2C) não modelado**: com preço líquido igual, o preço ao consumidor seria o mesmo; não se simula repasse nem perda de venda.
- **Imposto Seletivo excluído**: itens com IS não vão ao motor regular (`RXR-004`, `NAO_IMPLEMENTADO`) e, portanto, ficam fora da comparação (`itensExcluidos`).
- **IBS e CBS somados**: a lei apura e compensa IBS e CBS separadamente (LC 214, art. 45, caput, e art. 47, § 1º, I). Aqui o saldo é calculado sobre a soma; difere só quando um tributo fica com saldo a recuperar e o outro com saldo a recolher no mesmo mês. Em 2027 o efeito é de prazo, não de valor: o saldo a recuperar é ressarcível ou compensável (LC 214, art. 45, § 3º, II).
- **Média simples dos meses**: meses sem venda incluída dentro do intervalo não entram em `n`; o RBT12 e a faixa são os mesmos para todos os meses (os de `aliquotasPorAtividade`).
- **Crédito do cliente é indicativo**: o veredito `DEPENDE_DOS_CLIENTES` só aponta que o crédito transferido ao cliente PJ favorece o outro lado; quanto disso volta como preço depende da negociação.
