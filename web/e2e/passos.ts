import { expect, type Page } from '@playwright/test';
import { ESPERADO, type NotasGeradas } from './gerarNotas';

/** Passo 1: envia o ZIP e confere o que foi lido e o que ficou de fora. */
export async function enviarNotas(page: Page, notas: NotasGeradas) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(notas.zip);
  await expect(page.getByText(`${ESPERADO.notasLidas} notas lidas`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${ESPERADO.ignorados} arquivos ignorados`, { exact: true })).toBeVisible();
}

export async function continuar(page: Page) {
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme a empresa' })).toBeVisible();
}

/** Passo 2: RBT12 de R$ 1.200.000,00 e as atividades 01 (NF-e/NFC-e) e 07 (NFS-e); classificações sugeridas ficam como estão. */
export async function preencherEmpresa(page: Page) {
  await page.getByLabel('Faturamento dos últimos 12 meses').fill('1.200.000,00');
  await page.getByRole('button', { name: /Atividade das NF-e e NFC-e/ }).click();
  await page.getByRole('radio', { name: /^01 / }).click();
  await page.getByRole('button', { name: /Atividade das NFS-e/ }).click();
  await page.getByRole('radio', { name: /^07 / }).click();
  await expect(page.getByRole('heading', { name: 'Classificação IBS/CBS' })).toBeVisible();
}

/** Passo 3: calcula nos motores reais e espera o Resultado. */
export async function calcular(page: Page) {
  const botao = page.getByRole('button', { name: 'Calcular' });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page.getByRole('heading', { name: 'Resultado', level: 1 })).toBeVisible({ timeout: 180_000 });
}
