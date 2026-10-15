// Sound settings (spec #3 §4): mute, and effects and music volumes from 0 to 1.

export interface SoundSettings {
  muted: boolean;
  effects: number;
  music: number;
}

export const DEFAULT_SOUND: SoundSettings = { muted: false, effects: 0.8, music: 0.8 };

/** Both buses at full volume. Sounds and songs are levelled to one loudness by their trims (2026-10-15). */
const BASE_DB = -2;

const levelDb = (v: number) => (v <= 0 ? -60 : Math.max(-60, 20 * Math.log10(v)));

/** Bus levels in dB for these settings (mute is applied separately, at the output). */
export function soundLevels(s: SoundSettings): { effectsDb: number; musicDb: number } {
  return { effectsDb: BASE_DB + levelDb(s.effects), musicDb: BASE_DB + levelDb(s.music) };
}
