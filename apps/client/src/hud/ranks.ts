import type { PlayerId } from '@laddorious/core';
import { BEAT_MS } from '../director/beats';
import type { PlayingBeat } from '../director/director';
import { ordinal } from './labels';

export interface RankBadge {
  label: string;
  /** When the badge pops, from the start of the reveal. */
  delayMs: number;
}

/**
 * The rank badges over the other pieces during the ranks reveal (polish spec §4.5): from last
 * place up to 2nd, a step apart; tied players share a rank and pop together.
 */
export function rankBadges(beat: PlayingBeat | null, timeScale: number): Readonly<Record<PlayerId, RankBadge>> {
  const won = beat?.kind === 'ranks' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type !== 'MatchWon') return {};
  const others = won.rankings.filter((r) => r.player !== won.winner);
  const order = [...new Set(others.map((r) => r.rank))].sort((a, b) => b - a);
  return Object.fromEntries(others.map((r) => [r.player, { label: ordinal(r.rank), delayMs: order.indexOf(r.rank) * BEAT_MS.rankStep * timeScale }]));
}
