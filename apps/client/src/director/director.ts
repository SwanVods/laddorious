import type { GameEvent, PlayerId } from '@laddorious/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MatchUpdate } from '../service/matchService';
import { buildTimeline, type Beat } from './beats';
import { presentationFromView, samePresentation, type PresentationState } from './presentation';

/** More updates than this waiting behind a timeline fast-forward to the latest view (spec #2 §5.2). */
export const MAX_QUEUED_UPDATES = 3;
/** The event log keeps this many of the newest events. */
export const LOG_LIMIT = 300;

export interface PlayingBeat extends Beat {
  /** Epoch ms when the beat started; renderers animate towards `after` over `durationMs`. */
  startedAt: number;
}

/** One shown event; `seq` counts up from 1 and never repeats, so it can key a feed line. */
export interface LoggedEvent {
  seq: number;
  event: GameEvent;
}

export interface DirectorState {
  /** What the board shows. Null until the first update. */
  presentation: PresentationState | null;
  /** The beat on stage, or null between timelines. */
  beat: PlayingBeat | null;
  /** The latest update whose timeline has finished: what the HUD shows. */
  settled: MatchUpdate | null;
  /**
   * The events shown so far, oldest first: a beat's events join when it starts (beats that
   * take no time join at once), and a fast-forward adds the events it skips. The HUD reads it.
   */
  log: LoggedEvent[];
}

/**
 * Plays each MatchUpdate as a timeline of beats (spec #2 §5.2). Then it resets the board
 * to the update's view, and reports playback done for the window the update opened.
 * Plain TypeScript; React reads `store` with zustand's useStore.
 */
export class Director {
  readonly store: StoreApi<DirectorState> = createStore<DirectorState>()(() => ({ presentation: null, beat: null, settled: null, log: [] }));
  private readonly queue: MatchUpdate[] = [];
  private current: { update: MatchUpdate; beats: Beat[]; next: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor(
    private readonly me: PlayerId,
    private readonly playbackDone: (windowId: number) => void,
    private readonly warn: (message: string) => void = (message) => console.warn(message),
    /** Beat lengths are multiplied by this: e2e builds play matches fast (spec #2 §9.3). */
    private readonly timeScale = 1,
  ) {}

  push(update: MatchUpdate): void {
    this.queue.push(update);
    if (this.queue.length > MAX_QUEUED_UPDATES) this.fastForward();
    else if (!this.current) this.startNext();
  }

  /** Stop playing: no more beats and no more playbackDone. */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
  }

  private startNext(): void {
    const update = this.queue.shift();
    if (!update) return;
    let start = this.store.getState().presentation;
    if (!start) {
      start = presentationFromView(update.view);
      this.store.setState({ presentation: start });
    }
    this.current = { update, beats: buildTimeline(update.events, start, this.me, update.view.board.size), next: 0 };
    this.playNext();
  }

  private playNext(): void {
    const current = this.current!;
    // Beats that only change the HUD take no time.
    while (current.beats[current.next]?.durationMs === 0) {
      const instant = current.beats[current.next]!;
      this.store.setState({ presentation: instant.after, log: this.logged(instant.events) });
      current.next += 1;
    }
    const beat = current.beats[current.next];
    if (!beat) {
      this.finish(current.update, true);
      return;
    }
    const durationMs = Math.round(beat.durationMs * this.timeScale);
    this.store.setState({ beat: { ...beat, durationMs, startedAt: Date.now() }, log: this.logged(beat.events) });
    this.timer = setTimeout(() => {
      this.timer = null;
      this.store.setState({ presentation: beat.after });
      current.next += 1;
      this.playNext();
    }, durationMs);
  }

  /** The timeline is over: the view wins, and the window the update opened may start counting down. */
  private finish(update: MatchUpdate, checkDrift: boolean): void {
    const shown = this.store.getState().presentation;
    const truth = presentationFromView(update.view, shown?.arrivals);
    if (checkDrift && shown && !samePresentation(shown, truth)) {
      this.warn(`presentation drifted from the view in round ${update.view.round}; the view wins`);
    }
    this.store.setState({ presentation: truth, beat: null, settled: update });
    this.current = null;
    const aw = update.view.awaiting;
    if (update.timer === null && aw.window !== 'none') this.playbackDone(aw.windowId);
    this.startNext();
  }

  /** The log with these events added at the end, trimmed to LOG_LIMIT. */
  private logged(events: GameEvent[]): LoggedEvent[] {
    const log = this.store.getState().log;
    if (events.length === 0) return log;
    const next = [...log, ...events.map((event) => ({ seq: ++this.seq, event }))];
    return next.length > LOG_LIMIT ? next.slice(-LOG_LIMIT) : next;
  }

  /** Public events and my own private ones (spec #2 §4.2). */
  private visible(event: GameEvent): boolean {
    return event.visibility === 'public' || event.visibility.private === this.me;
  }

  /** Too far behind: skip straight to the latest update's view. */
  private fastForward(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    // The skipped events still reach the log: the HUD's dice and cards come from it.
    const playing = this.current?.beats.slice(this.current.next + (this.store.getState().beat ? 1 : 0)) ?? [];
    const skipped = [...playing.flatMap((b) => b.events), ...this.queue.flatMap((u) => u.events.filter((e) => this.visible(e)))];
    this.store.setState({ log: this.logged(skipped) });
    const latest = this.queue[this.queue.length - 1]!;
    this.queue.length = 0;
    this.current = null;
    this.finish(latest, false);
  }
}
