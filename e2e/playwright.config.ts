import { defineConfig, devices } from '@playwright/test';

/**
 * E2E : l'app web exportée (comme en production) parle à la vraie API, avec le moteur IA
 * heuristique (déterministe, sans réseau). Ports dédiés pour ne pas gêner `pnpm dev`.
 */
const API_PORT = 8788;
const WEB_PORT = 8082;
export const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'off',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    {
      name: 'telephone',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
      testIgnore: /bureau/,
    },
    {
      // Même app sur ordinateur : une colonne centrée, pas de vue « PC » distincte.
      name: 'poste-de-soins',
      use: { viewport: { width: 1440, height: 900 } },
      testMatch: /bureau/,
    },
  ],
  webServer: [
    {
      command: 'node --import tsx src/main.ts',
      cwd: '../apps/api',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        API_PORT: String(API_PORT),
        LLM_PROVIDER: 'heuristic',
        CLASSIFIER_PROVIDER: 'heuristic',
        STT_PROVIDER: 'none',
        DATA_DIR: '',
        SIM_BOOT: 'end',
      },
    },
    {
      command: `npx expo export --platform web --output-dir dist-e2e && node ../../e2e/serve-web.mjs dist-e2e ${WEB_PORT}`,
      cwd: '../apps/mobile',
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { EXPO_PUBLIC_API_URL: API_URL },
    },
  ],
});
