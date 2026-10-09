# Sound Design Implementation Plan

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game moment and both music loops from the approved sound board, made in code with Tone.js, wired into the client with mute and volume settings.

**Architecture:** A new `apps/client/src/audio/` folder:
- **Pure parts:** settings levels, the recipes, the song data and the cue mapping.
- **`AudioEngine`:** loads Tone after the first tap, behind an injectable loader.
- **React wiring:** a context provider, plus a match hook that turns director beats into cues.

Screens add their own moments (popups, picker, matchmaking, end screen) through `useSound()`.

**Tech Stack:** TypeScript, React 19, Tone.js 15.1.22, Zustand, Vitest 5 (jsdom for components), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-sound-design.md`, with the approved recipes in `docs/superpowers/specs/2026-10-09-sound-board.html`.

## Global Constraints

- Tone.js is pinned to exactly `15.1.22`. It is only ever loaded with `import('tone')` from `main.tsx`'s loader, so it gets a chunk of its own. No other file imports Tone at run time; `sounds.ts`, `music.ts` and `engine.ts` use `import type` and receive the namespace as a value.
- Before the first tap, while muted, or after a failed load, sound calls do nothing and never throw.
- Your own moments play at full level; other players' go through the bus 7 dB lower (spec A6). Level trims come from the board's `TRIM` table (A8). There's a −1 dB limiter on the output.
- Every colour is a token in `app/theme.css` or `theme.ts` (`test/tokens.test.ts`). Touch targets stay at least 44 px.
- Commit at the end of every task with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer. Read test counts with `grep -E "Test Files|Tests "`.

## Review Focus

1. **Muted at the first tap, unmuted later.** Expected: unmuting loads Tone then, and sound plays. Pinned in Task 4.
2. **Tone fails to load** (a broken chunk, a blocked network). Expected: the game runs on silently, and nothing throws. Pinned in Task 4.
3. **Compressed or skipped timelines** (e2e's 5% speed, fast-forwarded updates). Expected: no errors and no stuck music. Pinned in Task 9 (e2e `soundStats().errors === 0`) and Task 5 (cues come only from beats that actually play).
4. **Page hidden mid-match.** Expected: the audio suspends and resumes on return. Pinned in Tasks 4 and 6.
5. **Corrupt stored sound settings** (NaN, out of range, wrong types). Expected: defaults, and volumes clamped to 0–1. Pinned in Task 1.

---

### Task 1: Tone dependency and sound settings

**Files:**
- Create: `apps/client/src/audio/settings.ts`, `apps/client/test/soundSettings.test.ts`
- Modify: `apps/client/package.json` (`tone` 15.1.22), `apps/client/src/app/prefs.ts`, `apps/client/test/prefs.test.ts`

**Interfaces (produces):** `SoundSettings`, `DEFAULT_SOUND`, `soundLevels(s): { effectsDb: number; musicDb: number }`; `Settings.sound`; `PrefsState.setMuted(muted)`, `setEffectsVolume(v)`, `setMusicVolume(v)`.

- [ ] **Step 1: Add Tone.** Run `pnpm --filter @laddorious/client add tone@15.1.22`. Expected: `apps/client/package.json` lists `"tone": "15.1.22"` (pin it exact if pnpm wrote a range).

- [ ] **Step 2: Write the failing tests.** Create `apps/client/test/soundSettings.test.ts`:

```ts
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
```

In `apps/client/test/prefs.test.ts`:
- Add `DEFAULT_SOUND` to the imports: `import { DEFAULT_SOUND } from '../src/audio/settings';`.
- Change the three `settings` expectations to include `sound: DEFAULT_SOUND`: `{ quality: 'auto', reducedMotion: true, sound: DEFAULT_SOUND }`, `{ quality: 'low', reducedMotion: true, sound: … }` (see below), and `{ quality: 'auto', reducedMotion: false, sound: DEFAULT_SOUND }`.
- In "saves renames, piece and settings", call `prefs.getState().setMuted(true); prefs.getState().setEffectsVolume(0.5); prefs.getState().setMusicVolume(0.25);` and expect `again.settings` to equal `{ quality: 'low', reducedMotion: true, sound: { muted: true, effects: 0.5, music: 0.25 } }`.
- Add:

```ts
  it('clamps volumes and falls back to the defaults for bad saved sound settings (spec #3 §4)', () => {
    const storage = memory({ 'laddorious.settings': JSON.stringify({ quality: 'high', sound: { muted: 'yes', effects: 3, music: Number.NaN } }) });
    const prefs = createPrefsStore(storage, env);
    expect(prefs.getState().settings.sound).toEqual(DEFAULT_SOUND);
    prefs.getState().setEffectsVolume(1.7);
    prefs.getState().setMusicVolume(-0.2);
    expect(prefs.getState().settings.sound).toEqual({ muted: false, effects: 1, music: 0 });
  });
```

- [ ] **Step 3: Run them.** `pnpm vitest run apps/client/test/soundSettings.test.ts apps/client/test/prefs.test.ts`. Expected: FAIL, because `../src/audio/settings` is missing.

- [ ] **Step 4: Implement.** Create `apps/client/src/audio/settings.ts`:

```ts
// Sound settings (spec #3 §4): mute, and effects and music volumes from 0 to 1.

export interface SoundSettings {
  muted: boolean;
  effects: number;
  music: number;
}

export const DEFAULT_SOUND: SoundSettings = { muted: false, effects: 0.8, music: 0.6 };

/** The bus levels at full volume: the sound board's tuned defaults. */
const EFFECTS_BASE_DB = -2;
const MUSIC_BASE_DB = -4;

const levelDb = (v: number) => (v <= 0 ? -60 : Math.max(-60, 20 * Math.log10(v)));

/** Bus levels in dB for these settings (mute is applied separately, at the output). */
export function soundLevels(s: SoundSettings): { effectsDb: number; musicDb: number } {
  return { effectsDb: EFFECTS_BASE_DB + levelDb(s.effects), musicDb: MUSIC_BASE_DB + levelDb(s.music) };
}
```

In `apps/client/src/app/prefs.ts`:
- import `{ DEFAULT_SOUND, type SoundSettings } from '../audio/settings'`;
- add `sound: SoundSettings;` to `Settings`;
- add the three setters to `PrefsState`:

```ts
  setMuted(muted: boolean): void;
  setEffectsVolume(volume: number): void;
  setMusicVolume(volume: number): void;
```

Add these helpers above `loadSettings`:

```ts
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
```

`loadSettings` returns `sound: loadSound((saved as { sound?: unknown }).sound)` beside the other two. The store gains:

```ts
      setMuted(muted) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, muted } });
      },
      setEffectsVolume(volume) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, effects: clampUnit(volume) } });
      },
      setMusicVolume(volume) {
        saveSettings({ ...get().settings, sound: { ...get().settings.sound, music: clampUnit(volume) } });
      },
```

- [ ] **Step 5: Run them again.** Same command. Expected: PASS. Then `pnpm typecheck` (other tests that build `Settings` literals may need `sound: DEFAULT_SOUND`; add it where the compiler says) and `pnpm test`. Expected: all green.

- [ ] **Step 6: Commit.** `git add apps/client pnpm-lock.yaml && git commit -m "feat(client): add Tone.js and the sound settings"` (with the trailer).

### Task 2: The sound recipes

**Files:**
- Create: `apps/client/src/audio/sounds.ts`, `apps/client/test/sounds.test.ts`

**Interfaces (produces):**
- `ToneLib` (the Tone namespace type);
- `SOUND_IDS`, `SoundId`, `isSoundId(s)`;
- `Play = { tone: ToneLib; out: ToneAudioNode; at: number }`;
- `Recipe = (p: Play, t: number, arg?: number) => number` (seconds);
- `SOUNDS: Record<SoundId, Recipe>`, `TRIM: Record<SoundId, number>`.

The recipes are the board's, with four changed to play one step, since the game times the steps:
- **H1** is one hop knock (`arg` = step index);
- **B1** is one step-back knock (`arg` = step index);
- **D4** is one tick;
- **W3** is one pop (`arg` = rank 2, 3 or 4).

**Q1** (`arg` seat 0–2), **U2** (`arg` piece 0–3), **U3** (`arg` 1 on, 0 off) and **C4** (`arg` card count) take their variant as an argument instead of cycling.

- [ ] **Step 1: Write the failing test.** Create `apps/client/test/sounds.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUND_IDS, SOUNDS, TRIM, isSoundId } from '../src/audio/sounds';

const board = readFileSync(new URL('../../../docs/superpowers/specs/2026-10-09-sound-board.html', import.meta.url), 'utf8');

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
```

- [ ] **Step 2: Run it.** `pnpm vitest run apps/client/test/sounds.test.ts`. Expected: FAIL, because `../src/audio/sounds` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/sounds.ts`:

