import { expect, test, type Page } from '@playwright/test';

/** PLAY, then (clock advanced 16 s) Play with bots, until the match screen is up. */
async function startMatch(page: Page) {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  // A fresh browser compiles every shader on the match's first frame: about 15 s under SwiftShader.
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 60_000 });
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

test('keeps a match within 100 draw calls and 156,000 triangles, models included (spec #2 §6.4; 156,000 since 2026-10-15)', async ({ page }) => {
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
  expect(Math.max(...triangles)).toBeLessThanOrEqual(156_000);
});

test('keeps the piece arrows on screen beside the podium on a landscape phone (2026-10-14)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  for (const name of ['Previous piece', 'Next piece']) {
    const arrow = page.getByRole('button', { name });
    await expect(arrow).toBeVisible();
    // The arrows follow the podium on screen once the 3D menu has drawn (shaders compile first).
    await expect
      .poll(async () => {
        const box = await arrow.boundingBox();
        return box !== null && box.x >= 0 && box.x + box.width <= 844;
      }, { timeout: 60_000 })
      .toBe(true);
  }
});

test('asks to turn the phone sideways in portrait (spec #2 §7.3)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Turn your phone sideways');
});
