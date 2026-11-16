// One-off screenshot script for the UI-upgrade before/after contact sheet.
// Usage: BASE_URL=http://localhost:8099 OUT_DIR=docs/ui-upgrade/after node scripts/ui-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8099';
const OUT_DIR = process.env.OUT_DIR ?? 'docs/ui-upgrade/after';
const USERNAME = process.env.SHOT_USERNAME ?? 'asyvo';
const PASSWORD = process.env.SHOT_PASSWORD;

if (!PASSWORD) {
  console.error('Set SHOT_PASSWORD env var.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function shootScreen(context, viewport, name, path, afterLoad) {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  if (afterLoad) await afterLoad(page).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT_DIR}/${name}-${viewport.name}.png`, fullPage: false });
  await page.close();
}

(async () => {
  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });

    // Login screen (logged out).
    await shootScreen(context, viewport, 'login', '/login');

    // Log in for the rest.
    const loginPage = await context.newPage();
    await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await loginPage.getByPlaceholder('Username').fill(USERNAME);
    await loginPage.getByPlaceholder('Password').fill(PASSWORD);
    await loginPage.getByRole('button', { name: /sign in/i }).click();
    await loginPage.waitForURL(`${BASE_URL}/`, { timeout: 15000 }).catch(() => {});
    await loginPage.close();

    await shootScreen(context, viewport, 'sports', '/');
    await shootScreen(context, viewport, 'tv', '/tv');
    await shootScreen(context, viewport, 'movies', '/movies');
    await shootScreen(context, viewport, 'search', '/search', async (page) => {
      await page.getByPlaceholder(/search channels/i).fill('news');
      await page.waitForTimeout(500);
    });
    await shootScreen(context, viewport, 'admin', '/admin');

    await context.close();
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT_DIR}`);
})();
