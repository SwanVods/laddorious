import { expect, test } from '@playwright/test';

// Screenshots for the user's review after each art step (spec #5 §7). Run with `pnpm shots`; the
// PNGs land in apps/client/test-results/shots/ (not committed).

const OUT = 'test-results/shots';
const PIECES = ['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck'];
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

test('the menu podium with each piece', async ({ page }) => {
  await page.goto('/');
  for (const name of PIECES) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(1200); // the podium swaps pieces with a little hop
    await page.screenshot({ path: `${OUT}/menu-${slug(name)}.png` });
  }
});

test('the menu on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/menu-phone.png` });
});

test('a match: the overview and a close-up', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/match-overview.png` });
  await page.getByRole('button', { name: /^Mochi,/ }).click(); // the camera watches a bot's piece
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/match-closeup.png` });
});
