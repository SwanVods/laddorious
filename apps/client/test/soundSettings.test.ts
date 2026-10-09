import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND, soundLevels } from '../src/audio/settings';

describe('sound settings (spec #3 §4)', () => {
  it('defaults to sound on, effects at 80% and music at 60%', () => {
    expect(DEFAULT_SOUND).toEqual({ muted: false, effects: 0.8, music: 0.6 });
  });

  it('puts the effects bus at -2 dB and the music bus at -4 dB at full volume, scaled in decibels', () => {
    expect(soundLevels({ muted: false, effects: 1, music: 1 })).toEqual({ effectsDb: -2, musicDb: -4 });
    const half = soundLevels({ muted: false, effects: 0.5, music: 0.5 });
    expect(half.effectsDb).toBeCloseTo(-2 + 20 * Math.log10(0.5), 6);
    expect(half.musicDb).toBeCloseTo(-4 + 20 * Math.log10(0.5), 6);
  });

  it('floors silence at -60 dB under the bus level', () => {
    expect(soundLevels({ muted: false, effects: 0, music: 0 })).toEqual({ effectsDb: -62, musicDb: -64 });
  });
});
