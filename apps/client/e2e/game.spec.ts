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
  await startMatch(page);
  await expect(page.getByRole('heading', { name: /wins?!$/ })).toBeVisible({ timeout: 150_000 });
  // Sound ran through the whole match without a single error (spec #3 §7).
  const sound = await page.evaluate(() => window.__laddoriousTest!.soundStats());
  expect(sound.started).toBe(true);
  expect(sound.played).toBeGreaterThan(0);
  expect(sound.errors).toBe(0);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
});

test('keeps a match within 100 draw calls (spec #2 §6.4)', async ({ page }) => {
  await startMatch(page);
  const calls: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    calls.push(await page.evaluate(() => window.__laddoriousTest?.drawCalls() ?? -1));
  }
  expect(Math.max(...calls)).toBeGreaterThan(0);
  expect(Math.max(...calls)).toBeLessThanOrEqual(100);
});

test('asks to turn the phone sideways in portrait (spec #2 §7.3)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Turn your phone sideways');
});
