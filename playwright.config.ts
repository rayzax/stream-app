import { defineConfig, devices } from '@playwright/test';

// Tests run against an already-running instance (local dev server, local
// docker compose, or the deployed Cloud Run URL) — set BASE_URL. We don't
// manage the server lifecycle here since starting it needs real secrets
// pulled from Secret Manager (see scripts/, and the smoke-test pattern used
// in development).
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-390x844',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop-1440',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
});
