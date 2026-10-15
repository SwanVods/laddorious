import { expect, test, type Browser, type Page } from '@playwright/test';

// Two players against the real Worker (spec #4 §10). The server keeps the time, so the 15 s
// bot offer is waited for in real time; FAST=1 makes the match itself take seconds.

/** One player's page in its own browser context (its own storage), on the menu; asset slot warnings go to `warnings`. */
async function player(browser: Browser, warnings: string[] = []): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('asset slot')) warnings.push(m.text());
  });
  await page.goto('/');
  return page;
}

/** Both press PLAY, see each other at the table, and the first fills it with bots. */
async function startTogether(a: Page, b: Page) {
  await a.getByRole('button', { name: 'PLAY' }).click();
  await expect(a.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await b.getByRole('button', { name: 'PLAY' }).click();
  for (const page of [a, b]) await expect(page.locator('.mm-seat:not(.empty)')).toHaveCount(2);
  await a.getByRole('button', { name: 'Play with bots' }).click({ timeout: 25_000 });
  for (const page of [a, b]) await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
}

test('two players find each other, fill the table with bots and play to the end', async ({ browser }) => {
  const warnings: string[] = [];
  const a = await player(browser, warnings);
  const b = await player(browser, warnings);
  await startTogether(a, b);
  for (const page of [a, b]) await expect(page.getByRole('heading', { name: /wins?!$/ })).toBeVisible({ timeout: 150_000 });
  expect(warnings).toEqual([]); // every Blender model loaded, as in the offline match (2026-10-15)
});

test('a player who drops shows as away, and a reload brings them back (spec #4 §5.2)', async ({ browser }) => {
  const a = await player(browser);
  const b = await player(browser);
  await startTogether(a, b);
  await b.goto('about:blank'); // the socket closes; the tab keeps its sessionStorage
  await expect(a.locator('.prow-away')).toHaveCount(1);
  await b.goto('/');
  await expect(b.getByRole('button', { name: 'Leave match' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'PLAY' })).toHaveCount(0);
  await expect(a.locator('.prow-away')).toHaveCount(0);
});