```ts
import type * as Tone from 'tone';

// The game's sounds (spec #3 §5), ported from the approved sound board
// (docs/superpowers/specs/2026-10-09-sound-board.html). Each recipe schedules its notes from
// time t and returns how long it lasts. Tone is passed in: it loads only after the first tap.

/** The Tone.js namespace. */
export type ToneLib = typeof Tone;

export const SOUND_IDS = [
  'U1', 'U2', 'U3', 'U4', 'Q1', 'Q2', 'Q3',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
  'H1', 'H2', 'H3', 'S1', 'L1', 'K1', 'B1', 'B2', 'B3',
  'F1', 'F2', 'F3', 'F4', 'F5',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10',
  'W1', 'W2', 'W3', 'W4',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export const isSoundId = (s: string): s is SoundId => (SOUND_IDS as readonly string[]).includes(s);

/** One play: Tone, where its notes go (its trim), and when the sound starts. */
export interface Play {
  tone: ToneLib;
  out: Tone.ToneAudioNode;
  at: number;
}

export type Recipe = (p: Play, t: number, arg?: number) => number;

/** Level trims (dB) measured on the board: big moments about -20 dBFS, core feedback -24, prompts -26, buttons and others -28 to -30. */
export const TRIM: Record<SoundId, number> = {
  U1: 8, U2: 5, U3: 6, U4: 9.5, Q1: 4, Q2: 9.5, Q3: 3.5,
  D1: 20, D2: 4, D3: 5, D4: 11, D5: 18, D6: 3.5, D7: 3,
  H1: 4, H2: 4, H3: 0.5, S1: 4, L1: 2, K1: 4, B1: 10, B2: 13, B3: 15,
  F1: 4, F2: 6, F3: 9, F4: 10, F5: 7,
  C1: 12, C2: 12, C3: 10.5, C4: 14, C5: 5, C6: 6, C7: 4.5, C8: 1.5, C9: 1.5, C10: 18.5,
  W1: 9, W2: 12.5, W3: 9, W4: 4,
};

// ------------------------------------------------------------------ instruments
// Every sound builds its own short-lived instruments: Tone refuses a note that starts before one it
// already scheduled, so instruments shared across sounds scheduled ahead would throw (spec A7).

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const jitter = (cents: number) => 2 ** (rnd(-cents, cents) / 1200);

/** Dispose a few seconds after this play's own start time. */
function later(p: Play, node: { dispose(): unknown }, lifeS: number): void {
  const lead = Math.max(0, p.at - p.tone.now());
  setTimeout(() => node.dispose(), (lead + lifeS + 4) * 1000);
}

function make<T extends Tone.ToneAudioNode>(p: Play, node: T, lifeS: number): T {
  node.connect(p.out);
  later(p, node, lifeS);
  return node;
}

const hz = (p: Play, note: string) => p.tone.Frequency(note).toFrequency();

function wood(p: Play, life: number) {
  return make(p, new p.tone.MembraneSynth({ pitchDecay: 0.006, octaves: 1.6, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.02 }, volume: -6 }), life);
}

function clicker(p: Play, life: number) {
  const f = make(p, new p.tone.Filter(3200, 'highpass'), life);
  const n = new p.tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.01 }, volume: -18 }).connect(f);
  later(p, n, life);
  return n;
}

function marimba(p: Play, life: number, volume = -9) {
  return make(
    p,
    new p.tone.PolySynth(p.tone.FMSynth, {
      harmonicity: 3.99,
      modulationIndex: 3.2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.35 },
      modulationEnvelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.05 },
      volume,
    }),
    life,
  );
}

function bell(p: Play, life: number, volume = -15) {
  return make(
    p,
    new p.tone.PolySynth(p.tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 7,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.3, sustain: 0, release: 0.9 },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      volume,
    }),
    life,
  );
}

function thump(p: Play, life: number, volume = -6) {
  return make(p, new p.tone.MembraneSynth({ pitchDecay: 0.04, octaves: 4, envelope: { attack: 0.001, decay: 0.26, sustain: 0, release: 0.05 }, volume }), life);
}

interface NoiseOptions {
  type?: 'white' | 'pink' | 'brown';
  filter?: BiquadFilterType;
  freq?: number;
  q?: number;
  attack?: number;
  decay?: number;
  volume?: number;
}

function noise(p: Play, life: number, { type = 'pink', filter = 'bandpass', freq = 2000, q = 1, attack = 0.001, decay = 0.05, volume = -10 }: NoiseOptions = {}) {
  const f = make(p, new p.tone.Filter({ frequency: freq, type: filter, Q: q }), life);
  const synth = new p.tone.NoiseSynth({ noise: { type }, envelope: { attack, decay, sustain: 0, release: 0.02 }, volume }).connect(f);
  later(p, synth, life);
  return { synth, filter: f };
}

interface GlideOptions {
  type?: 'sine' | 'triangle' | 'square' | 'sawtooth';
  volume?: number;
  vibrato?: [frequency: number, depth: number];
  velocity?: number;
}

/** A tone gliding through [frequency, seconds-from-start] points. */
function glide(p: Play, t: number, points: Array<[number, number]>, opts: GlideOptions = {}) {
  const life = points[points.length - 1]![1] + 0.3;
  const s = new p.tone.Synth({ oscillator: { type: opts.type ?? 'sine' }, envelope: { attack: 0.008, decay: 0.05, sustain: 0.9, release: 0.08 }, volume: opts.volume ?? -12 });
  if (opts.vibrato) {
    const v = make(p, new p.tone.Vibrato(opts.vibrato[0], opts.vibrato[1]), life);
    s.connect(v);
  } else {
    s.connect(p.out);
  }
  later(p, s, life);
  s.triggerAttack(points[0]![0], t, opts.velocity ?? 1);
  for (const [f, at] of points.slice(1)) s.frequency.exponentialRampToValueAtTime(f, t + at);
  s.triggerRelease(t + points[points.length - 1]![1]);
}

function metal(p: Play, life: number, volume = -20) {
  return make(p, new p.tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.35, release: 0.1 }, harmonicity: 5.1, modulationIndex: 20, resonance: 4200, octaves: 1.2, volume }), life);
}

// ------------------------------------------------------------------ building blocks

function knock(p: Play, t: number, note: string, vel = 0.7) {
  wood(p, 0.3).triggerAttackRelease(hz(p, note) * jitter(15), 0.06, t, vel);
  clicker(p, 0.2).triggerAttackRelease(0.01, t, vel * 0.8);
}

function pop(p: Play, t: number, from = 300, to = 900, vel = 0.8) {
  glide(p, t, [[from, 0], [to, 0.06]], { volume: -14, velocity: vel });
}

function flick(p: Play, t: number, vel = 0.7) {
  noise(p, 0.2, { type: 'white', filter: 'highpass', freq: 2600, decay: 0.035, volume: -14 }).synth.triggerAttackRelease(0.03, t, vel);
}

function thud(p: Play, t: number, note = 'C2', vel = 0.8) {
  thump(p, 0.5).triggerAttackRelease(note, 0.2, t, vel);
}

function sparkle(p: Play, t: number, notes: string[], gap = 0.04, vel = 0.4) {
  const b = bell(p, notes.length * gap + 1.8);
  notes.forEach((n, i) => b.triggerAttackRelease(n, 0.5, t + i * gap, vel));
}

function puff(p: Play, t: number, from = 2000, to = 200, len = 0.45, vel = 0.6) {
  const { synth, filter } = noise(p, len + 0.3, { type: 'pink', filter: 'lowpass', freq: from, attack: 0.01, decay: len, volume: -8 });
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + len);
  synth.triggerAttackRelease(len, t, vel);
}

function whoosh(p: Play, t: number, from: number, to: number, len: number, vel = 0.6) {
  const { synth, filter } = noise(p, len + 0.3, { type: 'pink', filter: 'bandpass', freq: from, q: 1.4, attack: len * 0.35, decay: len * 0.65, volume: -6 });
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + len);
  synth.triggerAttackRelease(len, t, vel);
}

const HOP_NOTES = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
const STEP_BACK_NOTES = ['G4', 'F4', 'E4', 'D4', 'C4'];
const PIECE_NOTES = ['C5', 'E5', 'G5', 'C6'];
const RANK_NOTES: Record<number, string> = { 4: 'C5', 3: 'E5', 2: 'G5' };

const landing: Recipe = (p, t) => {
  thud(p, t, 'C2', 0.8);
  knock(p, t + 0.01, 'G3', 0.35);
  puff(p, t, 900, 200, 0.18, 0.35);
  return 0.45;
};

const shieldTing: Recipe = (p, t) => {
  metal(p, 1).triggerAttackRelease(900, 0.25, t, 0.75);
  sparkle(p, t + 0.01, ['B6'], 0.05, 0.3);
  return 0.9;
};

// ------------------------------------------------------------------ the sounds

export const SOUNDS: Record<SoundId, Recipe> = {
  // Menu and buttons
  U1: (p, t) => {
    knock(p, t, 'A5', 0.55);
    return 0.15;
  },
  U2: (p, t, piece = 0) => {
    pop(p, t, 320, 900, 0.7);
    marimba(p, 1.2).triggerAttackRelease(PIECE_NOTES[piece % 4]!, 0.4, t + 0.03, 0.8);
    return 0.6;
  },
  U3: (p, t, on = 1) => {
    if (on) {
      knock(p, t, 'C6', 0.5);
      knock(p, t + 0.05, 'G6', 0.45);
    } else {
      knock(p, t, 'G5', 0.5);
      knock(p, t + 0.05, 'C5', 0.45);
    }
    return 0.25;
  },
  U4: (p, t) => {
    const m = marimba(p, 1.2, -7);
    m.triggerAttackRelease('E3', 0.25, t, 0.55);
    m.triggerAttackRelease('C3', 0.4, t + 0.13, 0.5);
    return 0.6;
  },

  // Matchmaking
  Q1: (p, t, seat = 0) => {
    const k = 1 + 0.25 * (seat % 3);
    pop(p, t, 260 * k, 780 * k, 0.8);
    knock(p, t + 0.02, ['E5', 'G5', 'C6'][seat % 3]!, 0.35);
    return 0.25;
  },
  Q2: (p, t) => {
    sparkle(p, t, ['C5', 'E5', 'G5', 'C6'], 0.045, 0.55);
    marimba(p, 1.6).triggerAttackRelease(['C4', 'G4', 'E5'], 0.6, t + 0.02, 0.7);
    noise(p, 1.2, { type: 'white', filter: 'highpass', freq: 7000, attack: 0.05, decay: 0.7, volume: -22 }).synth.triggerAttackRelease(0.7, t + 0.05, 0.6);
    return 1.6;
  },
  Q3: (p, t) => {
    knock(p, t, 'C5', 0.8);
    knock(p, t + 0.75, 'C5', 0.8);
    knock(p, t + 1.5, 'G5', 0.9);
    whoosh(p, t + 1.75, 500, 4500, 0.5, 0.55);
    return 2.4;
  },

  // Dice
  D1: (p, t) => {
    sparkle(p, t, ['E6', 'A6'], 0.12, 0.35);
    return 1.2;
  },
  D2: (p, t) => {
    const { synth } = noise(p, 1, { type: 'pink', filter: 'bandpass', freq: 2600, q: 1.6, decay: 0.022, volume: -6 });
    let at = t;
    for (let i = 0; i < 12; i++) {
      at += rnd(0.035, 0.065);
      synth.triggerAttackRelease(0.02, at, rnd(0.3, 0.85));
    }
    for (let i = 0; i < 5; i++) knock(p, t + 0.06 + i * 0.12 + rnd(0, 0.03), ['C6', 'D6', 'E6', 'G6'][i % 4]!, rnd(0.12, 0.25));
    knock(p, t + 0.85, 'D4', 0.95);
    knock(p, t + 0.93, 'A4', 0.45);
    thud(p, t + 0.85, 'C3', 0.35);
    return 1.15;
  },
  D3: (p, t) => {
    knock(p, t, 'E4', 0.55);
    knock(p, t + 0.05, 'B4', 0.25);
    return 0.2;
  },
  D4: (p, t) => {
    knock(p, t, 'E6', 0.3);
    return 0.15;
  },
  D5: (p, t) => {
    sparkle(p, t, ['C6', 'E6', 'G6', 'C7', 'E7'], 0.035, 0.3);
    return 1.1;
  },
  D6: (p, t) => {
    glide(p, t, [[420, 0], [1300, 0.22]], { volume: -16, vibrato: [7, 0.06] });
    sparkle(p, t + 0.2, ['G6'], 0.05, 0.4);
    return 0.9;
  },
  D7: (p, t) => {
    glide(p, t, [[1100, 0], [380, 0.25]], { volume: -16, vibrato: [7, 0.06] });
    return 0.5;
  },

  // Moving
  H1: (p, t, step = 0) => {
    knock(p, t, HOP_NOTES[step % HOP_NOTES.length]!, 0.6);
    thud(p, t, 'C3', 0.18);
    return 0.2;
  },
  H2: landing,
  H3: (p, t) => {
    glide(p, t, [[180, 0], [520, 0.06], [260, 0.2]], { type: 'triangle', volume: -12, vibrato: [12, 0.3] });
    thud(p, t + 0.02, 'D2', 0.7);
    return 0.5;
  },
  S1: (p, t) => {
    whoosh(p, t, 3200, 380, 0.45, 0.7);
    glide(p, t + 0.35, [[1500, 0], [280, 1.25]], { volume: -14, vibrato: [5.5, 0.08] });
    pop(p, t + 1.7, 300, 950, 0.9);
    knock(p, t + 1.72, 'G4', 0.5);
    return 2.0;
  },
  L1: (p, t) => {
    glide(p, t, [[110, 0], [620, 0.09], [340, 0.34]], { type: 'triangle', volume: -10, vibrato: [14, 0.25] });
    whoosh(p, t + 0.1, 500, 5200, 0.75, 0.6);
    thud(p, t + 1.2, 'C2', 0.5);
    knock(p, t + 1.21, 'A4', 0.3);
    return 1.4;
  },
  K1: (p, t) => {
    noise(p, 0.4, { type: 'white', filter: 'lowpass', freq: 2500, decay: 0.08, volume: -4 }).synth.triggerAttackRelease(0.06, t, 1);
    thud(p, t, 'E2', 0.9);
    glide(p, t + 0.05, [[950, 0], [420, 0.35]], { volume: -16, vibrato: [8, 0.05] });
    return 0.6;
  },
  B1: (p, t, step = 0) => {
    knock(p, t, STEP_BACK_NOTES[Math.min(step, STEP_BACK_NOTES.length - 1)]!, 0.4);
    return 0.2;
  },
  B2: shieldTing,
  B3: (p, t) => {
    sparkle(p, t, ['G5', 'C6', 'E6'], 0.055, 0.45);
    noise(p, 1, { type: 'white', filter: 'highpass', freq: 7500, attack: 0.02, decay: 0.5, volume: -24 }).synth.triggerAttackRelease(0.5, t + 0.05, 0.6);
    return 1.2;
  },

  // Face-offs
  F1: (p, t) => {
    thud(p, t, 'G1', 1);
    thud(p, t + 0.18, 'G1', 0.9);
    const filt = make(p, new p.tone.Filter(1800, 'lowpass'), 1.4);
    const chord = new p.tone.PolySynth(p.tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.4 }, volume: -20 }).connect(filt);
    later(p, chord, 1.4);
    chord.triggerAttackRelease(['D4', 'F4', 'A4', 'D5'], 0.35, t + 0.36, 0.8);
    metal(p, 1.4, -26).triggerAttackRelease(300, 0.5, t + 0.36, 0.6);
    return 1.1;
  },
  F2: (p, t) => {
    knock(p, t, 'E6', 0.5);
    knock(p, t + 0.045, 'B5', 0.45);
    return 0.15;
  },
  F3: (p, t) => {
    const m = marimba(p, 1.5);
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => m.triggerAttackRelease(n, 0.3, t + i * 0.07, 0.85));
    sparkle(p, t + 0.28, ['C6', 'E6'], 0.02, 0.35);
    return 1.1;
  },
  F4: (p, t) => {
    const filt = make(p, new p.tone.Filter({ frequency: 900, type: 'lowpass', Q: 2 }), 2.2);
    const v = new p.tone.Vibrato(5, 0);
    const s = new p.tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.15 }, volume: -16 }).chain(v, filt);
    later(p, s, 2.2);
    later(p, v, 2.2);
    s.triggerAttackRelease('G4', 0.26, t, 0.6);
    s.triggerAttackRelease('F#4', 0.26, t + 0.32, 0.6);
    s.triggerAttackRelease('F4', 0.26, t + 0.64, 0.6);
    s.triggerAttackRelease('E4', 0.8, t + 0.96, 0.6);
    v.depth.setValueAtTime(0, t + 0.96);
    v.depth.linearRampToValueAtTime(0.25, t + 1.3);
    return 1.9;
  },
  F5: (p, t) => {
    const m = marimba(p, 1);
    m.triggerAttackRelease('E5', 0.2, t, 0.7);
    m.triggerAttackRelease('A5', 0.15, t + 0.14, 0.6);
    glide(p, t + 0.14, [[880, 0], [1050, 0.12]], { volume: -24 });
    return 0.5;
  },

  // Cards
  C1: (p, t) => {
    [0, 0.07, 0.14].forEach((d) => flick(p, t + d, 0.8));
    marimba(p, 1).triggerAttackRelease('G5', 0.2, t + 0.2, 0.35);
    return 0.5;
  },
  C2: (p, t) => {
    for (let i = 0; i < 12; i++) flick(p, t + i * 0.03 + rnd(0, 0.01), 0.75 - i * 0.04);
    return 0.5;
  },
  C3: (p, t) => {
    flick(p, t, 1);
    knock(p, t + 0.01, 'C6', 0.45);
    return 0.2;
  },
  C4: (p, t, count = 3) => {
    const m = marimba(p, 0.3 + count * 0.2);
    const notes = ['E5', 'G5', 'B5', 'D6'];
    for (let i = 0; i < count; i++) {
      flick(p, t + i * 0.18, 0.8);
      m.triggerAttackRelease(notes[i % notes.length]!, 0.25, t + i * 0.18 + 0.02, 0.55);
    }
    return count * 0.18 + 0.4;
  },
  C5: (p, t) => {
    thud(p, t, 'A1', 1);
    noise(p, 0.4, { type: 'pink', filter: 'lowpass', freq: 1200, decay: 0.1, volume: -6 }).synth.triggerAttackRelease(0.08, t, 0.9);
    knock(p, t + 0.01, 'D3', 0.4);
    return 0.5;
  },
  C6: (p, t) => {
    puff(p, t, 2000, 200, 0.5, 0.6);
    glide(p, t, [[480, 0], [130, 0.4]], { volume: -20 });
    return 0.6;
  },
  C7: (p, t) => {
    metal(p, 1.6, -16).triggerAttackRelease(220, 0.9, t, 0.9);
    thud(p, t, 'F1', 0.8);
    return 1.3;
  },
  C8: (p, t) => {
    glide(p, t, [[220, 0], [760, 0.12]], { type: 'triangle', volume: -12 });
    glide(p, t + 0.1, [[360, 0], [900, 0.09]], { type: 'triangle', volume: -16 });
    return 0.4;
  },
  C9: (p, t) => {
    glide(p, t, [[900, 0], [360, 0.09]], { type: 'triangle', volume: -16 });
    glide(p, t + 0.08, [[760, 0], [220, 0.12]], { type: 'triangle', volume: -12 });
    return 0.4;
  },
  C10: (p, t) => {
    sparkle(p, t, ['G6', 'B6', 'D7'], 0.03, 0.22);
    noise(p, 1.2, { type: 'white', filter: 'highpass', freq: 6000, attack: 0.15, decay: 0.6, volume: -26 }).synth.triggerAttackRelease(0.7, t, 0.6);
    return 1.3;
  },

  // Finish
  W1: (p, t) => {
    const { synth } = noise(p, 1, { type: 'white', filter: 'bandpass', freq: 1800, q: 0.8, decay: 0.03, volume: -14 });
    for (let i = 0; i < 14; i++) synth.triggerAttackRelease(0.02, t + i * 0.045, 0.2 + i * 0.05);
    const m = marimba(p, 2.6);
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => m.triggerAttackRelease(n, 0.4, t + 0.65 + i * 0.06, 0.85));
    bell(p, 3, -12).triggerAttackRelease(['C6', 'E6', 'G6'], 1.2, t + 1.0, 0.6);
    thud(p, t + 1.0, 'C2', 0.7);
    return 2.6;
  },
  W2: (p, t) => {
    const m = marimba(p, 1.5);
    ['G4', 'C5', 'E5'].forEach((n, i) => m.triggerAttackRelease(n, 0.35, t + i * 0.08, 0.6));
    sparkle(p, t + 0.3, ['G5'], 0.05, 0.3);
    return 1.3;
  },
  W3: (p, t, rank = 2) => {
    pop(p, t, 300, 850, 0.7);
    marimba(p, 1).triggerAttackRelease(RANK_NOTES[rank] ?? 'G5', 0.3, t + 0.03, 0.7);
    return 0.5;
  },
  W4: (p, t) => {
    const pad = make(p, new p.tone.PolySynth(p.tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.08, decay: 1.2, sustain: 0.2, release: 1 }, volume: -16 }), 3);
    pad.triggerAttackRelease(['C4', 'E4', 'G4', 'B4'], 1.2, t, 0.7);
    sparkle(p, t + 0.1, ['C6'], 0.05, 0.25);
    return 1.8;
  },
};
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS (3 tests). Then `pnpm exec tsc -p apps/client`. Expected: no errors. If Tone's option types reject a literal, cast that one options object with `as const`, or widen the field (e.g. `oscillator: { type: 'sine' as const }`), and record a ruling.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): port the approved sound recipes to TypeScript"` (with the trailer).

