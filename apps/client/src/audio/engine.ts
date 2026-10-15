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
  /**
   * The audio output's buffer size (2026-10-15): phones ask for "playback", bigger buffers, so a busy frame
   * can't starve the audio thread (the user heard it stutter on Android). Unset keeps the browser's default.
   */
  latencyHint?: AudioContextLatencyCategory;
}

const OTHERS_DB = -7;
const DUCK_DB = 12;
/** The bus comes back up this fast after the win's fade-out; the songs themselves crossfade in the player. */
const BUS_BACK_S = 0.3;
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

  /**
   * A user gesture happened: sound may start now. Tone loads after the first one, and if that took longer
   * than the gesture's permission lasts, the browser keeps the audio asleep; so every gesture also wakes
   * it once Tone is here (2026-10-14: "sometimes the sound doesn't work").
   */
  unlock(): void {
    this.unlocked = true;
    if (this.tone) this.resume();
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
    if (this.opts.latencyHint) tone.setContext(new tone.Context({ latencyHint: this.opts.latencyHint }));
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

  /** Crossfade to the new song (the player overlaps them, 2026-10-15), the bus back at its level if the win faded it. */
  private switchSong(song: SongId | null): void {
    const { tone, buses, player } = this;
    if (!tone || !buses || !player) return;
    this.playing = song;
    if (song) {
      const bus = buses.music.volume;
      const now = tone.now();
      bus.cancelScheduledValues(now);
      bus.setValueAtTime(bus.value, now);
      bus.linearRampToValueAtTime(soundLevels(this.settings).musicDb, now + BUS_BACK_S);
    }
    player.play(song);
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
