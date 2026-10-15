import { makeBots, type Bot } from '@laddorious/bots';
import { awaiting, catalogConfig, createMatch, eventsFor, step, viewFor, type GameEvent, type Input, type MatchState, type PlayerId } from '@laddorious/core';
import { PausableTimers } from './timers';
import type { FromHost, MatchUpdate, PlayerAction, Seat } from './types';

/** How long a new window waits for the humans' playbackDone before its countdown starts anyway (spec #2 C13). */
export const PLAYBACK_CAP_MS = 12_000;
/** Each awaited bot acts at a random moment this far into the countdown (spec #2 §4.4). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 2_500;
/** Fast mode (e2e builds, spec #2 §9.3): every seat plays itself at once and windows are short, so a match takes seconds. */
export const FAST = { windows: { diceMs: 1500, challengeMs: 1500, mysteryMs: 1500 }, botDelayMinMs: 20, botDelayMaxMs: 80, playbackCapMs: 1500 } as const;

export interface MatchHostOptions {
  /** Delivers a message to one human seat. */
  send(to: PlayerId, msg: FromHost): void;
  /** e2e builds: bots play every seat, the humans' too, with short windows (spec #2 §9.3). */
  fast?: boolean;
  /** Called once, when the match is won or the host fails. */
  onEnd?(outcome: 'won' | 'failed'): void;
}

/**
 * One match (spec #4 §3.1): the engine state, the window timers and the bots, for any mix of
 * humans and bots. The offline Web Worker and the server's match room both run it, and tests
 * drive it with fake timers. Each human only ever receives their own view and events (spec #2 §4.2).
 * A human whose connection is gone is away: no bot plays for them, and their windows run on
 * the engine's timeouts (spec #4 M2, M3).
 */
export class MatchHost {
  private match: MatchState | null = null;
  private humans: PlayerId[] = [];
  private readonly away = new Set<PlayerId>();
  private bots: Record<PlayerId, Bot> = {};
  /** The window the current timers belong to. */
  private windowId = 0;
  /** Connected humans who haven't yet watched the events that opened the current window. */
  private watching = new Set<PlayerId>();
  private stopped = false;
  private ended = false;
  private readonly fast: boolean;
  private readonly timers = new PausableTimers();

  constructor(private readonly opts: MatchHostOptions) {
    this.fast = opts.fast ?? false;
  }

