import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_S, MUSIC_AHEAD_S, MusicPlayer, SONGS, SONG_TRIM, dueNotes, eventSeconds, songEvents } from '../src/audio/music';
import type { ToneLib } from '../src/audio/sounds';

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

  it("lifts each song to the sound effects' level: measured 2026-10-15 (momentary loudness, 400 ms windows)", () => {
    expect(SONG_TRIM).toEqual({ menu: 9, match: 11 });
  });
});

// The player schedules its own notes a little ahead, in the audio clock, instead of on Tone's one transport
// (2026-10-15): songs crossfade, and a busy main thread can't make it fire a late pile of notes.

/** Just enough of Tone for the player: every node is one fake that records its notes and ramps. */
function fakeTone() {
  let now = 0;
  const notes: Array<{ kind: string; time: number }> = [];
  const voices: FakeVolume[] = [];
  class FakeNode {
    connect() {
      return this;
    }
    dispose = vi.fn();
    triggerAttackRelease = vi.fn((...args: unknown[]) => {
      // (note, duration, time, velocity), or a shaker's (duration, time, velocity).
      const time = (typeof args[0] === 'number' ? args[1] : args[2]) as number;
      notes.push({ kind: (this as unknown as { kind?: string }).kind ?? 'synth', time });
    });
  }
  class FakeVolume extends FakeNode {
    ramps: Array<[number, number]> = [];
    volume = {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn((v: number, t: number) => void this.ramps.push([v, t])),
    };
    constructor(public db = 0) {
      super();
      voices.push(this);
    }
  }
  const tone = {
    now: () => now,
    Volume: FakeVolume,
    Filter: FakeNode,
    PolySynth: FakeNode,
    FMSynth: FakeNode,
    Synth: FakeNode,
    MonoSynth: FakeNode,
    MembraneSynth: FakeNode,
    NoiseSynth: FakeNode,
    Frequency: (n: string) => ({ toFrequency: () => n.length }),
  };
  return { tone: tone as unknown as ToneLib, notes, voices, setNow: (t: number) => (now = t) };
}

describe('the music player (2026-10-15)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("times each note in seconds at its song's tempo, loop after loop", () => {
    expect(eventSeconds('1:2:2', 120)).toBeCloseTo(3.25, 6);
    const timed = [{ at: 0, e: { time: '0:0:0', kind: 'kick' as const } }, { at: 1, e: { time: '0:2:0', kind: 'kick' as const } }];
    expect(dueNotes(timed, 2, 10, 10.5, 14).map((n) => n.at)).toEqual([11, 12, 13]);
  });

  it('schedules only a little ahead, and skips the notes a stall made late instead of firing them all at once', () => {
    const { tone, notes, setNow } = fakeTone();
    const player = new MusicPlayer(tone, {} as never);
    player.play('menu');
    expect(notes.length).toBeGreaterThan(0);
    expect(Math.max(...notes.map((n) => n.time))).toBeLessThanOrEqual(MUSIC_AHEAD_S + 0.1);
    // The page hangs for 5 s: no note is scheduled in that past.
    setNow(5);
    const before = notes.length;
    vi.advanceTimersByTime(300);
    expect(notes.slice(before).every((n) => n.time >= 5)).toBe(true);
    expect(notes.length).toBeGreaterThan(before);
    player.play(null);
  });

  it('crossfades: the old song fades out while the new one fades in, then stops', () => {
    const { tone, notes, voices, setNow } = fakeTone();
    const player = new MusicPlayer(tone, {} as never);
    player.play('menu');
    setNow(4);
    vi.advanceTimersByTime(4000);
    player.play('match');
    const [menu, match] = voices.slice(-2);
    expect(menu!.ramps.at(-1)).toEqual([-60, 4 + CROSSFADE_S]);
    expect(match!.ramps.at(-1)).toEqual([SONG_TRIM.match, 4 + CROSSFADE_S]);
    // Long after the fade, the menu song schedules nothing more and lets go of its nodes.
    setNow(20);
    vi.advanceTimersByTime(16000);
    expect(menu!.dispose).toHaveBeenCalled();
    expect(notes.filter((n) => n.time > 4 + CROSSFADE_S + 0.01).length).toBeGreaterThan(0);
    player.play(null);
  });
});
