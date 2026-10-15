import { nextInt, type RngStream } from '../rng/stream';
import type { TargetRule } from './types';

export interface TargetablePlayer {
  id: string;
  seat: number;
  position: number;
}

/** Players satisfying the rule's condition relative to the caster (spec §5.1). */
export function targetCandidates(players: readonly TargetablePlayer[], caster: TargetablePlayer, rule: TargetRule): TargetablePlayer[] {
  switch (rule.condition) {
    case 'self':
      return [caster];
    case 'other':
      return players.filter((p) => p.id !== caster.id);
    case 'everyone':
      return [...players];
    case 'ahead-of-caster':
      return players.filter((p) => p.id !== caster.id && p.position > caster.position);
    case 'behind-of-caster':
      return players.filter((p) => p.id !== caster.id && p.position < caster.position);
    case 'section': {
      const [lo, hi] = rule.section!;
      return players.filter((p) => p.id !== caster.id && p.position >= lo && p.position <= hi);
    }
  }
}

export function isValidTarget(
  players: readonly TargetablePlayer[],
  caster: TargetablePlayer,
  rule: TargetRule,
  targetId: string,
): boolean {
  return targetCandidates(players, caster, rule).some((p) => p.id === targetId);
}

/** Select exactly one target by the rule's pick + tieBreak, or null if no candidate qualifies (or the card hits them all). */
export function selectTarget(
  players: readonly TargetablePlayer[],
  caster: TargetablePlayer,
  rule: TargetRule,
  misc: RngStream,
): string | null {
  const candidates = targetCandidates(players, caster, rule);
  if (candidates.length === 0 || rule.pick === 'all') return null;
  if (rule.pick === 'self') return candidates.some((p) => p.id === caster.id) ? caster.id : null;
  const score = (p: TargetablePlayer): number => {
    const d = Math.abs(p.position - caster.position);
    switch (rule.pick) {
      case 'nearest':
        return -d;
      case 'furthest':
        return d;
      case 'leader':
        return p.position;
      case 'last':
        return -p.position;
      case 'self':
      case 'all':
        return 0;
    }
  };
  const best = Math.max(...candidates.map(score));
  const tied = candidates.filter((p) => score(p) === best).sort((a, b) => a.seat - b.seat);
  const chosen = rule.tieBreak === 'random' && tied.length > 1 ? tied[nextInt(misc, tied.length)]! : tied[0]!;
  return chosen.id;
}