  create(seats: readonly Seat[], seed: string, rngSeed: string): void {
    this.guard(() => {
      this.humans = [...new Set(seats.filter((s) => !s.bot).map((s) => s.playerId))];
      // In fast mode a bot plays the human seats too.
      const played = this.fast ? seats : seats.filter((s) => s.bot);
      this.bots = makeBots(played.map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
      this.match = createMatch(this.fast ? { seed, rngSeed, ...catalogConfig(), windows: FAST.windows } : { seed, rngSeed, ...catalogConfig() }, seats.map((s) => ({ id: s.playerId })));
      this.afterStep([]);
    });
  }

  /** A human seat's input. Engine errors go back to that seat as `rejected`; the match is unchanged. */
  action(player: PlayerId, action: PlayerAction, windowId: number): void {
    this.guard(() => {
      const result = step(this.state(), { ...action, player, windowId });
      if (!result.ok) {
        this.opts.send(player, { type: 'rejected', error: result.error });
        return;
      }
      this.match = result.state;
      this.afterStep(result.events);
    });
  }

  /** A human has watched the events that opened this window. The countdown starts once every connected human has (C13). */
  playbackDone(player: PlayerId, windowId: number): void {
    this.guard(() => {
      if (windowId !== this.windowId || !this.timers.has('playback')) return;
      this.watching.delete(player);
      if (this.watching.size === 0) this.startCountdown();
    });
  }

  /** A human seat lost (true) or regained (false) its connection (spec #4 §5.2). */
  setAway(player: PlayerId, away: boolean): void {
    this.guard(() => {
      if (!this.humans.includes(player) || this.away.has(player) === away) return;
      if (away) {
        this.away.add(player);
        // Nobody waits for an away human's playback.
        if (this.timers.has('playback') && this.watching.delete(player) && this.watching.size === 0) this.startCountdown();
      } else {
        this.away.delete(player);
      }
      this.closeEarly();
    });
  }

  /** Sends one human the current view with no events, e.g. after they rejoin (spec #4 §5.2). */
  resync(player: PlayerId): void {
    this.guard(() => {
      if (this.humans.includes(player)) this.opts.send(player, { type: 'update', update: this.updateFor(player, []) });
    });
  }

  pause(): void {
    this.guard(() => this.timers.pause());
  }

  resume(): void {
    this.guard(() => {
      this.timers.resume();
      if (this.timers.has('countdown')) this.sendUpdates([]); // the countdown now ends later
    });
  }

  stop(): void {
    this.stopped = true;
    this.timers.clearAll();
  }

  /** Bot and timeout inputs are built from the current state, so a rejection here is a host bug. */
  private apply(input: Input): void {
    const result = step(this.state(), input);
    if (!result.ok) throw new Error(`host input rejected: ${result.error.code} ${result.error.message}`);
    this.match = result.state;
    this.afterStep(result.events);
  }

  private afterStep(events: GameEvent[]): void {
    const aw = awaiting(this.state());
    if (aw.windowId !== this.windowId) {
      // A new window: no countdown until the connected humans have watched the events (C13).
      this.timers.clearAll();
      this.windowId = aw.windowId;
      this.watching = new Set(this.connected());
      if (aw.window !== 'none') this.timers.set('playback', this.fast ? FAST.playbackCapMs : PLAYBACK_CAP_MS, () => this.guard(() => this.startCountdown()));
    } else if (this.timers.has('countdown')) {
      this.scheduleBots(); // a bot that rerolled a card still has to pick
    }
    this.sendUpdates(events);
    if (this.state().phase.kind === 'finished') this.end('won');
    else this.closeEarly();
  }

  private startCountdown(): void {
    this.timers.clear('playback');
    const aw = awaiting(this.state());
    this.timers.set('countdown', aw.durationMs, () => this.guard(() => this.apply({ type: 'timeout', windowId: aw.windowId })));
    this.scheduleBots();
    this.sendUpdates([]);
  }

  /**
   * When every seat the window still waits for is an away human, nobody is going to act: time
   * it out now (spec #4 M3). Not while nobody is connected: then the room pauses the match.
   */
  private closeEarly(): void {
    const aw = awaiting(this.state());
    if (aw.window === 'none' || aw.players.length === 0 || this.connected().length === 0) return;
    if (aw.players.every((id) => this.away.has(id) && !this.bots[id])) this.apply({ type: 'timeout', windowId: aw.windowId });
  }

  private scheduleBots(): void {
    for (const id of awaiting(this.state()).players) {
      const bot = this.bots[id];
      const key = `bot:${id}`;
      if (!bot || this.timers.has(key)) continue;
      const [min, max] = this.fast ? [FAST.botDelayMinMs, FAST.botDelayMaxMs] : [BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS];
      const delay = min + Math.random() * (max - min);
      this.timers.set(key, delay, () =>
        this.guard(() => {
          const input = bot.decide(viewFor(this.state(), id));
          if (input !== 'idle') this.apply(input);
        }),
      );
    }
  }

  /** Every connected human gets their own view and events. */
  private sendUpdates(events: GameEvent[]): void {
    for (const id of this.connected()) this.opts.send(id, { type: 'update', update: this.updateFor(id, events) });
  }

  private updateFor(player: PlayerId, events: GameEvent[]): MatchUpdate {
    const endsAt = this.timers.dueAt('countdown');
    return { view: viewFor(this.state(), player), events: eventsFor(events, player), timer: endsAt === undefined ? null : { windowId: this.windowId, endsAt } };
  }

  private connected(): PlayerId[] {
    return this.humans.filter((id) => !this.away.has(id));
  }

  private end(outcome: 'won' | 'failed'): void {
    if (this.ended) return;
    this.ended = true;
    this.opts.onEnd?.(outcome);
  }

  /** Every entry point runs here: an escaping exception (an engine InvariantError included) ends the match. */
  private guard(fn: () => void): void {
    if (this.stopped) return;
    try {
      fn();
    } catch (err) {
      this.stop();
      const message = err instanceof Error ? err.message : String(err);
      for (const id of this.humans) this.opts.send(id, { type: 'failed', message });
      this.end('failed');
    }
  }

  private state(): MatchState {
    if (!this.match) throw new Error('no match yet: create comes first');
    return this.match;
  }
}
