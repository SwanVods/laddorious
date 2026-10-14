import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PIECE_SIZES } from '../../apps/client/src/assets/pieceSizes';
import { readGlb } from '../glb';

// The client's table of piece sizes (2026-10-14) must match the built models, or stacks and face-offs overlap.
describe('the piece sizes the game stands pieces by', () => {
  it.each(Object.keys(PIECE_SIZES))('matches the built %s model', (id) => {
    const model = readGlb(new Uint8Array(readFileSync(new URL(`../../apps/client/public/models/${id}.glb`, import.meta.url))));
    const size = PIECE_SIZES[id as keyof typeof PIECE_SIZES];
    expect(size.height).toBeCloseTo(model.max[1] - model.min[1], 2);
    expect(size.front).toBeCloseTo(model.max[2], 2);
    expect(size.back).toBeCloseTo(-model.min[2], 2);
    expect(size.side).toBeCloseTo(Math.max(-model.min[0], model.max[0]), 2);
  });
});
