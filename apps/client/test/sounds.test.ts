import { describe, expect, it } from 'vitest';
import { SOUND_IDS, SOUNDS, TRIM, isSoundId } from '../src/audio/sounds';
// The approved sound board, read through Vite's raw import like the token test does.
import board from '../../../docs/superpowers/specs/2026-10-09-sound-board.html?raw';

describe('the sound recipes (spec #3 §3, §5)', () => {
  it('has a recipe and a level trim for every sound', () => {
    expect(SOUND_IDS).toHaveLength(42);
    for (const id of SOUND_IDS) {
      expect(typeof SOUNDS[id], id).toBe('function');
      expect(typeof TRIM[id], id).toBe('number');
    }
  });

  it('uses the approved sound board’s codes and level trims', () => {
    const codes = [...board.matchAll(/code: '([A-Z]\d+)'/g)].map((m) => m[1]);
    expect([...SOUND_IDS].sort()).toEqual([...new Set(codes)].sort());
    const trims = Object.fromEntries([...board.slice(board.indexOf('const TRIM = {'), board.indexOf('};', board.indexOf('const TRIM = {'))).matchAll(/([A-Z]\d+): (-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(TRIM).toEqual(trims);
  });

  it('knows its own sound codes', () => {
    expect(isSoundId('S1')).toBe(true);
    expect(isSoundId('none')).toBe(false);
  });
});
