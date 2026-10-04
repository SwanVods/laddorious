import {
  awaiting,
  createMatch,
  hashState,
  step,
  viewFor,
  type Board,
  type GameEvent,
  type Input,
  type MatchConfigInput,
  type MatchState,
  type PlayerId,
  type PlayerSeat,
} from '@laddorious/core';
import type { Bot } from '@laddorious/bots';

/** Everything needed to reproduce a match exactly (spec §3.5). */
export interface MatchLog {
  config: MatchConfigInput;
  seats: PlayerSeat[];
  inputs: Input[];
  finalHash: string;
}

export interface MatchRun {
  state: MatchState;
  events: GameEvent[];
  log: MatchLog;
  /** Unique leader at the end of each round (null on a tie), index 0 = round 1. */
  roundLeaders: Array<PlayerId | null>;
}

function leaderOf(s: MatchState): PlayerId | null {
  const max = Math.max(...s.players.map((p) => p.position));
  const top = s.players.filter((p) => p.position === max);
  return top.length === 1 ? top[0]!.id : null;
}

export interface RunOptions {
  maxSteps?: number;
  /** A board already generated from config.seed — saves generating it twice. Replays regenerate it from the seed. */
  board?: Board;
}

/**
 * Drive one match with bots (spec §8.2): ask each awaited bot for an input;
 * when every awaited bot idles, the window times out. No real time passes.
 */
export function runMatch(config: MatchConfigInput, seats: PlayerSeat[], bots: Record<PlayerId, Bot>, opts: RunOptions = {}): MatchRun {
  const maxSteps = opts.maxSteps ?? 100_000;
  let s = createMatch(config, seats, opts.board);
  const events: GameEvent[] = [];
  const inputs: Input[] = [];
  const roundLeaders: Array<PlayerId | null> = [];

  const apply = (input: Input) => {
    const r = step(s, input);
    if (!r.ok) throw new Error(`illegal input ${JSON.stringify(input)}: ${r.error.code} ${r.error.message}`);
    s = r.state;
    inputs.push(input);
    events.push(...r.events);
    if (r.events.some((e) => e.type === 'RoundEnded')) roundLeaders.push(leaderOf(s));
  };

  for (let n = 0; s.phase.kind !== 'finished'; n++) {
    if (n >= maxSteps) throw new Error(`match did not finish within ${maxSteps} steps`);
    const aw = awaiting(s);
    let acted = false;
    for (const id of aw.players) {
      const input = bots[id]!.decide(viewFor(s, id));
      if (input === 'idle') continue;
      apply(input);
      acted = true;
      break;
    }
    if (!acted) apply({ type: 'timeout', windowId: aw.windowId });
  }

  return { state: s, events, log: { config, seats, inputs, finalHash: hashState(s) }, roundLeaders };
}

/** Re-run a log and report whether the final state hash matches (spec §8.3). */
export function replayLog(log: MatchLog): { ok: boolean; hash: string; state: MatchState } {
  let s = createMatch(log.config, log.seats);
  for (const input of log.inputs) {
    const r = step(s, input);
    if (!r.ok) throw new Error(`replay failed at ${JSON.stringify(input)}: ${r.error.code}`);
    s = r.state;
  }
  const hash = hashState(s);
  return { ok: hash === log.finalHash, hash, state: s };
}
