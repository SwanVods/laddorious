import {
  CARD_TYPES,
  RARITIES,
  type CardType,
  type GameEvent,
  type GenerationReport,
  type PlayerId,
  type Rarity,
  type RejectionReason,
} from '@laddorious/core';
import type { MatchRun } from './runner';

/** Seconds per activity — estimates until real playtests (spec §8.4). */
export interface TimeModel {
  diceSec: number;
  bonusSec: number;
  moveSec: number;
  challengeWindowSec: number;
  mysterySelectSec: number;
  revealSec: number;
  perCardSec: number;
  roundOverheadSec: number;
}

export const DEFAULT_TIME_MODEL: TimeModel = {
  diceSec: 6,
  bonusSec: 2,
  moveSec: 2,
  challengeWindowSec: 6,
  mysterySelectSec: 10,
  revealSec: 1,
  perCardSec: 1.5,
  roundOverheadSec: 1,
};

export interface MatchMetrics {
  rounds: number;
  winnerSeat: number;
  estimatedSeconds: number;
  challenges: number;
  challengeWindows: number;
  safetyCaps: number;
  encounters: number;
  picksByType: Record<CardType, number>;
  picksByRarity: Record<Rarity, number>;
  rerolls: number;
  results: { hit: number; blocked: number; fizzled: number };
  clashes: number;
  leadChanges: number;
  /** The winner was not the unique leader at the end of round 10. */
  comeback: boolean;
}

export function matchMetrics(run: MatchRun, tm: TimeModel = DEFAULT_TIME_MODEL): MatchMetrics {
  const { state, events } = run;
  if (state.phase.kind !== 'finished') throw new Error('match not finished');
  const winner: PlayerId = state.phase.winner;
  const count = (type: GameEvent['type']) => events.filter((e) => e.type === type).length;

  const roundsWithBonus = new Set<number>();
  const roundsWithEncounter = new Set<number>();
  let round = 1;
  for (const e of events) {
    if (e.type === 'RoundStarted') round = e.round;
    if (e.type === 'BonusChosen' && e.rollAgain) roundsWithBonus.add(round);
    if (e.type === 'CardSelected') roundsWithEncounter.add(round);
  }

  const picksByType = Object.fromEntries(CARD_TYPES.map((t) => [t, 0])) as Record<CardType, number>;
  const picksByRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  const results = { hit: 0, blocked: 0, fizzled: 0 };
  for (const e of events) {
    if (e.type === 'CardSelected') {
      picksByType[e.cardType] += 1;
      picksByRarity[e.rarity] += 1;
    }
    if (e.type === 'CardResolved') results[e.result] += 1;
  }

  const challengeWindows = events.filter((e) => e.type === 'WindowOpened' && e.window === 'challenge').length;
  const cardsResolved = count('CardResolved');
  const estimatedSeconds =
    state.round * (tm.roundOverheadSec + tm.diceSec + tm.moveSec) +
    roundsWithBonus.size * tm.bonusSec +
    challengeWindows * tm.challengeWindowSec +
    roundsWithEncounter.size * (tm.mysterySelectSec + tm.revealSec) +
    cardsResolved * tm.perCardSec;

  let leadChanges = 0;
  let last: PlayerId | null = null;
  for (const leader of run.roundLeaders) {
    if (leader !== null && last !== null && leader !== last) leadChanges++;
    if (leader !== null) last = leader;
  }

  return {
    rounds: state.round,
    winnerSeat: state.players.find((p) => p.id === winner)!.seat,
    estimatedSeconds,
    challenges: count('ChallengeStarted'),
    challengeWindows,
    safetyCaps: count('SafetyCapApplied'),
    encounters: count('MysteryOffered'),
    picksByType,
    picksByRarity,
    rerolls: count('CardRerolled'),
    results,
    clashes: count('Clash'),
    leadChanges,
    comeback: run.roundLeaders.length >= 10 && run.roundLeaders[9] !== winner,
  };
}

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx]!;
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);

export interface GeneratorSummary {
  boards: number;
  attemptsMean: number;
  attemptsMax: number;
  rejections: Partial<Record<RejectionReason, number>>;
}

/** Board-generator health across a batch (spec §8.4). */
export function summarizeGeneration(reports: readonly GenerationReport[]): GeneratorSummary {
  const rejections: Partial<Record<RejectionReason, number>> = {};
  for (const r of reports) {
    for (const [reason, n] of Object.entries(r.rejections) as Array<[RejectionReason, number]>) rejections[reason] = (rejections[reason] ?? 0) + n;
  }
  return {
    boards: reports.length,
    attemptsMean: mean(reports.map((r) => r.attempts)),
    attemptsMax: reports.reduce((m, r) => Math.max(m, r.attempts), 0),
    rejections,
  };
}

