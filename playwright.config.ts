import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3777);
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'qa/e2e-results.json' }]],
  use: {
    locale: 'pt-BR',
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'off',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: `npx next start -p ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
