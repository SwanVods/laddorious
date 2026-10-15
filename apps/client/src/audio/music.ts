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

/** Lifts each song to the sound effects' loudness (dB), measured 2026-10-15 like the effects' trims (TRIM in sounds.ts). */
export const SONG_TRIM: Record<SongId, number> = { menu: 9, match: 11 };

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

/** Notes are scheduled this far ahead (s), so a busy main thread can't starve the music; a stall longer than this skips notes rather than firing them late. */
export const MUSIC_AHEAD_S = 1.2;
/** How often the player schedules more notes (ms). */
const TICK_MS = 250;
/** Songs overlap this long (s) as one fades out and the next fades in. */
export const CROSSFADE_S = 1.5;
/** How long a faded-out song keeps its nodes for its last notes' tails (s). */
const TAIL_S = 3;

/** Seconds from the loop's start to a `bars:quarters:sixteenths` time, in 4/4 at `bpm`. */
export function eventSeconds(time: string, bpm: number): number {
  const [bars = 0, quarters = 0, sixteenths = 0] = time.split(':').map(Number);
  return (bars * 4 + quarters + sixteenths / 4) * (60 / bpm);
}

/** A song's notes at seconds into its loop. */
export interface TimedNote {
  at: number;
  e: SongEvent;
}

/** The notes of a loop `loopS` long, begun at `start`, that fall in [from, to), in time order (audio-clock seconds). */
export function dueNotes(notes: readonly TimedNote[], loopS: number, start: number, from: number, to: number): TimedNote[] {
  const due: TimedNote[] = [];
  if (to <= from) return due;
  for (let k = Math.max(0, Math.floor((from - start) / loopS)); start + k * loopS < to; k++) {
    for (const n of notes) {
      const at = start + k * loopS + n.at;
      if (at >= from && at < to) due.push({ at, e: n.e });
    }
  }
  return due.sort((a, b) => a.at - b.at);
}

interface Voice {
  song: Song;
  notes: TimedNote[];
  loopS: number;
  start: number;
  /** Scheduled up to here. */
  until: number;
  /** Fading out: no notes from here on. */
  stopAt: number | null;
  fader: Tone.Volume;
  inst: Instruments;
  nodes: Tone.ToneAudioNode[];
}

/**
 * Plays the songs (2026-10-15): each song has its own instruments and fader and schedules its notes a little
 * ahead in the audio clock, so songs crossfade and a hitch on the main thread doesn't make the music stutter.
 * The engine ducks and fades the bus it plays into.
 */
export class MusicPlayer {
  private current: Voice | null = null;
  private readonly voices = new Set<Voice>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tone: ToneLib,
    private readonly out: Tone.ToneAudioNode,
  ) {}

  /** Crossfade to this song, or fade out to silence with null. */
  play(id: SongId | null): void {
    const now = this.tone.now();
    if (this.current) this.release(this.current, now);
    this.current = null;
    if (id) {
      const song = SONGS[id];
      const fader = new this.tone.Volume(-60).connect(this.out);
      fader.volume.cancelScheduledValues(now);
      fader.volume.setValueAtTime(-60, now);
      fader.volume.linearRampToValueAtTime(SONG_TRIM[id], now + CROSSFADE_S);
      const inst = this.instruments(fader);
      const notes = songEvents(song).map((e) => ({ at: eventSeconds(e.time, song.bpm), e }));
      const start = now + 0.05;
      const voice: Voice = { song, notes, loopS: song.bars.length * 4 * (60 / song.bpm), start, until: start, stopAt: null, fader, inst, nodes: [fader, ...Object.values(inst)] };
      this.voices.add(voice);
      this.current = voice;
      this.schedule(voice, now);
    }
    if (this.voices.size > 0 && this.timer === null) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const now = this.tone.now();
    for (const voice of this.voices) {
      if (voice.stopAt !== null && now > voice.stopAt + TAIL_S) {
        this.voices.delete(voice);
        for (const node of voice.nodes) node.dispose();
      } else this.schedule(voice, now);
    }
    if (this.voices.size === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Schedule the notes due before `now + MUSIC_AHEAD_S`, never any in the past. */
  private schedule(voice: Voice, now: number): void {
    const from = Math.max(voice.until, now + 0.02);
    const to = Math.min(now + MUSIC_AHEAD_S, voice.stopAt ?? Infinity);
    for (const { at, e } of dueNotes(voice.notes, voice.loopS, voice.start, from, to)) this.trigger(voice, e, at);
    voice.until = Math.max(voice.until, to);
  }

  private trigger({ inst, song }: Voice, e: SongEvent, time: number): void {
    const beat = 60 / song.bpm;
    if (e.kind === 'mallet') inst.mallet.triggerAttackRelease(e.note!, beat / 2, time, e.vel);
    else if (e.kind === 'bass') inst.bass.triggerAttackRelease(e.note!, beat / 2, time, 0.8);
    else if (e.kind === 'shaker') inst.shaker.triggerAttackRelease(beat / 8, time, e.vel);
    else if (e.kind === 'kick') inst.kick.triggerAttackRelease('C1', beat / 2, time, 0.7);
    else if (e.kind === 'bell') inst.bell.triggerAttackRelease(e.note!, beat, time, 0.5);
    else inst.pad.triggerAttackRelease(e.notes!, beat * 4, time, 0.5);
  }

  /** Fade a song out over the crossfade; it stops scheduling then, and lets go of its nodes after its tails. */
  private release(voice: Voice, now: number): void {
    voice.stopAt = now + CROSSFADE_S;
    voice.fader.volume.cancelScheduledValues(now);
    voice.fader.volume.setValueAtTime(voice.fader.volume.value, now);
    voice.fader.volume.linearRampToValueAtTime(-60, now + CROSSFADE_S);
  }

  /** A song's own instruments, into its own fader. */
  private instruments(out: Tone.ToneAudioNode): Instruments {
    const t = this.tone;
    const shakerFilter = new t.Filter(6500, 'highpass').connect(out);
    return {
      mallet: new t.PolySynth(t.FMSynth, {
        harmonicity: 3.99, modulationIndex: 2.6, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.4 }, modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }, volume: -10,
      }).connect(out),
      bell: new t.PolySynth(t.FMSynth, {
        harmonicity: 3.5, modulationIndex: 5, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1, sustain: 0, release: 0.8 }, modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 }, volume: -16,
      }).connect(out),
      bass: new t.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.2 }, filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.2, baseFrequency: 180, octaves: 2.5 }, volume: -8 }).connect(out),
      kick: new t.MembraneSynth({ pitchDecay: 0.05, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.05 }, volume: -12 }).connect(out),
      shaker: new t.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.04, sustain: 0, release: 0.02 }, volume: -30 }).connect(shakerFilter),
      pad: new t.PolySynth(t.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.6, decay: 1.5, sustain: 0.5, release: 1.5 }, volume: -24 }).connect(out),
    };
  }
}
