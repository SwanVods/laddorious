import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND, soundLevels } from '../src/audio/settings';

describe('sound settings (spec #3 §4)', () => {
  it('defaults to sound on, effects and music both at 80% (one level, 2026-10-15)', () => {
    expect(DEFAULT_SOUND).toEqual({ muted: false, effects: 0.8, music: 0.8 });
  });

  it('puts both buses at -2 dB at full volume, scaled in decibels: sounds and songs are levelled alike (2026-10-15)', () => {
    expect(soundLevels({ muted: false, effects: 1, music: 1 })).toEqual({ effectsDb: -2, musicDb: -2 });
    const half = soundLevels({ muted: false, effects: 0.5, music: 0.5 });
    expect(half.effectsDb).toBeCloseTo(-2 + 20 * Math.log10(0.5), 6);
    expect(half.musicDb).toBeCloseTo(-2 + 20 * Math.log10(0.5), 6);
  });

  it('floors silence at -60 dB under the bus level', () => {
    expect(soundLevels({ muted: false, effects: 0, music: 0 })).toEqual({ effectsDb: -62, musicDb: -62 });
  });
});
