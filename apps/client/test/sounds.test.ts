import { describe, expect, it } from 'vitest';
import { SOUND_IDS, SOUNDS, TRIM, isSoundId } from '../src/audio/sounds';

describe('the sound recipes (spec #3 §3, §5)', () => {
  it('has a recipe and a level trim for every sound', () => {
    expect(SOUND_IDS).toHaveLength(42);
    for (const id of SOUND_IDS) {
      expect(typeof SOUNDS[id], id).toBe('function');
      expect(typeof TRIM[id], id).toBe('number');
    }
  });

  it('levels every sound to one loudness: measured 2026-10-15, the board was 12 dB apart', () => {
    expect(TRIM).toEqual({
      U1: 11, U2: 8.5, U3: 8.5, U4: 13, Q1: 7.5, Q2: 8.5, Q3: 7,
      D1: 20, D2: 4, D3: 10.5, D4: 15, D5: 17.5, D6: 3, D7: 2.5,
      H1: 9.5, H2: 3.5, H3: 0, S1: -2, L1: -3, K1: -1, B1: 14.5, B2: 9, B3: 15.5,
      F1: -0.5, F2: 8.5, F3: 8.5, F4: 9, F5: 11,
      C1: 13, C2: 12.5, C3: 11, C4: 15, C5: 2, C6: 5, C7: -0.5, C8: 2.5, C9: 2.5, C10: 17,
      W1: 2.5, W2: 12.5, W3: 9, W4: 3.5,
    });
  });

  it('knows its own sound codes', () => {
    expect(isSoundId('S1')).toBe(true);
    expect(isSoundId('none')).toBe(false);
  });
});
