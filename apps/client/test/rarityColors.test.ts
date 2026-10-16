import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOARD_COLORS } from '../src/app/theme';

// Rare and epic swap colours (the user, 2026-10-17): rare is gold, epic is cyan into purple, and an epic
// "?" on the board is a gradient like its card's frame.

// Read from disk: Vitest hands CSS imports back empty, even raw.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const THEME_CSS = read('../src/app/theme.css');
const POPUPS_CSS = read('../src/hud/popups.css');

const token = (name: string) => THEME_CSS.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
const frame = (rarity: string) => {
  const rule = POPUPS_CSS.match(new RegExp(`\\.pick-card\\.${rarity} \\{([^}]*)\\}`))?.[1] ?? '';
  return [rule.match(/--frame-a:\s*([^;]+);/)?.[1], rule.match(/--frame-b:\s*([^;]+);/)?.[1]];
};

describe('rarity colours (2026-10-17)', () => {
  it('makes rare gold and epic cyan, on the board and in the HUD alike', () => {
    expect(token('rarity-rare')).toBe('#ffcc33');
    expect(token('rarity-epic')).toBe('#6ff3ff');
    expect(BOARD_COLORS.rarity).toEqual({ common: '#ffffff', rare: '#ffcc33', epic: '#6ff3ff' });
  });

  it("swaps the cards' frames too: rare gold into orange, epic cyan into purple", () => {
    expect(frame('rare')).toEqual(['var(--rarity-rare)', 'var(--primary)']);
    expect(frame('epic')).toEqual(['var(--rarity-epic)', 'var(--mystery)']);
  });

  it('paints an epic "?" on the board as a gradient from the epic colour', () => {
    expect(BOARD_COLORS.epicGlyph).toHaveLength(2);
    expect(BOARD_COLORS.epicGlyph[0]).toBe(BOARD_COLORS.rarity.epic);
  });
});