### Task 3: The music

**Files:**
- Create: `apps/client/src/audio/music.ts`, `apps/client/test/music.test.ts`

**Interfaces (produces):** `SongId = 'menu' | 'match'`, `Song`, `SONGS`, `SongEvent`, `songEvents(song): SongEvent[]`, `class MusicPlayer { constructor(tone: ToneLib, out: ToneAudioNode); play(id: SongId | null): void }`.

- [ ] **Step 1: Write the failing test.** Create `apps/client/test/music.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SONGS, songEvents } from '../src/audio/music';

describe('the music loops (spec #3 §6)', () => {
  it('builds the menu loop: 8 bars of arpeggio, bass, shaker and kick, plus the bell tune', () => {
    const events = songEvents(SONGS.menu);
    expect(SONGS.menu.bpm).toBe(104);
    expect(events.filter((e) => e.kind === 'mallet')).toHaveLength(64);
    expect(events.filter((e) => e.kind === 'bass')).toHaveLength(16);
    expect(events.filter((e) => e.kind === 'shaker')).toHaveLength(32);
    expect(events.filter((e) => e.kind === 'kick')).toHaveLength(16);
    expect(events.filter((e) => e.kind === 'bell')).toHaveLength(12);
    expect(events.find((e) => e.kind === 'mallet' && e.time === '3:0:10')?.note).toBe('B3');
  });

  it('builds the calmer match loop: sparse arpeggio, a pad each bar, no kick', () => {
    const events = songEvents(SONGS.match);
    expect(SONGS.match.bpm).toBe(88);
    expect(events.filter((e) => e.kind === 'mallet')).toHaveLength(32);
    expect(events.filter((e) => e.kind === 'pad')).toHaveLength(8);
    expect(events.filter((e) => e.kind === 'kick')).toHaveLength(0);
  });

  it('places half-beat tune notes on the right sixteenth', () => {
    const tune = songEvents(SONGS.menu).filter((e) => e.kind === 'bell');
    expect(tune.find((e) => e.note === 'G5')?.time).toBe('1:0:2');
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run apps/client/test/music.test.ts`. Expected: FAIL, because `../src/audio/music` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/music.ts`:

```ts
import type * as Tone from 'tone';
import type { ToneLib } from './sounds';

// The two music loops from the approved sound board (spec #3 §6), as data, and a player that
// loops one of them on Tone's transport.

export type SongId = 'menu' | 'match';

export interface Song {
  bpm: number;
  /** Four chord tones per bar. */
  bars: string[][];
  /** Chord-tone index per eighth note; -1 rests. */
  arp: number[];
  /** Bass root per bar, on beats 1 and 3. */
  bass: string[];
  /** Bell notes at [beat from the start, note]. */
  tune: Array<[number, string]>;
  /** A soft kick on beats 1 and 3, and a brighter shaker; without it, a pad holds each chord. */
  kick: boolean;
}

