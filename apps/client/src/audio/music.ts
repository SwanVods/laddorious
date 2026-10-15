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

/** Loops one song on Tone's transport; the engine fades and ducks the bus it plays into. */
export class MusicPlayer {
  private part: Tone.Part<SongEvent> | null = null;
  private inst: Instruments | null = null;
  private trim: Tone.Volume | null = null;

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
    this.trim!.volume.value = SONG_TRIM[id];
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
    const out = (this.trim = new t.Volume(0).connect(this.out));
    const shakerFilter = new t.Filter(6500, 'highpass').connect(out);
    this.inst = {
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
    return this.inst;
  }
}
