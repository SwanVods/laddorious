import { boardViolations } from '../board/invariants';
import { InvariantError } from './errors';
import type { MatchState } from './types';
import { sharedTiles } from './util';

/** Spec §10. Throws InvariantError on the first broken invariant. */
export function assertInvariants(s: MatchState): void {
  const N = s.board.size;
  for (const p of s.players) {
    if (!Number.isInteger(p.position) || p.position < 0 || p.position > N) {
      throw new InvariantError(`${p.id} at invalid position ${p.position}`);
    }
  }
  if (s.phase.kind !== 'settle' && sharedTiles(s).length > 0) {
    throw new InvariantError(`tiles shared outside a settle: ${sharedTiles(s).join(', ')}`);
  }
  const bv = boardViolations(s.board);
  if (bv.length > 0) throw new InvariantError(`board invariant broken: ${bv.join('; ')}`);
  if (s.phase.kind === 'mysterySelect') {
    for (const o of Object.values(s.phase.offers)) {
      const rerolledCount = o.rerolled.filter(Boolean).length;
      if (o.rerollsUsed > s.config.mystery.maxRerolls || rerolledCount !== o.rerollsUsed) {
        throw new InvariantError(`offer for ${o.player} has inconsistent rerolls`);
      }
      if (new Set(o.cards).size !== o.cards.length) throw new InvariantError(`hand of ${o.player} holds a card twice`);
    }
  }
  for (const e of s.effects) {
    if (e.lifetime !== 'permanent' && e.lifetime.charges !== undefined && e.lifetime.charges <= 0) {
      throw new InvariantError(`effect ${e.id} kept with no charges`);
    }
  }
  if (s.phase.kind === 'finished') {
    const winners = s.players.filter((p) => p.position === N);
    if (winners.length !== 1 || winners[0]!.id !== s.phase.winner) throw new InvariantError('finished without exactly one winner on N');
  }
}
