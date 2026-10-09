import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_SOUND, type SoundSettings } from '../audio/settings';
import type { QualitySetting } from '../scene/quality';
import { PIECES, type PieceId, type Profile } from '../service/matchService';

// The guest profile and the settings, kept on this device (spec #2 C9, §7.1, §8).

export const NICKNAME_MAX = 16;
const QUALITIES: readonly QualitySetting[] = ['auto', 'low', 'high'];
const KEYS = { profile: 'laddorious.profile', settings: 'laddorious.settings' } as const;

export interface Settings {
  quality: QualitySetting;
  reducedMotion: boolean;
  sound: SoundSettings;
}

export interface PrefsState {
  profile: Profile;
  settings: Settings;
  /** Rename: trimmed, 1–16 characters. Returns false and keeps the old name otherwise. */
  rename(raw: string): boolean;
  setPiece(piece: PieceId): void;
  setQuality(quality: QualitySetting): void;
  setReducedMotion(on: boolean): void;
  setMuted(muted: boolean): void;
  setEffectsVolume(volume: number): void;
  setMusicVolume(volume: number): void;
}

/** The part of Storage the store uses. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A nickname as typed, trimmed; null if it is empty or longer than 16 characters. */
export function cleanNickname(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && [...name].length <= NICKNAME_MAX ? name : null;
}

/** "Guest" and four digits, e.g. Guest4821. */
export function defaultNickname(random: () => number = Math.random): string {
  return `Guest${1000 + Math.floor(random() * 9000)}`;
}

/** localStorage, or null where it is blocked (private modes, embedded frames, file://). */
export function browserStorage(): KeyValueStore | null {
  try {
    const storage = window.localStorage;
    const probe = 'laddorious.probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function read(storage: KeyValueStore | null, key: string): unknown {
  try {
    const text = storage?.getItem(key);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

function write(storage: KeyValueStore | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: keep the value in memory for this session (§8).
  }
}

function loadProfile(stored: unknown, random: () => number): Profile {
  const saved = (stored ?? {}) as Partial<Profile>;
  const nickname = typeof saved.nickname === 'string' ? cleanNickname(saved.nickname) : null;
  const piece = PIECES.includes(saved.piece as PieceId) ? (saved.piece as PieceId) : 'knight';
  return { nickname: nickname ?? defaultNickname(random), piece };
}

const unit = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fallback);
const clampUnit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

function loadSound(stored: unknown): SoundSettings {
  const saved = (stored ?? {}) as Partial<SoundSettings>;
  return {
    muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULT_SOUND.muted,
    effects: unit(saved.effects, DEFAULT_SOUND.effects),
    music: unit(saved.music, DEFAULT_SOUND.music),
  };
}

function loadSettings(stored: unknown, prefersReducedMotion: boolean): Settings {
  const saved = (stored ?? {}) as Partial<Settings>;
  return {
    quality: QUALITIES.includes(saved.quality as QualitySetting) ? (saved.quality as QualitySetting) : 'auto',
    reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : prefersReducedMotion,
    sound: loadSound(saved.sound),
  };
}

/**
 * The profile and settings store. With `storage` null (blocked), everything still works and
 * lasts for the session. A brand-new profile is saved at once, so the Guest number sticks.
 */
export function createPrefsStore(
  storage: KeyValueStore | null,
  env: { prefersReducedMotion: boolean; random?: () => number } = { prefersReducedMotion: false },
): StoreApi<PrefsState> {
  const storedProfile = read(storage, KEYS.profile);
  const profile = loadProfile(storedProfile, env.random ?? Math.random);
  if (!storedProfile) write(storage, KEYS.profile, profile);
  const settings = loadSettings(read(storage, KEYS.settings), env.prefersReducedMotion);

  return createStore<PrefsState>()((set, get) => {
    const saveProfile = (next: Profile) => {
      set({ profile: next });
      write(storage, KEYS.profile, next);
    };
    const saveSettings = (next: Settings) => {
      set({ settings: next });
      write(storage, KEYS.settings, next);
    };
    return {
      profile,
      settings,
      rename(raw) {
        const nickname = cleanNickname(raw);
        if (nickname === null) return false;
        saveProfile({ ...get().profile, nickname });
        return true;
      },
      setPiece(piece) {
        saveProfile({ ...get().profile, piece });
      },
      setQuality(quality) {
        saveSettings({ ...get().settings, quality });
      },
      setReducedMotion(reducedMotion) {
        saveSettings({ ...get().settings, reducedMotion });
      },
      setMuted(muted) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, muted } });
      },
      setEffectsVolume(volume) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, effects: clampUnit(volume) } });
      },
      setMusicVolume(volume) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, music: clampUnit(volume) } });
      },
    };
  });
}
