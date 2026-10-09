import type { Jump } from '@laddorious/core';
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

  it("keeps portals off the dark colours, which vanish on a portal's dark bowl", () => {
    const styles = pairStyles(busy);
    for (const j of busy.filter((j) => j.to < j.from)) expect(PAIR_COLORS.portal).toContain(styles.get(j.id)!.colour);
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
