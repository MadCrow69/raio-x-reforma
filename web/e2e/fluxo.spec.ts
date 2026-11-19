import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ESPERADO, gerarNotas } from './gerarNotas';
import { calcular, continuar, enviarNotas, preencherEmpresa } from './passos';

const VEREDITOS = [
  'O regime regular tende a ser melhor',
  'O Simples tende a ser melhor',
  'Depende dos seus clientes',
  'Os dois cenários ficam muito próximos',
];

test('fluxo completo: enviar, confirmar, calcular nos motores reais e auditar', async ({ page }) => {
  const notas = gerarNotas();
  expect(notas.arquivos).toBe(ESPERADO.arquivos);

  // 1. Enviar
  await enviarNotas(page, notas);
  await continuar(page);

  // 2. Confirmar (sem trocar nenhuma classificação: o NCM incompatível segue com o cClassTrib da nota → REG-011)
  await expect(page.getByLabel('CNPJ da empresa')).toHaveValue(notas.cnpjEmpresa);
  await expect(page.getByText(`${ESPERADO.vendas} notas de venda · ${ESPERADO.compras} notas de compra`)).toBeVisible();
  await preencherEmpresa(page);

  // 3. Resultado (cálculo nos dois motores reais)
  await calcular(page);
  const veredito = page.locator('#resumo-titulo');
  await expect(veredito).toBeVisible();
  expect(VEREDITOS).toContain((await veredito.innerText()).trim());
  if ((await veredito.innerText()).trim() !== VEREDITOS[3]) {
    await expect(page.getByText(/^Diferença estimada: R\$/)).toBeVisible();
  }
  await expect(page.getByText(/compras reais · .*2026/)).toBeVisible();
  await expect(page.getByText('Simulação educativa. Não substitui a orientação do seu contador.')).toBeVisible();

  // 4. Auditoria: REG-011 e CSV
  await page.getByRole('tab', { name: /^Auditoria/ }).click();
  await page.getByLabel('Buscar por nota, descrição, NCM/NBS ou cClassTrib').fill('CARNE BOVINA');
  // a venda com NCM incompatível é recusada pelo motor regular (validação), mesmo com o valor vindo do Simples
  await expect(page.getByRole('row').filter({ hasText: 'Venda' }).filter({ hasText: 'REG-011' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Compra' }).filter({ hasText: 'REG-011' })).toHaveCount(1);
  await page.getByLabel('Buscar por nota, descrição, NCM/NBS ou cClassTrib').fill('');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('raio-x-auditoria.csv');
  const csv = readFileSync(await download.path());
  expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const linhas = csv.toString('utf8').replace(/^\uFEFF/, '').split('\r\n');
  expect(linhas[0]).toContain('Descrição');
  expect(linhas.some((l) => l.includes('Venda') && l.includes('REG-011'))).toBe(true);

  // 5. Memória de cálculo: as duas origens aparecem (vendas: composta pelo app; compras: texto do motor regular)
  await page.getByRole('tab', { name: 'Memória de cálculo' }).click();
  await expect(page.getByText('Composta pelo Raio-X a partir da resposta do motor').first()).toBeVisible();
  await page.getByLabel('Buscar por nota, descrição ou texto da memória').fill('Operação de consumo');
  await expect(page.getByText('Memória do motor oficial').first()).toBeVisible();
});
