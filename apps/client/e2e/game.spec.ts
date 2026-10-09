import { expect, test, type Page } from '@playwright/test';

/** PLAY, then (clock advanced 16 s) Play with bots, until the match screen is up. */
async function startMatch(page: Page) {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
}

test('plays a whole match against the bots, then Play again goes back to matchmaking (spec #2 §9.3)', async ({ page }) => {
  const slotWarnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('asset slot')) slotWarnings.push(m.text());
  });
  await startMatch(page);
  await expect(page.getByRole('heading', { name: /wins?!$/ })).toBeVisible({ timeout: 150_000 });
  // Sound ran through the whole match without a single error (spec #3 §7).
  const sound = await page.evaluate(() => window.__laddoriousTest!.soundStats());
  expect(sound.started).toBe(true);
  expect(sound.played).toBeGreaterThan(0);
  expect(sound.errors).toBe(0);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  expect(slotWarnings).toEqual([]); // every Blender model loaded (spec #5 §6)
});

test('keeps a match within 100 draw calls and 150,000 triangles, models included (spec #2 §6.4)', async ({ page }) => {
  await startMatch(page);
  const calls: number[] = [];
  const triangles: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    calls.push(await page.evaluate(() => window.__laddoriousTest?.drawCalls() ?? -1));
    triangles.push(await page.evaluate(() => window.__laddoriousTest?.triangles() ?? -1));
  }
  expect(Math.max(...calls)).toBeGreaterThan(0);
  expect(Math.max(...calls)).toBeLessThanOrEqual(100);
  expect(Math.max(...triangles)).toBeGreaterThan(0);
  expect(Math.max(...triangles)).toBeLessThanOrEqual(150_000);
});

test('fits the seven-piece picker beside PLAY on a landscape phone (spec #5 §4.1)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const picker = await page.getByRole('group', { name: 'Choose your piece' }).boundingBox();
  const play = await page.getByRole('button', { name: 'PLAY' }).boundingBox();
  expect(picker).not.toBeNull();
  expect(play).not.toBeNull();
  expect(picker!.x).toBeGreaterThanOrEqual(0);
  expect(picker!.x + picker!.width).toBeLessThanOrEqual(play!.x);
});

test('asks to turn the phone sideways in portrait (spec #2 §7.3)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Turn your phone sideways');
});