export const SONGS: Record<SongId, Song> = {
  menu: {
    bpm: 104,
    bars: [
      ['C4', 'E4', 'G4', 'C5'], ['A3', 'C4', 'E4', 'A4'], ['F3', 'A3', 'C4', 'F4'], ['G3', 'B3', 'D4', 'G4'],
      ['C4', 'E4', 'G4', 'C5'], ['A3', 'C4', 'E4', 'A4'], ['F3', 'A3', 'C4', 'F4'], ['G3', 'B3', 'D4', 'G4'],
    ],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
    bass: ['C2', 'A1', 'F1', 'G1', 'C2', 'A1', 'F1', 'G1'],
    tune: [[4, 'E5'], [4.5, 'G5'], [5, 'A5'], [6, 'G5'], [12, 'E5'], [12.5, 'D5'], [13, 'C5'], [14, 'D5'], [28, 'E5'], [28.5, 'G5'], [29, 'C6'], [30, 'B5']],
    kick: true,
  },
  match: {
    bpm: 88,
    bars: [
      ['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['G3', 'C4', 'D4', 'F4'],
      ['F3', 'A3', 'C4', 'E4'], ['E3', 'G3', 'B3', 'D4'], ['D3', 'F3', 'A3', 'C4'], ['G3', 'B3', 'D4', 'F4'],
    ],
    arp: [0, -1, 2, -1, 3, -1, 1, -1],
    bass: ['F1', 'E1', 'D1', 'G1', 'F1', 'E1', 'D1', 'G1'],
    tune: [[2, 'A4'], [3, 'C5'], [10, 'G4'], [11, 'B4'], [18, 'F4'], [19, 'A4'], [26, 'D5'], [27, 'C5']],
    kick: false,
  },
};

export interface SongEvent {
  /** Bars:quarters:sixteenths from the loop start. */
  time: string;
  kind: 'mallet' | 'bass' | 'shaker' | 'kick' | 'bell' | 'pad';
  note?: string;
  notes?: string[];
  vel?: number;
}

/** Every note of one pass through the loop. */
export function songEvents(song: Song): SongEvent[] {
  const events: SongEvent[] = [];
  song.bars.forEach((chord, bar) => {
    song.arp.forEach((idx, step) => {
      if (idx >= 0) events.push({ time: `${bar}:0:${step * 2}`, kind: 'mallet', note: chord[idx], vel: step % 2 === 0 ? 0.7 : 0.45 });
    });
    events.push({ time: `${bar}:0:0`, kind: 'bass', note: song.bass[bar] });
    events.push({ time: `${bar}:2:0`, kind: 'bass', note: song.bass[bar] });
    if (!song.kick) events.push({ time: `${bar}:0:0`, kind: 'pad', notes: chord.slice(0, 3) });
    for (let beat = 0; beat < 4; beat++) {
      events.push({ time: `${bar}:${beat}:2`, kind: 'shaker', vel: song.kick ? 0.6 : 0.35 });
      if (song.kick && beat % 2 === 0) events.push({ time: `${bar}:${beat}:0`, kind: 'kick' });
    }
  });
  for (const [beats, note] of song.tune) events.push({ time: `${Math.floor(beats / 4)}:${Math.floor(beats % 4)}:${(beats % 1) * 4}`, kind: 'bell', note });
  return events;
}

interface Instruments {
  mallet: Tone.PolySynth<Tone.FMSynth>;
  bell: Tone.PolySynth<Tone.FMSynth>;
  bass: Tone.MonoSynth;
  kick: Tone.MembraneSynth;
  shaker: Tone.NoiseSynth;
  pad: Tone.PolySynth<Tone.Synth>;
}

/** Loops one song on Tone's transport; the engine fades and ducks the bus it plays into. */
export class MusicPlayer {
  private part: Tone.Part<SongEvent> | null = null;
  private inst: Instruments | null = null;

  constructor(
    private readonly tone: ToneLib,
    private readonly out: Tone.ToneAudioNode,
  ) {}

  play(id: SongId | null): void {
    const transport = this.tone.getTransport();
    transport.stop();
    transport.cancel();
    this.part?.dispose();
    this.part = null;
    if (!id) return;
    const song = SONGS[id];
    const inst = this.instruments();
    transport.bpm.value = song.bpm;
    const part = new this.tone.Part<SongEvent>((time, e) => {
      if (e.kind === 'mallet') inst.mallet.triggerAttackRelease(e.note!, '8n', time, e.vel);
      else if (e.kind === 'bass') inst.bass.triggerAttackRelease(e.note!, '8n', time, 0.8);
      else if (e.kind === 'shaker') inst.shaker.triggerAttackRelease('32n', time, e.vel);
      else if (e.kind === 'kick') inst.kick.triggerAttackRelease('C1', '8n', time, 0.7);
      else if (e.kind === 'bell') inst.bell.triggerAttackRelease(e.note!, '4n', time, 0.5);
      else inst.pad.triggerAttackRelease(e.notes!, '1m', time, 0.5);
    }, songEvents(song));
    part.loop = true;
    part.loopEnd = `${song.bars.length}m`;
    part.start(0);
    this.part = part;
    transport.start('+0.05');
  }

  private instruments(): Instruments {
    if (this.inst) return this.inst;
    const t = this.tone;
    const shakerFilter = new t.Filter(6500, 'highpass').connect(this.out);
    this.inst = {
      mallet: new t.PolySynth(t.FMSynth, {
        harmonicity: 3.99, modulationIndex: 2.6, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.4 }, modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, volume: -10,
      }).connect(this.out),
      bell: new t.PolySynth(t.FMSynth, {
        harmonicity: 3.5, modulationIndex: 5, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1, sustain: 0, release: 0.8 }, modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 }, volume: -16,
      }).connect(this.out),
      bass: new t.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.2 }, filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.2, baseFrequency: 180, octaves: 2.5 }, volume: -8 }).connect(this.out),
      kick: new t.MembraneSynth({ pitchDecay: 0.05, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 }, volume: -12 }).connect(this.out),
      shaker: new t.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.04, sustain: 0, release: 0.02 }, volume: -30 }).connect(shakerFilter),
      pad: new t.PolySynth(t.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 1.5, sustain: 0.5, release: 1.5 }, volume: -24 }).connect(this.out),
    };
    return this.inst;
  }
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS (3 tests). Then `pnpm exec tsc -p apps/client`. Expected: no errors.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): add the menu and match music loops"` (with the trailer).

### Task 4: The audio engine

**Files:**
- Create: `apps/client/src/audio/engine.ts`, `apps/client/test/engine.test.ts`

**Interfaces:**
- **Consumes:**
  - from Task 1, `SoundSettings`, `DEFAULT_SOUND`, `soundLevels`;
  - from Task 2, `SOUNDS`, `TRIM`, `SoundId`, `Recipe`, `ToneLib`;
  - from Task 3, `MusicPlayer`, `SongId`.
- **Produces:**
  - `Cue = { id: SoundId; atMs: number; soft: boolean; arg?: number; duck?: number; musicOut?: boolean }`;
  - `SoundStats = { started: boolean; played: number; errors: number }`;
  - `class AudioEngine(load: () => Promise<ToneLib>, opts?: { recipes?; music?; warn? })`, with `unlock()`, `start(): Promise<void>`, `setSound(s)`, `play(cue)`, `playNow(id, arg?)`, `music(song)`, `suspend()`, `resume()` and `stats()`.

- [ ] **Step 1: Write the failing test.** Create `apps/client/test/engine.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/engine';
import { DEFAULT_SOUND, soundLevels } from '../src/audio/settings';
import { SOUND_IDS, TRIM, type Recipe, type SoundId, type ToneLib } from '../src/audio/sounds';

class FakeParam {
  constructor(public value = 0) {}
  rampTo = vi.fn((v: number) => {
    this.value = v;
  });
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class FakeNode {
  connected: unknown[] = [];
  connect = vi.fn((to: unknown) => {
    this.connected.push(to);
    return this;
  });
  toDestination = vi.fn(() => this);
  dispose = vi.fn();
}

/** Just the parts of Tone the engine itself touches: recipes and music are faked separately. */
function fakeTone() {
  const volumes: FakeVolume[] = [];
  class FakeVolume extends FakeNode {
    volume: FakeParam;
    constructor(db = 0) {
      super();
      this.volume = new FakeParam(db);
      volumes.push(this);
    }
  }
  class FakeReverb extends FakeNode {
    ready = Promise.resolve();
  }
  const destination = { mute: false };
  const raw = { suspend: vi.fn(), resume: vi.fn() };
  const tone = {
    start: vi.fn(async () => {}),
    now: () => 10,
    Volume: FakeVolume,
    Reverb: FakeReverb,
    Limiter: FakeNode,
    getDestination: () => destination,
    getContext: () => ({ rawContext: raw }),
  };
  return { tone: tone as unknown as ToneLib, volumes, destination, raw };
}

function setup(opts: { fail?: boolean; throwing?: SoundId } = {}) {
  const fake = fakeTone();
  const load = vi.fn(async () => {
    if (opts.fail) throw new Error('chunk failed');
    return fake.tone;
  });
  const recipes = Object.fromEntries(
    SOUND_IDS.map((id) => [
      id,
      vi.fn(() => {
        if (id === opts.throwing) throw new Error('bad recipe');
        return 0.5;
      }),
    ]),
  ) as Record<SoundId, Recipe & ReturnType<typeof vi.fn>>;
  const player = { play: vi.fn() };
  const warn = vi.fn();
  const engine = new AudioEngine(load, { recipes, music: () => player, warn });
  return { engine, load, recipes, player, warn, ...fake };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('AudioEngine (spec #3 §3, §7)', () => {
  it('does nothing before the first tap, then loads Tone once and plays', async () => {
    const { engine, load, recipes } = setup();
    engine.playNow('U1');
    expect(load).not.toHaveBeenCalled();
    engine.unlock();
    engine.unlock();
    await engine.start();
    expect(load).toHaveBeenCalledTimes(1);
    engine.playNow('U1');
    expect(recipes.U1).toHaveBeenCalledTimes(1);
    expect(recipes.U1.mock.calls[0]![1]).toBeCloseTo(10.02, 6);
    expect(engine.stats()).toEqual({ started: true, played: 1, errors: 0 });
  });

  it('never loads Tone while muted, and loads it when sound is turned back on', async () => {
    const { engine, load } = setup();
    engine.setSound({ ...DEFAULT_SOUND, muted: true });
    engine.unlock();
    await engine.start();
    expect(load).not.toHaveBeenCalled();
    engine.setSound(DEFAULT_SOUND);
    await engine.start();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('sets the bus levels from the settings, and mutes at the output', async () => {
    const { engine, volumes, destination } = setup();
    engine.unlock();
    await engine.start();
    const [effects, others, music] = volumes;
    expect(effects!.volume.value).toBeCloseTo(soundLevels(DEFAULT_SOUND).effectsDb, 6);
    expect(others!.volume.value).toBe(-7);
    expect(music!.volume.value).toBeCloseTo(soundLevels(DEFAULT_SOUND).musicDb, 6);
    engine.setSound({ muted: true, effects: 0.5, music: 0.5 });
    expect(effects!.volume.rampTo).toHaveBeenCalledWith(soundLevels({ muted: true, effects: 0.5, music: 0.5 }).effectsDb, 0.05);
    expect(destination.mute).toBe(true);
  });

  it("plays each sound through its trim, into the softer bus for other players' moments", async () => {
    const { engine, volumes, recipes } = setup();
    engine.unlock();
    await engine.start();
    engine.play({ id: 'S1', atMs: 500, soft: true });
    const trim = volumes.at(-1)!;
    expect(trim.volume.value).toBe(TRIM.S1);
    expect(trim.connected[0]).toBe(volumes[1]);
    expect(recipes.S1.mock.calls[0]![1]).toBeCloseTo(10.52, 6);
  });

  it('counts a failing sound instead of throwing', async () => {
    const { engine, warn } = setup({ throwing: 'K1' });
    engine.unlock();
    await engine.start();
    expect(() => engine.playNow('K1')).not.toThrow();
    expect(engine.stats()).toEqual({ started: true, played: 0, errors: 1 });
    expect(warn).toHaveBeenCalled();
  });

  it('stays silent for the session when Tone fails to load', async () => {
    const { engine, warn, recipes } = setup({ fail: true });
    engine.unlock();
    await engine.start();
    engine.playNow('U1');
    expect(recipes.U1).not.toHaveBeenCalled();
    expect(engine.stats().started).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('chunk failed'));
  });

  it('suspends and resumes the audio context', async () => {
    const { engine, raw } = setup();
    engine.suspend();
    expect(raw.suspend).not.toHaveBeenCalled();
    engine.unlock();
    await engine.start();
    engine.suspend();
    engine.resume();
    expect(raw.suspend).toHaveBeenCalledTimes(1);
    expect(raw.resume).toHaveBeenCalledTimes(1);
  });

  it("plays the screen's song once loaded, switches songs, and fades out at the win", async () => {
    const { engine, player } = setup();
    engine.music('menu');
    engine.unlock();
    await engine.start();
    expect(player.play).toHaveBeenLastCalledWith('menu');
    engine.music('match');
    vi.advanceTimersByTime(400);
    expect(player.play).toHaveBeenLastCalledWith('match');
    engine.play({ id: 'W1', atMs: 0, soft: false, musicOut: true });
    vi.advanceTimersByTime(1100);
    expect(player.play).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run apps/client/test/engine.test.ts`. Expected: FAIL, because `../src/audio/engine` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/engine.ts`:

```ts
import type * as Tone from 'tone';
import { MusicPlayer, type SongId } from './music';
import { DEFAULT_SOUND, soundLevels, type SoundSettings } from './settings';
import { SOUNDS, TRIM, type Recipe, type SoundId, type ToneLib } from './sounds';

// The sound engine (spec #3 §3, §7). Tone loads on the first tap after which sound is allowed;
// before that, while muted, or after a failed load, every call quietly does nothing.

/** One sound to play: `atMs` from now; `soft` for another player's moment (7 dB down). */
export interface Cue {
  id: SoundId;
  atMs: number;
  soft: boolean;
  arg?: number;
  /** Dip the music under this sound for this many seconds. */
  duck?: number;
  /** Fade the music out (the win). */
  musicOut?: boolean;
}

export interface SoundStats {
  started: boolean;
  played: number;
  errors: number;
}

export interface MusicLike {
  play(id: SongId | null): void;
}

export interface EngineOptions {
  recipes?: Record<SoundId, Recipe>;
  music?: (tone: ToneLib, out: Tone.ToneAudioNode) => MusicLike;
  warn?: (message: string) => void;
}

const OTHERS_DB = -7;
const DUCK_DB = 12;
const SWITCH_S = 0.4;
const FADE_IN_S = 0.8;
const FADE_OUT_S = 1;

