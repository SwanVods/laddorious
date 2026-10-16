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
  await a.getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect(a.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await b.getByRole('button', { name: 'PLAY', exact: true }).click();
  for (const page of [a, b]) await expect(page.locator('.mm-seat:not(.empty)')).toHaveCount(2);
  await a.getByRole('button', { name: 'Play with bots' }).click({ timeout: 25_000 });
  for (const page of [a, b]) await expect(page.getByRole('button', { name: 'Match menu' })).toBeVisible({ timeout: 20_000 });
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
  // A known flake: the fast bot match can be won while b reloads, and the room then closes.
  // A reliable version needs a match that can't end mid-test (deferred scaffolding), so CI skips it (2026-10-15).
  test.skip(!!process.env.CI, 'flaky until a match can be held open');
  const a = await player(browser);
  const b = await player(browser);
  await startTogether(a, b);
  await b.goto('about:blank'); // the socket closes; the tab keeps its sessionStorage
  await expect(a.locator('.prow-away')).toHaveCount(1);
  await b.goto('/');
  await expect(b.getByRole('button', { name: 'Match menu' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'PLAY', exact: true })).toHaveCount(0);
  await expect(a.locator('.prow-away')).toHaveCount(0);
});

test('friends meet in a private room by its code or its link, and its host starts the match (2026-10-16)', async ({ browser }) => {
  const a = await player(browser);
  await a.getByRole('button', { name: 'Play with friends' }).click();
  await a.getByRole('button', { name: 'Create a room' }).click();
  const room = a.getByRole('dialog', { name: 'YOUR ROOM' });
  await expect(room).toBeVisible();
  const code = (await room.getByLabel('Room code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);
  // B types the code; C opens the room's link.
  const b = await player(browser);
  await b.getByRole('button', { name: 'Play with friends' }).click();
  await b.getByRole('textbox', { name: 'Room code' }).fill(code.toLowerCase());
  await b.getByRole('button', { name: 'Join' }).click();
  const c = await (await browser.newContext()).newPage();
  await c.goto(`/?room=${code}`);
  for (const page of [a, b, c]) await expect(page.locator('.mm-seat:not(.empty)')).toHaveCount(3);
  await expect(b.getByRole('button', { name: 'Start' })).toHaveCount(0);
  await a.getByRole('button', { name: 'Start' }).click();
  for (const page of [a, b, c]) await expect(page.getByRole('button', { name: 'Match menu' })).toBeVisible({ timeout: 20_000 });
});