export interface BatchReport {
  matches: number;
  rounds: { p10: number; median: number; p90: number };
  minutes: { p10: number; median: number; p90: number };
  perMatch: {
    challenges: number;
    challengeWindows: number;
    safetyCaps: number;
    encounters: number;
    rerolls: number;
    clashes: number;
    leadChanges: number;
  };
  encountersPerRound: number;
  picksByType: Record<CardType, number>;
  picksByRarity: Record<Rarity, number>;
  results: { hit: number; blocked: number; fizzled: number };
  winRateBySeat: number[];
  comebackRate: number;
  generator: GeneratorSummary;
}

export function aggregate(all: MatchMetrics[], seats: number, generation: readonly GenerationReport[] = []): BatchReport {
  const sum = <K extends keyof MatchMetrics>(k: K) => all.map((m) => m[k] as number);
  const minutes = all.map((m) => m.estimatedSeconds / 60);
  const picksByType = Object.fromEntries(CARD_TYPES.map((t) => [t, all.reduce((a, m) => a + m.picksByType[t], 0)])) as Record<CardType, number>;
  const picksByRarity = Object.fromEntries(RARITIES.map((r) => [r, all.reduce((a, m) => a + m.picksByRarity[r], 0)])) as Record<Rarity, number>;
  const totalRounds = all.reduce((a, m) => a + m.rounds, 0);
  return {
    matches: all.length,
    rounds: { p10: quantile(sum('rounds'), 0.1), median: quantile(sum('rounds'), 0.5), p90: quantile(sum('rounds'), 0.9) },
    minutes: { p10: quantile(minutes, 0.1), median: quantile(minutes, 0.5), p90: quantile(minutes, 0.9) },
    perMatch: {
      challenges: mean(sum('challenges')),
      challengeWindows: mean(sum('challengeWindows')),
      safetyCaps: mean(sum('safetyCaps')),
      encounters: mean(sum('encounters')),
      rerolls: mean(sum('rerolls')),
      clashes: mean(sum('clashes')),
      leadChanges: mean(sum('leadChanges')),
    },
    encountersPerRound: all.reduce((a, m) => a + m.encounters, 0) / totalRounds,
    picksByType,
    picksByRarity,
    results: {
      hit: all.reduce((a, m) => a + m.results.hit, 0),
      blocked: all.reduce((a, m) => a + m.results.blocked, 0),
      fizzled: all.reduce((a, m) => a + m.results.fizzled, 0),
    },
    winRateBySeat: Array.from({ length: seats }, (_, seat) => all.filter((m) => m.winnerSeat === seat).length / all.length),
    comebackRate: all.filter((m) => m.comeback).length / all.length,
    generator: summarizeGeneration(generation),
  };
}

export function formatReport(r: BatchReport): string {
  const f = (n: number, d = 2) => n.toFixed(d);
  const lines = [
    `Matches:              ${r.matches}`,
    `Rounds (p10/med/p90): ${r.rounds.p10} / ${r.rounds.median} / ${r.rounds.p90}`,
    `Minutes est.:         ${f(r.minutes.p10, 1)} / ${f(r.minutes.median, 1)} / ${f(r.minutes.p90, 1)}`,
    `Challenges/match:     ${f(r.perMatch.challenges)}  (windows ${f(r.perMatch.challengeWindows)}, safety caps ${f(r.perMatch.safetyCaps, 3)})`,
    `Encounters/round:     ${f(r.encountersPerRound)}  (rerolls/match ${f(r.perMatch.rerolls)})`,
    `Picks by type:        ${Object.entries(r.picksByType).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Picks by rarity:      ${Object.entries(r.picksByRarity).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Card results:         hit ${r.results.hit}, blocked ${r.results.blocked}, fizzled ${r.results.fizzled}; clashes/match ${f(r.perMatch.clashes, 3)}`,
    `Win rate by seat:     ${r.winRateBySeat.map((w) => `${f(w * 100, 1)}%`).join(' / ')}`,
    `Lead changes/match:   ${f(r.perMatch.leadChanges)}   Comeback rate: ${f(r.comebackRate * 100, 1)}%`,
    `Board generation:     ${r.generator.boards} boards, attempts mean ${f(r.generator.attemptsMean)} / max ${r.generator.attemptsMax}; rejections ${JSON.stringify(r.generator.rejections)}`,
  ];
  return lines.join('\n');
}