export class AudioEngine {
  private tone: ToneLib | null = null;
  private loading: Promise<void> | null = null;
  private failed = false;
  private unlocked = false;
  private settings: SoundSettings = DEFAULT_SOUND;
  private buses: { effects: Tone.Volume; others: Tone.Volume; music: Tone.Volume } | null = null;
  private player: MusicLike | null = null;
  private song: SongId | null = null;
  private playing: SongId | null = null;
  private played = 0;
  private errors = 0;

  constructor(
    private readonly load: () => Promise<ToneLib>,
    private readonly opts: EngineOptions = {},
  ) {}

  /** A user gesture happened: sound may start now. */
  unlock(): void {
    this.unlocked = true;
    void this.start();
  }

  /** Loads Tone once (after a gesture, while not muted). Resolves when ready or failed. */
  start(): Promise<void> {
    if (!this.unlocked || this.settings.muted || this.failed) return Promise.resolve();
    this.loading ??= this.boot().catch((e: unknown) => {
      this.failed = true;
      this.tone = null;
      this.warn(`sound is off: ${String(e)}`);
    });
    return this.loading;
  }

  private async boot(): Promise<void> {
    const tone = await this.load();
    await tone.start();
    const limiter = new tone.Limiter(-1).toDestination();
    const verb = new tone.Reverb({ decay: 1.4, wet: 0.16 }).connect(limiter);
    await verb.ready;
    const levels = soundLevels(this.settings);
    const effects = new tone.Volume(levels.effectsDb).connect(verb);
    const others = new tone.Volume(OTHERS_DB).connect(effects);
    const music = new tone.Volume(levels.musicDb).connect(verb);
    this.buses = { effects, others, music };
    this.player = (this.opts.music ?? ((t, out) => new MusicPlayer(t, out)))(tone, music);
    tone.getDestination().mute = this.settings.muted;
    this.tone = tone;
    if (this.song) this.switchSong(this.song);
  }

  setSound(settings: SoundSettings): void {
    this.settings = settings;
    if (!this.tone || !this.buses) {
      if (!settings.muted) void this.start();
      return;
    }
    const levels = soundLevels(settings);
    this.buses.effects.volume.rampTo(levels.effectsDb, 0.05);
    this.buses.music.volume.rampTo(levels.musicDb, 0.05);
    this.tone.getDestination().mute = settings.muted;
  }

  play(cue: Cue): void {
    const { tone, buses } = this;
    if (!tone || !buses || this.settings.muted) return;
    try {
      const at = tone.now() + 0.02 + cue.atMs / 1000;
      const trim = new tone.Volume(TRIM[cue.id]).connect(cue.soft ? buses.others : buses.effects);
      const len = (this.opts.recipes ?? SOUNDS)[cue.id]({ tone, out: trim, at }, at, cue.arg);
      setTimeout(() => trim.dispose(), (cue.atMs / 1000 + len + 5) * 1000);
      this.played++;
      if (cue.duck) this.duck(at, cue.duck);
      if (cue.musicOut) this.fadeOut(at);
    } catch (e) {
      this.errors++;
      this.warn(`sound ${cue.id} failed: ${String(e)}`);
    }
  }

  playNow(id: SoundId, arg?: number): void {
    this.play({ id, atMs: 0, soft: false, arg });
  }

  /** The music for the current screen; null for silence. */
  music(song: SongId | null): void {
    if (song === this.song) return;
    this.song = song;
    if (this.tone) this.switchSong(song);
  }

  suspend(): void {
    void (this.tone?.getContext().rawContext as AudioContext | undefined)?.suspend?.();
  }

  resume(): void {
    void (this.tone?.getContext().rawContext as AudioContext | undefined)?.resume?.();
  }

  stats(): SoundStats {
    return { started: this.tone !== null, played: this.played, errors: this.errors };
  }

  /** Fade out what's playing (if anything), then start the new song fading in. */
  private switchSong(song: SongId | null): void {
    const { tone, buses, player } = this;
    if (!tone || !buses || !player) return;
    const bus = buses.music.volume;
    const level = soundLevels(this.settings).musicDb;
    const now = tone.now();
    const start = () => {
      this.playing = song;
      player.play(song);
      if (!song) return;
      const t = tone.now();
      bus.cancelScheduledValues(t);
      bus.setValueAtTime(-60, t);
      bus.linearRampToValueAtTime(level, t + FADE_IN_S);
    };
    if (this.playing) {
      bus.cancelScheduledValues(now);
      bus.linearRampToValueAtTime(-60, now + SWITCH_S);
      setTimeout(start, SWITCH_S * 1000);
    } else {
      start();
    }
  }

  private duck(at: number, seconds: number): void {
    const bus = this.buses?.music.volume;
    if (!bus || !this.playing) return;
    const level = soundLevels(this.settings).musicDb;
    bus.cancelScheduledValues(at);
    bus.setValueAtTime(level, at);
    bus.linearRampToValueAtTime(level - DUCK_DB, at + 0.08);
    bus.setValueAtTime(level - DUCK_DB, at + seconds);
    bus.linearRampToValueAtTime(level, at + seconds + 0.6);
  }

  private fadeOut(at: number): void {
    const bus = this.buses?.music.volume;
    if (!bus || !this.tone) return;
    bus.cancelScheduledValues(at);
    bus.linearRampToValueAtTime(-60, at + FADE_OUT_S);
    this.song = null;
    setTimeout(() => {
      if (this.song === null) {
        this.playing = null;
        this.player?.play(null);
      }
    }, (at - this.tone.now() + FADE_OUT_S) * 1000);
  }

  private warn(message: string): void {
    (this.opts.warn ?? (import.meta.env.DEV ? (m: string) => console.warn(m) : () => {}))(message);
  }
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS (8 tests). Then `pnpm exec tsc -p apps/client` and `pnpm exec eslint apps/client/src/audio`. Expected: clean.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): add the audio engine"` (with the trailer).

### Task 5: Cues: what plays when

**Files:**
- Create: `apps/client/src/audio/cues.ts`, `apps/client/test/cues.test.ts`

**Interfaces:**
- **Consumes:**
  - `Beat`, `BEAT_MS` (`director/beats.ts`);
  - `LoggedEvent` (`director/director.ts`);
  - `stackOn` (`director/presentation.ts`);
  - `Cue` (Task 4).
- **Produces:**
  - `CueContext = { me: PlayerId; boardSize: number }`;
  - `cuesForBeat(beat: Beat, ctx: CueContext): Cue[]`;
  - `cuesForLog(entries: readonly LoggedEvent[], me: PlayerId, myFace: number | null): Cue[]`;
  - `FACE_OFF_DUCK_S = 1.2`, `OTHER_ROLL_STAGGER_MS = 60`.

All times are unscaled. The hook multiplies them by the director's time scale.

- [ ] **Step 1: Write the failing test.** Create `apps/client/test/cues.test.ts`:

```ts
import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { FACE_OFF_DUCK_S, OTHER_ROLL_STAGGER_MS, cuesForBeat, cuesForLog } from '../src/audio/cues';
import { BEAT_MS, type Beat, type BeatKind } from '../src/director/beats';
import type { LoggedEvent } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

const ctx = { me: 'p0', boardSize: 100 };
const base = presentationFromView(openingUpdate().view);
const at = (positions: Record<PlayerId, number>): PresentationState => ({ ...base, positions: { ...base.positions, ...positions } });
const beat = (kind: BeatKind, events: GameEvent[], after: PresentationState = base): Beat => ({ kind, durationMs: 1000, events, after });
const rolled = (player: PlayerId, face: number, forced = false): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced, auto: false, visibility: 'public' });
const moved = (player: PlayerId, from: number, to: number, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from, to, cause, bounced: false, visibility: 'public' });
const won = (winner: PlayerId, ranks: Array<[PlayerId, number]>): GameEvent => ({
  type: 'MatchWon',
  winner,
  rankings: ranks.map(([player, rank]) => ({ player, rank, position: 0 })),
  visibility: 'public',
});
const log = (events: GameEvent[]): LoggedEvent[] => events.map((event, i) => ({ seq: i + 1, event }));

describe('cues for beats (spec #3 §5)', () => {
  it('rattles my roll, adds the sparkle for a forced face, and clacks the others softly, staggered', () => {
    expect(cuesForBeat(beat('roll', [rolled('p1', 3), rolled('p0', 6, true), rolled('p2', 2)]), ctx)).toEqual([
      { id: 'D3', atMs: 0, soft: true },
      { id: 'D2', atMs: 0, soft: false },
      { id: 'D5', atMs: 850, soft: false },
      { id: 'D3', atMs: OTHER_ROLL_STAGGER_MS, soft: true },
    ]);
  });

  it('knocks once per tile step for the longest move, then lands; softly when my piece is not moving', () => {
    const cues = cuesForBeat(beat('move', [moved('p1', 0, 3), moved('p2', 0, 2)], at({ p1: 3, p2: 2 })), ctx);
    expect(cues).toEqual([
      { id: 'H1', atMs: 0, soft: true, arg: 0 },
      { id: 'H1', atMs: BEAT_MS.hopPerTile, soft: true, arg: 1 },
      { id: 'H1', atMs: 2 * BEAT_MS.hopPerTile, soft: true, arg: 2 },
      { id: 'H2', atMs: 3 * BEAT_MS.hopPerTile, soft: true },
    ]);
  });

  it('lands with a wobble when a mover ends on top of another piece', () => {
    const cues = cuesForBeat(beat('move', [moved('p0', 0, 4)], at({ p0: 4, p3: 4 })), ctx);
    expect(cues.at(-1)).toEqual({ id: 'H3', atMs: 4 * BEAT_MS.hopPerTile, soft: false });
  });

  it('spreads a card move over its beat, rising forward and falling backward', () => {
    const forward = cuesForBeat(beat('cardMove', [moved('p0', 10, 13, 'card')], at({ p0: 13 })), ctx);
    expect(forward.map((c) => c.id)).toEqual(['H1', 'H1', 'H1', 'H2']);
    expect(forward[1]!.atMs).toBe(Math.round(BEAT_MS.cardMove / 4));
    const back = cuesForBeat(beat('cardMove', [moved('p1', 10, 8, 'card')], at({ p1: 8 })), ctx);
    expect(back.map((c) => [c.id, c.soft])).toEqual([['B1', true], ['B1', true], ['H2', true]]);
  });

  it('plays slides, launches, knockbacks, step-backs and blocked snakes, softly for others', () => {
    expect(cuesForBeat(beat('slide', [moved('p0', 47, 26, 'snake')]), ctx)).toEqual([{ id: 'S1', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('launch', [moved('p1', 5, 20, 'ladder')]), ctx)).toEqual([{ id: 'L1', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('knockback', [moved('p2', 9, 6, 'knockback')]), ctx)).toEqual([{ id: 'K1', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('stepBack', [moved('p0', 9, 7, 'stepBack')]), ctx)).toEqual([
      { id: 'B1', atMs: 0, soft: false, arg: 0 },
      { id: 'B1', atMs: BEAT_MS.stepBackPerTile, soft: false, arg: 1 },
    ]);
    expect(cuesForBeat(beat('snakeBlocked', [{ type: 'SnakeBlocked', player: 'p0', tile: 47, effectId: 'e1', visibility: 'public' }]), ctx)).toEqual([{ id: 'B2', atMs: 0, soft: false }]);
  });

  it('stings a face-off and ducks the music; results only for my own face-off', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
    expect(cuesForBeat(beat('faceOff', [started]), ctx)).toEqual([{ id: 'F1', atMs: 0, soft: false, duck: FACE_OFF_DUCK_S }]);
    const result = (winner: PlayerId | null, losers: PlayerId[], outcome: 'win' | 'replay', players: PlayerId[] = ['p0', 'p1']): GameEvent => ({
      type: 'ChallengeResolved',
      challengeId: 'c1',
      pickRound: 1,
      picks: Object.fromEntries(players.map((p) => [p, 'rock'])),
      winner,
      losers,
      outcome,
      visibility: 'public',
    });
    expect(cuesForBeat(beat('faceOffResult', [result('p0', ['p1'], 'win')]), ctx)).toEqual([{ id: 'F3', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result('p1', ['p0'], 'win')]), ctx)).toEqual([{ id: 'F4', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result(null, [], 'replay')]), ctx)).toEqual([{ id: 'F5', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('faceOffResult', [result('p2', ['p3'], 'win', ['p2', 'p3'])]), ctx)).toEqual([]);
  });

  it('flips the revealed cards and sounds each resolution, softly when it is not about me', () => {
    const picked = (player: PlayerId): GameEvent => ({ type: 'CardSelected', player, cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false, visibility: 'public' });
    expect(cuesForBeat(beat('cardReveal', [picked('p0'), picked('p2')]), ctx)).toEqual([{ id: 'C4', atMs: 0, soft: false, arg: 2 }]);
    const resolved = (caster: PlayerId, target: PlayerId | null, result: 'hit' | 'blocked' | 'fizzled'): GameEvent => ({ type: 'CardResolved', caster, cardId: 'shove', target, result, visibility: 'public' });
    expect(cuesForBeat(beat('cardResolved', [resolved('p1', 'p0', 'hit')]), ctx)).toEqual([{ id: 'C5', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('cardResolved', [resolved('p1', 'p2', 'blocked')]), ctx)).toEqual([{ id: 'B2', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('cardResolved', [resolved('p0', null, 'fizzled')]), ctx)).toEqual([{ id: 'C6', atMs: 0, soft: false }]);
    expect(cuesForBeat(beat('clash', [{ type: 'Clash', cardIds: ['a', 'b'], casters: ['p1', 'p2'], players: ['p3'], visibility: 'public' }]), ctx)).toEqual([{ id: 'C7', atMs: 0, soft: true }]);
    expect(cuesForBeat(beat('boardEdit', [{ type: 'BoardEditExpired', editId: 'x', restored: [], dropped: [], visibility: 'public' }]), ctx)).toEqual([{ id: 'C9', atMs: 0, soft: false }]);
  });

  it('plays my win or another win with the music fading, then a pop per place, last place first', () => {
    expect(cuesForBeat(beat('victory', [won('p0', [])]), ctx)).toEqual([{ id: 'W1', atMs: 0, soft: false, musicOut: true }]);
    expect(cuesForBeat(beat('victory', [won('p2', [])]), ctx)).toEqual([{ id: 'W2', atMs: 0, soft: false, musicOut: true }]);
    const ranks = won('p2', [['p2', 1], ['p0', 2], ['p1', 3], ['p3', 3]]);
    expect(cuesForBeat(beat('ranks', [ranks]), ctx)).toEqual([
      { id: 'W3', atMs: 0, soft: false, arg: 3 },
      { id: 'W3', atMs: BEAT_MS.rankStep, soft: false, arg: 2 },
    ]);
  });

  it('plays nothing for HUD-only beats', () => {
    expect(cuesForBeat(beat('info', [{ type: 'RoundStarted', round: 2, visibility: 'public' }]), ctx)).toEqual([]);
  });
});

describe('cues from the log (spec #3 §5)', () => {
  it('sparkles when I land on a "?", zings when a card changes my move, and shimmers when an effect lands on me', () => {
    const effect = (owner: PlayerId): GameEvent => ({
      type: 'EffectAdded',
      effect: { id: 'e1', owner, sourceCard: 'shield', sourcePlayer: owner, params: { hook: 'block', blocks: 'attack' }, lifetime: { charges: 1 }, createdRound: 1, order: 1 },
      visibility: 'public',
    } as unknown as GameEvent);
    const entries = log([
      { type: 'MysteryOffered', player: 'p0', tile: 9, rarity: 'rare', cards: ['shield', 'aegis', 'sprint'], visibility: { private: 'p0' } },
      { type: 'DiceTotaled', player: 'p0', faces: [6], total: 12, visibility: 'public' },
      { type: 'DiceTotaled', player: 'p1', faces: [2], total: 5, visibility: 'public' },
      effect('p0'),
      effect('p1'),
    ]);
    expect(cuesForLog(entries, 'p0', 6)).toEqual([
      { id: 'B3', atMs: 0, soft: false },
      { id: 'D6', atMs: 0, soft: false },
      { id: 'C10', atMs: 0, soft: false },
    ]);
    expect(cuesForLog(log([{ type: 'DiceTotaled', player: 'p0', faces: [6], total: 3, visibility: 'public' }]), 'p0', 6)).toEqual([{ id: 'D7', atMs: 0, soft: false }]);
    expect(cuesForLog(log([{ type: 'DiceTotaled', player: 'p0', faces: [4], total: 4, visibility: 'public' }]), 'p0', 4)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run apps/client/test/cues.test.ts`. Expected: FAIL, because `../src/audio/cues` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/cues.ts`:

```ts
import type { GameEvent, PlayerId } from '@laddorious/core';
import { BEAT_MS, type Beat } from '../director/beats';
import type { LoggedEvent } from '../director/director';
import { stackOn } from '../director/presentation';
import type { Cue } from './engine';

