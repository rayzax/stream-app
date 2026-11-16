import { test, expect, type Page } from '@playwright/test';

const APP_PASSWORD = process.env.APP_PASSWORD;
test.skip(!APP_PASSWORD, 'Set APP_PASSWORD env var to run these tests (never hardcode it).');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Password').fill(APP_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
}

test.describe('Stream app', () => {
  test('logs in and lands on Sports', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Sports — Live now')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/sports.png', fullPage: true });
  });

  test('live sports grouping: shows league sections with live games or an empty state', async ({ page }) => {
    await login(page);
    const leagueHeadings = page.locator('.league-heading');
    await expect(leagueHeadings.first()).toBeVisible();
    const count = await leagueHeadings.count();
    expect(count).toBeGreaterThan(0);
    // Every league section resolves to either game cards or the empty-state line.
    const sections = page.locator('.league-section');
    const sectionCount = await sections.count();
    for (let i = 0; i < sectionCount; i++) {
      const section = sections.nth(i);
      const hasCards = await section.locator('.card').count();
      const hasEmpty = await section.locator('.empty-state').count();
      expect(hasCards + hasEmpty).toBeGreaterThan(0);
    }
  });

  test('TV tab loads channels and plays one', async ({ page }) => {
    await login(page);
    await page.goto('/tv');
    await expect(page.locator('.tile').first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/screenshots/tv.png', fullPage: true });

    await page.locator('.tile').first().click();
    await expect(page).toHaveURL(/\/player\/live\//);
    await page.locator('.play-overlay').click();
    await expect(page.locator('video')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/player-live.png', fullPage: true });
  });

  test('Movies tab loads posters and plays one', async ({ page }) => {
    await login(page);
    await page.goto('/movies');
    await expect(page.locator('.poster').first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'test-results/screenshots/movies.png', fullPage: true });

    await page.locator('.poster').first().click();
    await expect(page).toHaveURL(/\/player\/vod\//);
    await page.locator('.play-overlay').click();
    await expect(page.locator('video')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/player-vod.png', fullPage: true });
  });

  test('global search returns grouped results', async ({ page }) => {
    await login(page);
    await page.goto('/search');
    await page.getByPlaceholder(/search channels/i).fill('news');
    await expect(page.locator('.results-group, .empty-state').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/screenshots/search.png', fullPage: true });
  });

  test('no horizontal scroll at this viewport', async ({ page }) => {
    await login(page);
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalScroll).toBe(false);
  });
});
