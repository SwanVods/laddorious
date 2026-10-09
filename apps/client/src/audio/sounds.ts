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
/** One marimba note per piece in picker order (spec #3 §5, spec #5 §4.1). */
export const PIECE_NOTES = ['C5', 'E5', 'G5', 'C6', 'D5', 'A5', 'E6'] as const;
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
    marimba(p, 1.2).triggerAttackRelease(PIECE_NOTES[piece % PIECE_NOTES.length]!, 0.4, t + 0.03, 0.8);
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