// What plays when (spec #3 §5): pure mappings from the director's beats, and from the
// zero-length events that only reach its log, to sounds. Times are unscaled.

export interface CueContext {
  me: PlayerId;
  boardSize: number;
}

export const FACE_OFF_DUCK_S = 1.2;
export const OTHER_ROLL_STAGGER_MS = 60;

type MovedEvent = Extract<GameEvent, { type: 'Moved' }>;

const movesIn = (beat: Beat) => beat.events.filter((e): e is MovedEvent => e.type === 'Moved');
const tilesOf = (e: MovedEvent, size: number) => (e.bounced ? size - e.from + (size - e.to) : Math.abs(e.to - e.from));
const cue = (id: Cue['id'], atMs: number, soft: boolean, extra: Partial<Cue> = {}): Cue => ({ id, atMs, soft, ...extra });

export function cuesForBeat(beat: Beat, { me, boardSize }: CueContext): Cue[] {
  const moves = movesIn(beat);
  const mineMoving = moves.some((e) => e.player === me);
  const longest = moves.length > 0 ? moves.reduce((a, b) => (tilesOf(b, boardSize) > tilesOf(a, boardSize) ? b : a)) : null;
  const tiles = longest ? tilesOf(longest, boardSize) : 0;

  switch (beat.kind) {
    case 'roll': {
      const cues: Cue[] = [];
      let others = 0;
      for (const e of beat.events) {
        if (e.type !== 'DieRolled') continue;
        if (e.player === me) {
          cues.push(cue('D2', 0, false));
          if (e.forced) cues.push(cue('D5', 850, false));
        } else {
          cues.push(cue('D3', OTHER_ROLL_STAGGER_MS * others++, true));
        }
      }
      return cues;
    }
    case 'move': {
      const soft = !mineMoving;
      const cues = Array.from({ length: tiles }, (_, i) => cue('H1', i * BEAT_MS.hopPerTile, soft, { arg: i }));
      const stacked = moves.some((e) => stackOn(beat.after, e.to).length > 1);
      cues.push(cue(stacked ? 'H3' : 'H2', tiles * BEAT_MS.hopPerTile, soft));
      return cues;
    }
    case 'cardMove': {
      const soft = !mineMoving;
      const forward = longest ? longest.to > longest.from : true;
      const gap = BEAT_MS.cardMove / (tiles + 1);
      const cues = Array.from({ length: tiles }, (_, i) => cue(forward ? 'H1' : 'B1', Math.round(i * gap), soft, { arg: i }));
      cues.push(cue('H2', BEAT_MS.cardMove - BEAT_MS.landing, soft));
      return cues;
    }
    case 'stepBack':
      return Array.from({ length: tiles }, (_, i) => cue('B1', i * BEAT_MS.stepBackPerTile, !mineMoving, { arg: i }));
    case 'slide':
      return [cue('S1', 0, !mineMoving)];
    case 'launch':
      return [cue('L1', 0, !mineMoving)];
    case 'knockback':
      return [cue('K1', 0, !mineMoving)];
    case 'snakeBlocked':
      return [cue('B2', 0, !beat.events.some((e) => e.type === 'SnakeBlocked' && e.player === me))];
    case 'faceOff': {
      const mine = beat.events.some((e) => e.type === 'ChallengeStarted' && e.players.includes(me));
      return [cue('F1', 0, !mine, { duck: FACE_OFF_DUCK_S })];
    }
    case 'faceOffResult': {
      const result = beat.events.find((e) => e.type === 'ChallengeResolved');
      if (result?.type !== 'ChallengeResolved' || !(me in result.picks)) return [];
      if (result.losers.includes(me)) return [cue('F4', 0, false)];
      if (result.winner === me) return [cue('F3', 0, false)];
      return [cue('F5', 0, false)];
    }
    case 'cardReveal':
      return [cue('C4', 0, false, { arg: beat.events.filter((e) => e.type === 'CardSelected').length })];
    case 'cardResolved': {
      const e = beat.events[0];
      if (e?.type !== 'CardResolved') return [];
      const id = e.result === 'hit' ? 'C5' : e.result === 'blocked' ? 'B2' : 'C6';
      return [cue(id, 0, e.caster !== me && e.target !== me)];
    }
    case 'clash': {
      const e = beat.events.find((x) => x.type === 'Clash');
      const mine = e?.type === 'Clash' && (e.players.includes(me) || e.casters.includes(me));
      return [cue('C7', 0, !mine)];
    }
    case 'boardEdit':
      return beat.events.flatMap((e) => (e.type === 'BoardEdited' ? [cue('C8', 0, false)] : e.type === 'BoardEditExpired' ? [cue('C9', 0, false)] : []));
    case 'victory': {
      const e = beat.events.find((x) => x.type === 'MatchWon');
      return e?.type === 'MatchWon' ? [cue(e.winner === me ? 'W1' : 'W2', 0, false, { musicOut: true })] : [];
    }
    case 'ranks': {
      const e = beat.events.find((x) => x.type === 'MatchWon');
      if (e?.type !== 'MatchWon') return [];
      const order = [...new Set(e.rankings.filter((r) => r.player !== e.winner).map((r) => r.rank))].sort((a, b) => b - a);
      return order.map((rank, i) => cue('W3', i * BEAT_MS.rankStep, false, { arg: rank }));
    }
    default:
      return [];
  }
}

/** Cues for new log entries: the events that play as zero-length beats. */
export function cuesForLog(entries: readonly LoggedEvent[], me: PlayerId, myFace: number | null): Cue[] {
  const cues: Cue[] = [];
  for (const { event: e } of entries) {
    if (e.type === 'MysteryOffered' && e.player === me) cues.push(cue('B3', 0, false));
    else if (e.type === 'DiceTotaled' && e.player === me && myFace !== null && e.total !== myFace) cues.push(cue(e.total > myFace ? 'D6' : 'D7', 0, false));
    else if (e.type === 'EffectAdded' && e.effect.owner === me) cues.push(cue('C10', 0, false));
  }
  return cues;
}
```

- [ ] **Step 4: Run it again.** Same command. Expected: PASS (10 tests). Then `pnpm exec tsc -p apps/client`. Expected: no errors.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): map beats and events to sound cues"` (with the trailer).

### Task 6: The sound provider and the app's music

**Files:**
- Create: `apps/client/src/audio/SoundProvider.tsx`, `apps/client/test/soundProvider.test.tsx`
- Modify: `apps/client/src/main.tsx`, `apps/client/src/app/App.tsx`, `apps/client/test/App.test.tsx`

**Interfaces:**
- **Consumes:** `AudioEngine` (Task 4), `isSoundId` (Task 2), `PrefsState` (Task 1).
- **Produces:**
  - `SoundProvider({ engine, prefs, children })`;
  - `useSound(): AudioEngine` (a silent engine when there is no provider);
  - the `data-sound` / `data-sound-arg` button convention: no attribute plays U1, `"none"` plays nothing, and a code plays that sound with its arg.

