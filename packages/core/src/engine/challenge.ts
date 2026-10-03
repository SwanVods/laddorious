import { nextInt, pickOne, type RngStream } from '../rng/stream';
import { inputError } from './dice';
import type { Challenge, ChallengeChoice, GameEvent, InputError, MatchState, PlayerId, RpsChoice } from './types';
import { nextId, openWindow, priv, pub } from './util';

export const MINORITY_THEMES: ReadonlyArray<[string, string]> = [
  ['Snake', 'Ladder'],
  ['Sun', 'Moon'],
  ['Attack', 'Defend'],
  ['Fish', 'Chicken'],
];

const BEATS: Record<RpsChoice, RpsChoice> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

export function createChallenge(s: MatchState, ev: GameEvent[], tile: number, participants: PlayerId[]): Challenge {
  const kind = participants.length === 2 ? 'rps' : 'minority';
  const theme: [string, string] | null = kind === 'minority' ? [...pickOne(s.rng.misc, MINORITY_THEMES)] : null;
  const ch: Challenge = {
    id: nextId(s, 'c'),
    tile,
    participants: [...participants],
    contesting: [...participants],
    kind,
    theme,
    pickRound: 1,
    picks: {},
    losers: [],
    winner: null,
  };
  ev.push(pub({ type: 'ChallengeStarted', challengeId: ch.id, tile, players: [...participants], kind, theme }));
  return ch;
}

function isValidChoice(kind: Challenge['kind'], choice: ChallengeChoice): boolean {
  return kind === 'rps' ? choice === 'rock' || choice === 'paper' || choice === 'scissors' : choice === 'A' || choice === 'B';
}

export type PickRoundOutcome = 'win' | 'replay' | 'continue' | 'random';

/**
 * Close one picking round of a challenge (spec §4.7). Mutates `ch`.
 * `timedOut` lists contesting players who did not pick in time.
 */
export function resolvePickRound(ch: Challenge, timedOut: PlayerId[], misc: RngStream, maxPickRounds: number): PickRoundOutcome {
  const roundPlayers = [...ch.contesting];
  const lose = (ids: PlayerId[]) => {
    for (const id of ids) if (!ch.losers.includes(id)) ch.losers.push(id);
    ch.contesting = ch.contesting.filter((id) => !ids.includes(id));
  };
  const win = (id: PlayerId) => {
    ch.winner = id;
    lose(ch.contesting.filter((p) => p !== id));
  };

  lose(timedOut.filter((id) => ch.contesting.includes(id)));

  if (ch.contesting.length === 0) {
    // Everyone timed out: pick a random winner among this round's contestants.
    ch.losers = ch.losers.filter((id) => !roundPlayers.includes(id));
    ch.contesting = [...roundPlayers];
    win(roundPlayers[nextInt(misc, roundPlayers.length)]!);
    return 'random';
  }
  if (ch.contesting.length === 1) {
    win(ch.contesting[0]!);
    return 'win';
  }

  let outcome: 'replay' | 'continue' | 'win';
  if (ch.contesting.length === 2 && ch.kind === 'minority') {
    // A minority challenge narrowed to two players continues as RPS.
    ch.kind = 'rps';
    outcome = 'continue';
  } else if (ch.kind === 'rps') {
    const [a, b] = ch.contesting as [PlayerId, PlayerId];
    const pa = ch.picks[a] as RpsChoice;
    const pb = ch.picks[b] as RpsChoice;
    if (pa === pb) outcome = 'replay';
    else {
      win(BEATS[pa] === pb ? a : b);
      outcome = 'win';
    }
  } else {
    const sideA = ch.contesting.filter((id) => ch.picks[id] === 'A');
    const sideB = ch.contesting.filter((id) => ch.picks[id] === 'B');
    if (sideA.length === 0 || sideB.length === 0 || sideA.length === sideB.length) outcome = 'replay';
    else {
      const [minority, majority] = sideA.length < sideB.length ? [sideA, sideB] : [sideB, sideA];
      lose(majority);
      if (minority.length === 1) {
        win(minority[0]!);
        outcome = 'win';
      } else {
        if (minority.length === 2) ch.kind = 'rps';
        outcome = 'continue';
      }
    }
  }

  if (outcome === 'win') return 'win';
  ch.pickRound += 1;
  ch.picks = {};
  if (ch.pickRound > maxPickRounds) {
    win(ch.contesting[nextInt(misc, ch.contesting.length)]!);
    return 'random';
  }
  return outcome;
}

type SettlePhase = Extract<MatchState['phase'], { kind: 'settle' }>;

export function openChallenges(s: MatchState): Challenge[] {
  return s.phase.kind === 'settle' ? s.phase.ctx.challenges.filter((c) => c.winner === null) : [];
}

export function challengeAwaited(s: MatchState): PlayerId[] {
  return openChallenges(s).flatMap((c) => c.contesting.filter((id) => c.picks[id] === undefined));
}

export function challengePickInput(
  s: MatchState,
  ev: GameEvent[],
  player: PlayerId,
  challengeId: string,
  choice: ChallengeChoice,
): InputError | null {
  if (s.phase.kind !== 'settle') return inputError('WRONG_PHASE', 'no challenge in progress');
  const ch = openChallenges(s).find((c) => c.id === challengeId);
  if (!ch) return inputError('UNKNOWN_CHALLENGE', `no open challenge ${challengeId}`);
  if (!ch.contesting.includes(player) || ch.picks[player] !== undefined) {
    return inputError('NOT_AWAITED', `${player} cannot pick in ${challengeId}`);
  }
  if (!isValidChoice(ch.kind, choice)) return inputError('INVALID_CHOICE', `${choice} is not valid for ${ch.kind}`);
  ch.picks[player] = choice;
  ev.push(pub({ type: 'ChallengePickLocked', challengeId, player }));
  ev.push(priv(player, { type: 'ChallengePickEcho', challengeId, player, choice }));
  if (challengeAwaited(s).length === 0) closePickRound(s, ev);
  return null;
}

/** Close the current picking round of every open challenge (all picked, or timeout). */
export function closePickRound(s: MatchState, ev: GameEvent[]): void {
  const phase = s.phase as SettlePhase;
  const maxPickRounds = s.config.collision.maxReplays + 1;
  for (const ch of openChallenges(s)) {
    const timedOut = ch.contesting.filter((id) => ch.picks[id] === undefined);
    const picks: Record<PlayerId, ChallengeChoice | null> = {};
    for (const id of ch.contesting) picks[id] = ch.picks[id] ?? null;
    const pickRound = ch.pickRound;
    const outcome = resolvePickRound(ch, timedOut, s.rng.misc, maxPickRounds);
    ev.push(
      pub({
        type: 'ChallengeResolved',
        challengeId: ch.id,
        pickRound,
        picks,
        winner: ch.winner,
        losers: ch.winner ? [...ch.losers] : [],
        outcome,
      }),
    );
  }
  const stillOpen = phase.ctx.challenges.filter((c) => c.winner === null);
  if (stillOpen.length > 0) openWindow(s, ev, 'challenge', stillOpen.flatMap((c) => c.contesting));
}
