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
  const contexts: unknown[] = [];
  const tone = {
    Context: vi.fn(function (this: { options: unknown }, options: unknown) {
      this.options = options;
    }),
    setContext: vi.fn((c: unknown) => void contexts.push(c)),
    start: vi.fn(async () => {}),
    now: () => 10,
    Volume: FakeVolume,
    Reverb: FakeReverb,
    Limiter: FakeNode,
    getDestination: () => destination,
    getContext: () => ({ rawContext: raw }),
  };
  return { tone: tone as unknown as ToneLib, volumes, destination, raw, contexts };
}

function setup(opts: { fail?: boolean; throwing?: SoundId; latencyHint?: AudioContextLatencyCategory } = {}) {
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
  const engine = new AudioEngine(load, { recipes, music: () => player, warn, latencyHint: opts.latencyHint });
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

  it("wakes the audio on a later tap when the first tap's permission ran out while Tone loaded (2026-10-14)", async () => {
    const { engine, raw } = setup();
    engine.unlock(); // Tone loads after this tap; the browser keeps the audio asleep
    await engine.start();
    expect(raw.resume).not.toHaveBeenCalled();
    engine.unlock(); // any later tap or key wakes it, inside that gesture
    expect(raw.resume).toHaveBeenCalledTimes(1);
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

  it("plays the screen's song once loaded, crossfades to the next at once (2026-10-15), and fades out at the win", async () => {
    const { engine, player } = setup();
    engine.music('menu');
    engine.unlock();
    await engine.start();
    expect(player.play).toHaveBeenLastCalledWith('menu');
    engine.music('match');
    expect(player.play).toHaveBeenLastCalledWith('match');
    engine.play({ id: 'W1', atMs: 0, soft: false, musicOut: true });
    vi.advanceTimersByTime(1100);
    expect(player.play).toHaveBeenLastCalledWith(null);
  });

  it("asks for bigger audio buffers on phones, so a busy frame doesn't make the sound stutter (2026-10-15)", async () => {
    const phone = setup({ latencyHint: 'playback' });
    phone.engine.unlock();
    await phone.engine.start();
    expect(phone.contexts).toEqual([{ options: { latencyHint: 'playback' } }]);
    expect(phone.tone.setContext).toHaveBeenCalledWith(phone.contexts[0], true);
    const desktop = setup();
    desktop.engine.unlock();
    await desktop.engine.start();
    expect(desktop.contexts).toEqual([]);
  });
});