- [ ] **Step 1: Write the failing test.** Create `apps/client/test/soundProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrefsStore } from '../src/app/prefs';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider, useSound } from '../src/audio/SoundProvider';

afterEach(cleanup);

function setup() {
  const engine = new AudioEngine(() => new Promise(() => {}));
  const spies = {
    unlock: vi.spyOn(engine, 'unlock'),
    playNow: vi.spyOn(engine, 'playNow'),
    setSound: vi.spyOn(engine, 'setSound'),
    suspend: vi.spyOn(engine, 'suspend'),
    resume: vi.spyOn(engine, 'resume'),
  };
  const prefs = createPrefsStore(null, { prefersReducedMotion: false });
  render(
    <SoundProvider engine={engine} prefs={prefs}>
      <button type="button">Plain</button>
      <button type="button" data-sound="none">
        Silent
      </button>
      <button type="button" data-sound="U2" data-sound-arg="3">
        Dragon
      </button>
      <button type="button" disabled>
        Off
      </button>
    </SoundProvider>,
  );
  return { engine, prefs, ...spies };
}

describe('SoundProvider (spec #3 §3, §4, §7)', () => {
  it('unlocks sound on the first tap or key', () => {
    const { unlock } = setup();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it('clicks every button, unless it names its own sound or none', () => {
    const { playNow } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Silent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(playNow.mock.calls).toEqual([['U1', undefined], ['U2', 3]]);
  });

  it('applies the saved sound settings, and follows changes', () => {
    const { prefs, setSound } = setup();
    expect(setSound).toHaveBeenLastCalledWith({ muted: false, effects: 0.8, music: 0.6 });
    act(() => prefs.getState().setMuted(true));
    expect(setSound).toHaveBeenLastCalledWith({ muted: true, effects: 0.8, music: 0.6 });
  });

  it('suspends while the page is hidden and resumes on return', () => {
    const { suspend, resume } = setup();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    fireEvent(document, new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    fireEvent(document, new Event('visibilitychange'));
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('gives a silent engine to components outside a provider', () => {
    let engine: AudioEngine | null = null;
    function Probe() {
      engine = useSound();
      return null;
    }
    render(<Probe />);
    expect(() => engine!.playNow('U1')).not.toThrow();
  });
});
```

In `apps/client/test/App.test.tsx`, add a test that the music follows the screen. Render `App` inside `SoundProvider` with an engine whose `music` is spied:

```tsx
  it('plays the menu loop on the menu and in matchmaking, the match loop in a match (spec #3 §6)', () => {
    const engine = new AudioEngine(() => new Promise(() => {}));
    const music = vi.spyOn(engine, 'music');
    const { findMatch } = setup({ wrap: (app) => <SoundProvider engine={engine} prefs={prefsOf(app)}>{app}</SoundProvider> });
    expect(music).toHaveBeenLastCalledWith('menu');
    // …then into matchmaking and a match, as the existing route test does…
  });
```

How `setup()` takes the wrapper depends on its current shape. Read `App.test.tsx`'s `setup` first and give it an optional `wrap` parameter, so the existing tests are unchanged. Then make the new test reach a match the same way "goes menu → matchmaking → match → end" does, and expect `music` to have been called with `'menu'` and then `'match'`.

- [ ] **Step 2: Run them.** `pnpm vitest run apps/client/test/soundProvider.test.tsx apps/client/test/App.test.tsx`. Expected: FAIL, because `../src/audio/SoundProvider` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/SoundProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { PrefsState } from '../app/prefs';
import { AudioEngine } from './engine';
import { isSoundId } from './sounds';

// Sound for the whole app (spec #3 §3, §4, §7): the engine, the first-tap unlock, pausing
// while hidden, the saved settings, and a click for every button.

/** Outside a provider (some tests), sound is a silent engine that never loads. */
const SILENT = new AudioEngine(() => new Promise(() => {}));

const SoundContext = createContext<AudioEngine>(SILENT);

export const useSound = (): AudioEngine => useContext(SoundContext);

export function SoundProvider({ engine, prefs, children }: { engine: AudioEngine; prefs: StoreApi<PrefsState>; children: ReactNode }) {
  const sound = useStore(prefs, (s) => s.settings.sound);

  useEffect(() => engine.setSound(sound), [engine, sound]);

  useEffect(() => {
    const unlock = () => engine.unlock();
    const onVisibility = () => (document.hidden ? engine.suspend() : engine.resume());
    // Buttons click by default; data-sound names another sound, or "none" (spec #3 §5).
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) return;
      const id = button.dataset.sound ?? 'U1';
      if (!isSoundId(id)) return;
      const arg = button.dataset.soundArg;
      engine.playNow(id, arg === undefined ? undefined : Number(arg));
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick);
    };
  }, [engine]);

  return <SoundContext.Provider value={engine}>{children}</SoundContext.Provider>;
}
```

In `apps/client/src/main.tsx`, create the engine with the lazy loader and wrap the app:

```tsx
import { AudioEngine } from './audio/engine';
import { SoundProvider } from './audio/SoundProvider';
// …
// Tone loads as its own chunk after the first tap (spec #3 A3).
const sound = new AudioEngine(() => import('tone'));
// …
    <SoundProvider engine={sound} prefs={prefs}>
      <App service={service} prefs={prefs} dev={import.meta.env.DEV} test={test} />
    </SoundProvider>
```

In `apps/client/src/app/App.tsx`, after the route state:

```tsx
  // The music follows the screen (spec #3 §6); the win fades it out, and the end screen stays quiet.
  const sound = useSound();
  useEffect(() => {
    sound.music(route.screen === 'menu' || route.screen === 'matchmaking' ? 'menu' : route.screen === 'match' ? 'match' : null);
  }, [route.screen, sound]);
```

On `'end'`, the `music(null)` call is a no-op after the victory fade (the engine's song is already null).

- [ ] **Step 4: Run them again.** Same command. Expected: PASS. Then `pnpm test`. Expected: all green.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): add the sound provider, first-tap unlock and screen music"` (with the trailer).

### Task 7: Match sounds and the mute button

**Files:**
- Create: `apps/client/src/audio/useMatchSound.ts`, `apps/client/test/matchSound.test.tsx`
- Modify:
  - `apps/client/src/app/MatchScreen.tsx`;
  - `apps/client/src/app/App.tsx` (the `muted` and `onToggleMute` props);
  - `apps/client/src/app/match.css` (`.sound-btn`);
  - `apps/client/src/hud/labels.ts` (`IconName` gains `'speaker' | 'speaker-off'`);
  - `apps/client/src/ui/Icon.tsx` (two paths);
  - `apps/client/src/hud/Dock.tsx` (`data-sound="none"` on ROLL);
  - `apps/client/src/hud/FaceOffPopup.tsx` (`data-sound="F2"` on the choices);
  - `apps/client/src/hud/CardPickPopup.tsx` (`data-sound="C3"` on the cards, `data-sound="C2"` on reroll);
  - `apps/client/test/MatchScreen.test.tsx`.

**Interfaces:**
- **Consumes:** `cuesForBeat`, `cuesForLog` (Task 5); `useSound` (Task 6).
- **Produces:**
  - `useMatchSound(director, me, boardSize, timeScale)`;
  - `MatchScreen` props `muted?: boolean`, `onToggleMute?: () => void`;
  - `TICK_WINDOW_S = 3`.

- [ ] **Step 1: Write the failing tests.** Create `apps/client/test/matchSound.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrefsStore } from '../src/app/prefs';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider } from '../src/audio/SoundProvider';
import { useMatchSound } from '../src/audio/useMatchSound';
import { Director } from '../src/director/director';
import { openingUpdate } from './support/fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(timeScale = 1) {
  const engine = new AudioEngine(() => new Promise(() => {}));
  const play = vi.spyOn(engine, 'play');
  const playNow = vi.spyOn(engine, 'playNow');
  const director = new Director('p0', () => {}, vi.fn(), timeScale);
  function Probe() {
    useMatchSound(director, 'p0', 100, timeScale);
    return null;
  }
  render(
    <SoundProvider engine={engine} prefs={createPrefsStore(null, { prefersReducedMotion: false })}>
      <Probe />
    </SoundProvider>,
  );
  const push = (events: GameEvent[], awaiting = openingUpdate().view.awaiting, timer: { windowId: number; endsAt: number } | null = null) =>
    act(() => director.push({ ...openingUpdate(), view: { ...openingUpdate().view, awaiting }, events, timer }));
  return { play, playNow, push };
}

const rolled = (player: string, face: number): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced: false, auto: false, visibility: 'public' });

describe('useMatchSound (spec #3 §5)', () => {
  it("plays each beat's cues as it starts, scaled by the director's time scale", () => {
    const { play, push } = setup(0.5);
    push([rolled('p1', 2), rolled('p0', 5)]);
    expect(play.mock.calls.map(([c]) => [c.id, c.atMs, c.soft])).toEqual([
      ['D3', 0, true],
      ['D2', 0, false],
    ]);
  });

  it('zings when my total differs from my face, from the log', () => {
    const { play, push } = setup();
    push([rolled('p0', 6)]);
    act(() => vi.advanceTimersByTime(1000));
    push([{ type: 'DiceTotaled', player: 'p0', faces: [6], total: 12, visibility: 'public' }]);
    expect(play.mock.calls.at(-1)![0]).toMatchObject({ id: 'D6' });
  });

  it('chimes once when a dice window opens for me, and ticks in its last 3 seconds', () => {
    const { playNow, push } = setup();
    const awaiting = { windowId: 2, window: 'dice' as const, players: ['p0', 'p1'], durationMs: 12_000 };
    push([], awaiting, { windowId: 2, endsAt: 5_000 });
    expect(playNow).toHaveBeenCalledWith('D1');
    act(() => vi.advanceTimersByTime(2_100));
    expect(playNow.mock.calls.filter(([id]) => id === 'D4')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(2_000));
    expect(playNow.mock.calls.filter(([id]) => id === 'D4')).toHaveLength(3);
    expect(playNow.mock.calls.filter(([id]) => id === 'D1')).toHaveLength(1);
  });
});
```

In `apps/client/test/MatchScreen.test.tsx`:
- render through a `SoundProvider` whose engine's `playNow` is spied (extend `start()` to accept an engine and pass `muted`/`onToggleMute`);
- add tests that:
  - the card pick opening plays `C1`;
  - a rejection plays `U4`;
  - the speaker button (`Mute sound`) calls `onToggleMute`, and reads `Turn sound on` when `muted`;
  - ROLL carries `data-sound="none"`, the face-off choices `F2`, the cards `C3` and reroll `C2`.

- [ ] **Step 2: Run them.** `pnpm vitest run apps/client/test/matchSound.test.tsx apps/client/test/MatchScreen.test.tsx`. Expected: FAIL, because `../src/audio/useMatchSound` is missing.

- [ ] **Step 3: Implement.** Create `apps/client/src/audio/useMatchSound.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import { useEffect } from 'react';
import type { Director } from '../director/director';
import { cuesForBeat, cuesForLog } from './cues';
import type { Cue } from './engine';
import { useSound } from './SoundProvider';

/** The last seconds of a window that waits for me tick once a second (spec #3 §5). */
export const TICK_WINDOW_S = 3;

/**
 * A match's sounds (spec #3 §5): each beat's cues as it starts, the log's zero-length events,
 * the dice-window chime, and the last-seconds ticks. Times follow the director's time scale.
 */
export function useMatchSound(director: Director, me: PlayerId, boardSize: number, timeScale: number): void {
  const engine = useSound();
  useEffect(() => {
    let myFace: number | null = null;
    let chimed = -1;
    let tickWindow = -1;
    let lastTick = 0;
    const scaled = (c: Cue): Cue => ({ ...c, atMs: c.atMs * timeScale, ...(c.duck === undefined ? {} : { duck: c.duck * timeScale }) });

    const off = director.store.subscribe((state, prev) => {
      if (state.beat && state.beat !== prev.beat) {
        for (const e of state.beat.events) if (e.type === 'DieRolled' && e.player === me) myFace = e.face;
        for (const c of cuesForBeat(state.beat, { me, boardSize })) engine.play(scaled(c));
      }
      if (state.log !== prev.log) {
        const after = prev.log.at(-1)?.seq ?? 0;
        for (const c of cuesForLog(state.log.filter((l) => l.seq > after), me, myFace)) engine.play(scaled(c));
      }
      const timer = state.settled?.timer;
      const aw = state.settled?.view.awaiting;
      if (timer && aw?.window === 'dice' && aw.players.includes(me) && timer.windowId !== chimed) {
        chimed = timer.windowId;
        engine.playNow('D1');
      }
    });

    const ticker = setInterval(() => {
      const settled = director.store.getState().settled;
      const timer = settled?.timer;
      const aw = settled?.view.awaiting;
      if (!timer || !aw || !aw.players.includes(me)) return;
      if (timer.windowId !== tickWindow) {
        tickWindow = timer.windowId;
        lastTick = 0;
      }
      const left = Math.ceil((timer.endsAt - Date.now()) / 1000);
      if (left >= 1 && left <= TICK_WINDOW_S && left !== lastTick) {
        lastTick = left;
        engine.playNow('D4');
      }
    }, 200);

    return () => {
      off();
      clearInterval(ticker);
    };
  }, [director, engine, me, boardSize, timeScale]);
}
```

