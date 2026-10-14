import { expect, test } from '@playwright/test';

// Screenshots for the user's review after each art step (spec #5 §7). Run with `pnpm shots`; the
// PNGs land in apps/client/test-results/shots/ (not committed).

const OUT = 'test-results/shots';
const PIECES = ['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck'];
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

test('the menu podium with each piece', async ({ page }) => {
  await page.goto('/');
  // The arrows are the only way to choose a piece (2026-10-14): step through all seven from the Knight.
  for (const name of PIECES) {
    await expect(page.getByTestId('piece-name')).toHaveText(name);
    await page.waitForTimeout(1200); // the podium swaps pieces with a little hop
    await page.screenshot({ path: `${OUT}/menu-${slug(name)}.png` });
    await page.getByRole('button', { name: 'Next piece' }).click();
  }
});

test('the menu on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/menu-phone.png` });
});

test('a match: the overview, the jumps and a close-up', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
  // e2e matches race (every seat plays itself, beats at 5%), so shoot soon after the opening.
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/match-overview.png` });
  // The middle of the board from the overview, at 2x: pad trails and slide channels (spec #5 §7).
  await page.screenshot({ path: `${OUT}/match-jumps.png`, clip: { x: 320, y: 140, width: 640, height: 400 } });
  await page.getByRole('button', { name: /^Mochi,/ }).click(); // the camera watches a bot's piece
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/match-closeup.png` });
});
