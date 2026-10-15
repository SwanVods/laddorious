import type { Jump } from '@laddorious/core';
import { Color, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';
import { PAIR_COLORS } from '../src/app/theme';
import { SYMBOLS, pairStyles } from '../src/scene/pairs';

// A busy board: 14 ladders and 12 slides (portals), named as the board generator names them.
const busy: Jump[] = Array.from({ length: 26 }, (_, i) => (i < 14 ? { id: `j${i + 1}`, from: 2 + i * 6, to: 9 + i * 6 } : { id: `j${i + 1}`, from: 95 - (i - 14) * 7, to: 88 - (i - 14) * 7 }));
const key = (s: { colour: string; symbol: string }) => `${s.colour} ${s.symbol}`;

describe('pair styles: a jump and its end share a colour and a symbol (spec #5 A13)', () => {
  it('gives every jump on a busy board its own colour and symbol', () => {
    const styles = pairStyles(busy);
    expect(styles.size).toBe(26);
    expect(new Set([...styles.values()].map(key)).size).toBe(26);
    for (const s of styles.values()) {
      expect(Object.values(PAIR_COLORS.all)).toContain(s.colour);
      expect(SYMBOLS).toContain(s.symbol);
    }
  });

  it('uses only light palette colours, nothing near black (the user, Step 2 review 4)', () => {
    const hsl = { h: 0, s: 0, l: 0 };
    for (const colour of Object.values(PAIR_COLORS.all)) expect(new Color(colour).getHSL(hsl, SRGBColorSpace).l, colour).toBeGreaterThan(0.55);
  });

  it('keeps every style when a card adds a jump, and ignores the order the jumps come in', () => {
    const before = pairStyles(busy);
    const after = pairStyles([{ id: 'x1', from: 40, to: 61 }, ...[...busy].reverse()]);
    for (const j of busy) expect(after.get(j.id)).toEqual(before.get(j.id));
    expect(after.get('x1')).toBeDefined();
    expect(new Set([...after.values()].map(key)).size).toBe(27);
  });

  it('still styles every jump when a board has more jumps than combinations', () => {
    const crowded: Jump[] = Array.from({ length: 60 }, (_, i) => ({ id: `j${i + 1}`, from: 50, to: i % 2 ? 10 : 90 }));
    expect(pairStyles(crowded).size).toBe(60);
  });
});

describe('styles that stay put (2026-10-15)', () => {
  it("keeps every other jump's style when a card removes one, even one that had collided with it", () => {
    // Enough jumps that some collide in the search, so removing one could shift another.
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `j${i + 1}`, from: 10 + i * 2, to: i % 2 ? 5 + i : 60 + i }));
    const full = pairStyles(many);
    let shifted = 0;
    for (const gone of many) {
      const rest = many.filter((j) => j !== gone);
      const fresh = pairStyles(rest);
      if (rest.some((j) => fresh.get(j.id)!.colour !== full.get(j.id)!.colour || fresh.get(j.id)!.symbol !== full.get(j.id)!.symbol)) shifted += 1;
      const kept = pairStyles(rest, full);
      for (const j of rest) expect(kept.get(j.id), j.id).toEqual(full.get(j.id));
    }
    expect(shifted).toBeGreaterThan(0); // the case the old assignment got wrong does happen
  });
});

