import { describe, expect, it } from 'vitest';
import { cleanNickname, createPrefsStore, defaultNickname, type KeyValueStore } from '../src/app/prefs';
import { DEFAULT_SOUND } from '../src/audio/settings';

/** An in-memory Storage stand-in. */
function memory(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

/** A storage that throws on every access, as blocked localStorage does. */
const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

const env = { prefersReducedMotion: false, random: () => 0.4821 };

describe('nickname rules (spec #2 C9)', () => {
  it('trims and accepts 1–16 characters', () => {
    expect(cleanNickname('  Arief  ')).toBe('Arief');
    expect(cleanNickname('x'.repeat(16))).toBe('x'.repeat(16));
    expect(cleanNickname('x'.repeat(17))).toBeNull();
    expect(cleanNickname('   ')).toBeNull();
  });

  it('defaults to Guest and four digits', () => {
    expect(defaultNickname(() => 0)).toBe('Guest1000');
    expect(defaultNickname(() => 0.99999)).toBe('Guest9999');
    expect(defaultNickname()).toMatch(/^Guest\d{4}$/);
  });
});

describe('the prefs store', () => {
  it('starts with a Guest profile, the knight, Auto quality and the system motion setting, and saves the new profile', () => {
    const storage = memory();
    const prefs = createPrefsStore(storage, { prefersReducedMotion: true, random: () => 0.4821 });
    expect(prefs.getState().profile).toEqual({ nickname: 'Guest5338', piece: 'knight' });
    expect(prefs.getState().settings).toEqual({ quality: 'auto', reducedMotion: true, sound: DEFAULT_SOUND });
    expect(JSON.parse(storage.data['laddorious.profile']!)).toEqual({ nickname: 'Guest5338', piece: 'knight' });
  });

  it('saves renames, piece and settings, and loads them back', () => {
    const storage = memory();
    const prefs = createPrefsStore(storage, env);
    expect(prefs.getState().rename('  Pip Fan ')).toBe(true);
    prefs.getState().setPiece('dragon');
    prefs.getState().setQuality('low');
    prefs.getState().setReducedMotion(true);
    prefs.getState().setMuted(true);
    prefs.getState().setEffectsVolume(0.5);
    prefs.getState().setMusicVolume(0.25);
    const again = createPrefsStore(storage, env).getState();
    expect(again.profile).toEqual({ nickname: 'Pip Fan', piece: 'dragon' });
    expect(again.settings).toEqual({ quality: 'low', reducedMotion: true, sound: { muted: true, effects: 0.5, music: 0.25 } });
  });

  it('refuses a bad rename and keeps the old name', () => {
    const prefs = createPrefsStore(memory(), env);
    const before = prefs.getState().profile.nickname;
    expect(prefs.getState().rename('')).toBe(false);
    expect(prefs.getState().rename('a much too long nickname')).toBe(false);
    expect(prefs.getState().profile.nickname).toBe(before);
  });

  it('ignores corrupted or invalid saved values', () => {
    const storage = memory({ 'laddorious.profile': '{"nickname":"","piece":"wizard"}', 'laddorious.settings': 'not json' });
    const prefs = createPrefsStore(storage, env).getState();
    expect(prefs.profile).toEqual({ nickname: 'Guest5338', piece: 'knight' });
    expect(prefs.settings).toEqual({ quality: 'auto', reducedMotion: false, sound: DEFAULT_SOUND });
  });

  it('clamps volumes and falls back to the defaults for bad saved sound settings (spec #3 §4)', () => {
    const storage = memory({ 'laddorious.settings': JSON.stringify({ quality: 'high', sound: { muted: 'yes', effects: 3, music: 'loud' } }) });
    const prefs = createPrefsStore(storage, env);
    expect(prefs.getState().settings.sound).toEqual(DEFAULT_SOUND);
    prefs.getState().setEffectsVolume(1.7);
    prefs.getState().setMusicVolume(-0.2);
    expect(prefs.getState().settings.sound).toEqual({ muted: false, effects: 1, music: 0 });
  });

  it('works for the session when storage is blocked (spec #2 §8)', () => {
    const prefs = createPrefsStore(blocked, env);
    expect(prefs.getState().rename('Offline')).toBe(true);
    prefs.getState().setQuality('high');
    expect(prefs.getState().profile.nickname).toBe('Offline');
    expect(prefs.getState().settings.quality).toBe('high');
    expect(createPrefsStore(null, env).getState().profile.nickname).toBe('Guest5338');
  });
});
