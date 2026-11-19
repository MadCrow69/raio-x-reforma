/**
 * Medição de layout das telas com o fluxo real (~200 notas) nos 7 tamanhos do padrão de interface.
 * Só roda com LAYOUT_AUDIT_JS apontando para o layout-audit.js do protocolo ux-ui-defensive:
 *   LAYOUT_AUDIT_JS=~/.claude/skills/ux-ui-defensive/scripts/layout-audit.js npm run test:e2e -- medirLayout
 * Escreve o resultado em e2e/.resultados/medicao-layout.json.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gerarNotas } from './gerarNotas';
import { calcular, continuar, enviarNotas, preencherEmpresa } from './passos';

const SCRIPT = process.env.LAYOUT_AUDIT_JS;
const TAMANHOS = [
  { w: 1920, h: 1080 }, { w: 1366, h: 768 }, { w: 1366, h: 657 }, { w: 1024, h: 657 },
  { w: 768, h: 1024 }, { w: 390, h: 844 }, { w: 360, h: 800 },
];

interface Falha { regra: string; alvo: string; detalhe: string }
interface Medicao { tamanho: string; tela: string; ok: boolean; falhas: Falha[]; info?: unknown }

async function medir(page: Page, tamanho: string, tela: string, saida: Medicao[]) {
  await page.waitForTimeout(400); // fim de transições
  const r = await page.evaluate(() => (globalThis as unknown as { layoutAudit: () => { ok: boolean; falhas: Falha[]; info?: unknown } }).layoutAudit());
  saida.push({ tamanho, tela, ok: r.ok, falhas: r.falhas, info: r.info });
}

test.skip(!SCRIPT, 'defina LAYOUT_AUDIT_JS para medir o layout');

test('layout das telas nos 7 tamanhos', async ({ page }) => {
  test.setTimeout(900_000);
  const notas = gerarNotas();
  const medicoes: Medicao[] = [];
  for (const { w, h } of TAMANHOS) {
    const tamanho = `${w}×${h}`;
    await page.setViewportSize({ width: w, height: h });
    await enviarNotas(page, notas);
    await page.addScriptTag({ path: SCRIPT });
    await medir(page, tamanho, 'Enviar', medicoes);

    await continuar(page);
    await preencherEmpresa(page);
    await medir(page, tamanho, 'Confirmar', medicoes);

    await calcular(page);
    await medir(page, tamanho, 'Resultado · Resumo', medicoes);

    await page.getByRole('tab', { name: /^Auditoria/ }).click();
    await expect(page.getByRole('heading', { name: 'Auditoria', level: 2 })).toBeVisible();
    await medir(page, tamanho, 'Resultado · Auditoria', medicoes);

    await page.getByRole('tab', { name: 'Memória de cálculo' }).click();
    await expect(page.getByRole('heading', { name: 'Memória de cálculo', level: 2 })).toBeVisible();
    await medir(page, tamanho, 'Resultado · Memória', medicoes);
  }
  mkdirSync('e2e/.resultados', { recursive: true });
  writeFileSync('e2e/.resultados/medicao-layout.json', JSON.stringify(medicoes, null, 2));
  const falhas = medicoes.filter((m) => !m.ok);
  expect(falhas, JSON.stringify(falhas, null, 1)).toEqual([]);
});