In `apps/client/src/app/MatchScreen.tsx`:
- add `muted?: boolean` and `onToggleMute?: () => void` to the props;
- `const sound = useSound();`;
- `useMatchSound(director, me, settled?.view.board.size ?? 100, timeScale);`;
- in the `onRejected` handler, call `sound.playNow('U4')` before the toast (add `sound` to that effect's dependencies);
- after `cardPick` is computed:

```tsx
  // The card pick fans out (spec #3 §5).
  const pickWindow = cardPick ? view?.awaiting.windowId ?? null : null;
  useEffect(() => {
    if (pickWindow !== null) sound.playNow('C1');
  }, [pickWindow, sound]);
```

Next to the "Leave match" button, add:

```tsx
        {onToggleMute && (
          <button type="button" className="round-btn sound-btn live" aria-label={muted ? 'Turn sound on' : 'Mute sound'} data-sound="U3" data-sound-arg={muted ? 1 : 0} onClick={onToggleMute}>
            <Icon name={muted ? 'speaker-off' : 'speaker'} />
          </button>
        )}
```

In `App.tsx`, pass `muted={settings.sound.muted}` and `onToggleMute={() => prefs.getState().setMuted(!prefs.getState().settings.sound.muted)}` to `MatchScreen`.

In `match.css`:

```css
/* Quick mute, left of the menu button (spec #3 §4). */
.sound-btn {
  position: absolute;
  right: calc(var(--safe-r) + var(--edge) + max(44px, 8cqh) + 10px);
  top: calc(var(--safe-t) + var(--edge));
}
```

In `labels.ts`, add `'speaker' | 'speaker-off'` to `IconName`. In `Icon.tsx` `PATHS`:

```tsx
  speaker: (
    <>
      <path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z" />
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" {...stroke} />
    </>
  ),
  'speaker-off': (
    <>
      <path d="M3.5 9h4l5-4.5v15l-5-4.5h-4z" />
      <path d="M16 9l5 6M21 9l-5 6" {...stroke} />
    </>
  ),
```

Add the `data-sound` attributes in `Dock.tsx` (ROLL: `data-sound="none"`), `FaceOffPopup.tsx` (each choice: `data-sound="F2"`) and `CardPickPopup.tsx` (each `pick-card`: `data-sound="C3"`; each `reroll-btn`: `data-sound="C2"`).

- [ ] **Step 4: Run them again.** Same command. Expected: PASS. Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green (`test/tokens.test.ts` included).

- [ ] **Step 5: Commit.** `git commit -m "feat(client): play the match's sounds and add a quick mute button"` (with the trailer).

### Task 8: Menu, matchmaking, end screen and settings sounds

**Files:**
- Modify:
  - `apps/client/src/app/MenuScreen.tsx` (`data-sound="U2"` and `data-sound-arg` on the picker tiles and arrows);
  - `apps/client/src/app/MatchmakingOverlay.tsx` (Q1–Q3);
  - `apps/client/src/app/EndScreen.tsx` (W4);
  - `apps/client/src/app/SettingsDialog.tsx` (the Sound group; `data-sound="U3"` on the switches);
  - `apps/client/src/app/screens.css` (slider rows).
- Test: `apps/client/test/screens.test.tsx`, `apps/client/test/MenuScreen.test.tsx`

**Interfaces:**
- **Consumes:** `useSound` (Task 6); `setMuted`, `setEffectsVolume`, `setMusicVolume` (Task 1).

- [ ] **Step 1: Write the failing tests.** In `test/screens.test.tsx`, add to the `SettingsDialog` block:

```tsx
  it('mutes sound and sets the effects and music volumes (spec #3 §4)', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: false, shortSide: 900 }} onClose={() => {}} />);
    const mute = screen.getByRole('switch', { name: 'Mute sound' });
    expect(mute.getAttribute('data-sound')).toBe('U3');
    fireEvent.click(mute);
    expect(prefs.getState().settings.sound.muted).toBe(true);
    fireEvent.change(screen.getByRole('slider', { name: 'Effects volume' }), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), { target: { value: '25' } });
    expect(prefs.getState().settings.sound).toEqual({ muted: true, effects: 0.4, music: 0.25 });
  });
```

Add to the `MatchmakingOverlay` and `EndScreen` tests: render inside a `SoundProvider` whose engine's `playNow` is spied. Then:
- matchmaking: `Q1` with args 0, 1, 2 as bots fill seats 2–4 (drive it with the scripted matchmaking), and `Q2` then `Q3` when the match is found;
- end screen: `W4` once on mount.

In `test/MenuScreen.test.tsx`, expect the dragon tile to carry `data-sound="U2"` and `data-sound-arg="3"`, and the "next" arrow from the knight to carry `data-sound-arg="1"`.

- [ ] **Step 2: Run them.** `pnpm vitest run apps/client/test/screens.test.tsx apps/client/test/MenuScreen.test.tsx`. Expected: FAIL (no Sound controls, no cues).

- [ ] **Step 3: Implement.**

In `SettingsDialog.tsx`, add a "Sound" row after Reduced motion:

```tsx
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={soundId}>
            Sound
          </b>
          <span>Effects and music. Your own moments play louder than other players'.</span>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-label="Mute sound"
          aria-checked={settings.sound.muted}
          data-sound="U3"
          data-sound-arg={settings.sound.muted ? 1 : 0}
          onClick={() => prefs.getState().setMuted(!settings.sound.muted)}
        />
      </div>
      <div className="setting-row volume-row" role="group" aria-labelledby={soundId}>
        <label className="volume">
          <span>Effects</span>
          <input type="range" min={0} max={100} step={5} aria-label="Effects volume" value={Math.round(settings.sound.effects * 100)} onChange={(e) => prefs.getState().setEffectsVolume(Number(e.target.value) / 100)} />
        </label>
        <label className="volume">
          <span>Music</span>
          <input type="range" min={0} max={100} step={5} aria-label="Music volume" value={Math.round(settings.sound.music * 100)} onChange={(e) => prefs.getState().setMusicVolume(Number(e.target.value) / 100)} />
        </label>
      </div>
```

with `const soundId = useId();`. Give the reduced-motion switch `data-sound="U3" data-sound-arg={settings.reducedMotion ? 0 : 1}`.

In `screens.css`:

```css
/* Sound volumes (spec #3 §4). */
.volume-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: max(10px, 2cqh);
}

.volume {
  display: grid;
  gap: 4px;
  font-weight: 600;
}

.volume input {
  width: 100%;
  min-height: 44px;
  accent-color: var(--primary);
}
```

In `MenuScreen.tsx`:
- each picker tile gets `data-sound="U2" data-sound-arg={PIECES.indexOf(piece)}`;
- each arrow gets `data-sound="U2"` and `data-sound-arg` set to the index of the piece it selects (`(i + step + PIECES.length) % PIECES.length`).

In `MatchmakingOverlay.tsx`, with `const sound = useSound();`:

```tsx
  // A pop per bot taking a seat, then MATCH FOUND and the countdown (spec #3 §5).
  const filled = state && (state.kind === 'searching' || state.kind === 'filling') ? state.seats.filter(Boolean).length : 0;
  const seatedRef = useRef(1);
  useEffect(() => {
    if (state?.kind === 'filling' && filled > seatedRef.current) sound.playNow('Q1', filled - 2);
    seatedRef.current = Math.max(seatedRef.current, filled);
  }, [state, filled, sound]);
  useEffect(() => {
    if (!found) return;
    sound.playNow('Q2');
    sound.playNow('Q3');
  }, [found, sound]);
```

In `EndScreen.tsx`, with `const sound = useSound();` and a ref so it plays once even under StrictMode's double effect:

```tsx
  const playedRef = useRef(false);
  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    sound.playNow('W4');
  }, [sound]);
```

- [ ] **Step 4: Run them again.** Same command. Expected: PASS. Then `pnpm test`. Expected: all green.

- [ ] **Step 5: Commit.** `git commit -m "feat(client): sound for the menu, matchmaking, end screen and settings"` (with the trailer).

### Task 9: E2e sound check and the Tone chunk

**Files:**
- Modify:
  - `apps/client/src/app/testMode.ts` (`soundStats` on the hooks);
  - `apps/client/src/main.tsx` (pass the engine's stats);
  - `apps/client/test/testMode.test.tsx`;
  - `apps/client/e2e/game.spec.ts`.

**Interfaces:**
- **Consumes:** `AudioEngine.stats()`, `SoundStats` (Task 4).
- **Produces:** `TestHooks.soundStats(): SoundStats`; `testHooks(mode?, soundStats?)`.

- [ ] **Step 1: Write the failing test.** In `test/testMode.test.tsx`, expect `testHooks('e2e', () => ({ started: true, played: 3, errors: 0 }))!.soundStats()` to equal `{ started: true, played: 3, errors: 0 }`. In `e2e/game.spec.ts`, after the end heading in the whole-match test:

```ts
  // Sound ran through the whole match without a single error (spec #3 §7).
  const sound = await page.evaluate(() => window.__laddoriousTest!.soundStats());
  expect(sound.started).toBe(true);
  expect(sound.played).toBeGreaterThan(0);
  expect(sound.errors).toBe(0);
```

- [ ] **Step 2: Run it.** `pnpm vitest run apps/client/test/testMode.test.tsx`. Expected: FAIL (no `soundStats`).

- [ ] **Step 3: Implement.** In `testMode.ts`:
- import `type SoundStats` from `'../audio/engine'`;
- add `soundStats(): SoundStats;` to `TestHooks`;
- change the signature to `testHooks(mode: string = import.meta.env.MODE, soundStats: () => SoundStats = () => ({ started: false, played: 0, errors: 0 }))`;
- include `soundStats` in the hooks object.

In `main.tsx`, create `sound` before the hooks and call `testHooks(undefined, () => sound.stats())`.

- [ ] **Step 4: Run it again.** Same command. Expected: PASS. Then:
- `pnpm build`, and check that Tone sits in its own chunk:
  `node -e "const fs=require('fs');const d='apps/client/dist/assets';const f=fs.readdirSync(d).filter(n=>n.endsWith('.js'));const withTone=f.filter(n=>fs.readFileSync(d+'/'+n,'utf8').includes('MembraneSynth'));console.log(withTone)"`.
  Expected: exactly one chunk, not the `index-*.js` entry.
- `pnpm e2e`. Expected: 9 passed, including the sound check.

- [ ] **Step 5: Commit.** `git commit -m "test(client): check sound runs a whole match without errors"` (with the trailer).

### Task 10: Docs, gate and handoff

**Files:**
- Modify:
  - `apps/client/README.md`: a "Sound" section covering where the code lives, the sound board as the tuning reference, how to add or retune a sound (recipe and trim), the mute and volume settings, and that Tone loads after the first tap;
  - `README.md`: the Spec #3 line says "sound design (done)";
  - `docs/superpowers/HANDOFF.md`: a Spec #3 row with commits and suite counts; next step, Spec #4 (server); deferred minors.

- [ ] **Step 1: Write the docs** as listed above.
- [ ] **Step 2: Gate.**
  - Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e`. Expected: all green.
  - Browser check in the dev server: the first tap starts sound, the menu loop plays, matchmaking pops, match sounds play in sync, mute works, and the settings sliders work.
- [ ] **Step 3: Commit.** `git commit -m "docs: hand off after spec #3 (sound design)"` (with the trailer).

After Task 10:
1. Self-review against this plan's Review Focus, and say it was a self-review.
2. Fast-forward merge `audio/spec-3` into `main` locally and run the suite on `main`.
3. Delete the branch, and update memory (`sound-design-spec3`, `handoff`).
