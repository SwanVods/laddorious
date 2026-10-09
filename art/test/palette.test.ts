import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const palette = readFileSync(new URL('../lib/palette.py', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../../apps/client/src/app/theme.ts', import.meta.url), 'utf8').toLowerCase();

describe('the model palette (spec #5 §3.1)', () => {
  it('uses only Tangerine Dusk colours from theme.ts', () => {
    const colours = [...palette.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]!.toLowerCase());
    expect(colours.length).toBeGreaterThan(4);
    expect(colours.filter((c) => !theme.includes(c))).toEqual([]);
  });
});
