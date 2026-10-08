import { makeBots, type Bot } from '@laddorious/bots';
import { awaiting, createMatch, eventsFor, step, viewFor, type GameEvent, type Input, type MatchState, type PlayerId } from '@laddorious/core';
import type { PlayerAction, SeatInfo } from '../service/matchService';
import type { FromHost, ToHost } from './protocol';
import { PausableTimers } from './timers';

/** How long a new window waits for the human seat's playbackDone before its countdown starts anyway (C13). */
export const PLAYBACK_CAP_MS = 12_000;
/** Each awaited bot acts at a random moment this far into the countdown (§4.4). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 2_500;
/** Fast mode (e2e builds, spec #2 §9.3): every seat plays itself at once and windows are short, so a match takes seconds. */
export const FAST = { windows: { diceMs: 1500, challengeMs: 1500, mysteryMs: 1500 }, botDelayMinMs: 20, botDelayMaxMs: 80, playbackCapMs: 1500 } as const;

/**
 * One local match (spec #2 §4.4): the engine state, the window timers and the bots.
 * A plain class so tests can drive it with fake timers; host.worker.ts runs it in a Web Worker.
 * Everything it posts is what the human seat may see (§4.2).
 */
export class LocalHost {
  private match: MatchState | null = null;
  private me: PlayerId = '';
  private bots: Record<PlayerId, Bot> = {};
  /** The window the current timers belong to. */
  private windowId = 0;
  private stopped = false;
  private fast = false;
  private readonly timers = new PausableTimers();

  constructor(private readonly post: (msg: FromHost) => void) {}

  handle(msg: ToHost): void {
    this.guard(() => {
      switch (msg.type) {
        case 'create':
          this.create(msg.seats, msg.seed, msg.rngSeed, msg.fast ?? false);
          return;
        case 'action':
          this.act(msg.action, msg.windowId);
          return;
        case 'playbackDone':
          if (msg.windowId === this.windowId && this.timers.has('playback')) this.startCountdown();
          return;
        case 'pause':
          this.timers.pause();
          return;
        case 'resume':
          this.timers.resume();
          if (this.timers.has('countdown')) this.sendUpdate([]); // the countdown now ends later
          return;
        case 'leave':
          this.stop();
          return;
      }
    });
  }

  private create(seats: SeatInfo[], seed: string, rngSeed: string, fast: boolean): void {
    const human = seats.find((s) => !s.bot);
    if (!human) throw new Error('a local match needs a human seat');
    this.me = human.playerId;
    this.fast = fast;
    // In fast mode a bot plays the human seat too.
    const played = fast ? seats : seats.filter((s) => s.bot);
    this.bots = makeBots(played.map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
    this.match = createMatch(fast ? { seed, rngSeed, windows: FAST.windows } : { seed, rngSeed }, seats.map((s) => ({ id: s.playerId })));
    this.afterStep([]);
  }

  /** The human seat's input. Engine errors go back as `rejected`; the match is unchanged. */
  private act(action: PlayerAction, windowId: number): void {
    const result = step(this.state(), { ...action, player: this.me, windowId });
    if (!result.ok) {
      this.post({ type: 'rejected', error: result.error });
      return;
    }
    this.match = result.state;
    this.afterStep(result.events);
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
      // A new window: no countdown until the human seat has watched the events (C13).
      this.timers.clearAll();
      this.windowId = aw.windowId;
      if (aw.window !== 'none') this.timers.set('playback', this.fast ? FAST.playbackCapMs : PLAYBACK_CAP_MS, () => this.guard(() => this.startCountdown()));
    } else if (this.timers.has('countdown')) {
      this.scheduleBots(); // a bot that rerolled a card still has to pick
    }
    this.sendUpdate(events);
  }

  private startCountdown(): void {
    this.timers.clear('playback');
    const aw = awaiting(this.state());
    this.timers.set('countdown', aw.durationMs, () => this.guard(() => this.apply({ type: 'timeout', windowId: aw.windowId })));
    this.scheduleBots();
    this.sendUpdate([]);
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

  private sendUpdate(events: GameEvent[]): void {
    const endsAt = this.timers.dueAt('countdown');
    this.post({
      type: 'update',
      update: {
        view: viewFor(this.state(), this.me),
        events: eventsFor(events, this.me),
        timer: endsAt === undefined ? null : { windowId: this.windowId, endsAt },
      },
    });
  }

  /** Every entry point runs here: an escaping exception (an engine InvariantError included) ends the match. */
  private guard(fn: () => void): void {
    if (this.stopped) return;
    try {
      fn();
    } catch (err) {
      this.stop();
      this.post({ type: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  }

  private stop(): void {
    this.stopped = true;
    this.timers.clearAll();
  }

  private state(): MatchState {
    if (!this.match) throw new Error('no match yet: create comes first');
    return this.match;
  }
}
