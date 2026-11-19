import { defineConfig, devices } from '@playwright/test';

/** Ponta a ponta contra a pilha real (`docker compose up --build` na raiz do repositório). Não roda no `npm test`. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: './e2e/.resultados',
  use: {
    baseURL: process.env.RAIOX_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
