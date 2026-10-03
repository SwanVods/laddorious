import { jumpFrom } from '../board/types';
import { nextInt } from '../rng/stream';
import { createChallenge } from './challenge';
import { evaluateAfterMove, useSnakeShield } from './effects';
import { InvariantError } from './errors';
import type { GameEvent, MatchState, Mover, PlayerId } from './types';
import { bounce, getPlayer, movePlayer, openWindow, pub, seatOrder, sharedTiles } from './util';

type SettlePhase = Extract<MatchState['phase'], { kind: 'settle' }>;

/**
 * Step 1 of the settle loop: every mover follows snake/ladder chains, then its
 * afterMove conditionals fire. Returns all players who moved in this step.
 */
export function resolveJumps(s: MatchState, ev: GameEvent[], movers: Mover[]): Mover[] {
  const queue = [...movers];
  const moved = new Map<PlayerId, Mover>();
  while (queue.length > 0) {
    const m = queue.shift()!;
    moved.set(m.player, m);
    const p = getPlayer(s, m.player);
    const landedOn = p.position;
    let guard = 0;
    for (;;) {
      const j = jumpFrom(s.board, p.position);
      if (!j) break;
      if (j.to < j.from) {
        const shield = useSnakeShield(s, ev, p.id);
        if (shield) {
          ev.push(pub({ type: 'SnakeBlocked', player: p.id, tile: p.position, effectId: shield }));
          break;
        }
        movePlayer(s, ev, p.id, j.to, 'snake');
      } else {
        movePlayer(s, ev, p.id, j.to, 'ladder');
      }
      if (++guard > s.board.jumps.length) throw new InvariantError('jump cycle while settling');
    }
    const extra = evaluateAfterMove(s, ev, p.id, m.cause, landedOn);
    if (extra !== 0) {
      const raw = p.position + extra;
      movePlayer(s, ev, p.id, bounce(raw, s.board.size), 'effect', raw > s.board.size);
      queue.push({ player: p.id, cause: 'effect' });
    }
  }
  return [...moved.values()];
}

/**
 * Safety cap (spec §4.6): players who arrived on a shared tile in this step step
 * back to the nearest free tile, triggering nothing. If every occupant arrived
 * now, `misc` picks one to stay.
 */
export function applySafetyCap(s: MatchState, ev: GameEvent[], movers: Mover[]): void {
  const arrived = new Set(movers.map((m) => m.player));
  for (const tile of sharedTiles(s)) {
    const occupants = seatOrder(s, s.players.filter((p) => p.position === tile).map((p) => p.id));
    let steppers = occupants.filter((id) => arrived.has(id));
    if (steppers.length === occupants.length) {
      const stay = occupants[nextInt(s.rng.misc, occupants.length)]!;
      steppers = occupants.filter((id) => id !== stay);
    }
    for (const id of steppers) {
      let to = tile - 1;
      while (to > 0 && s.players.some((p) => p.position === to)) to--;
      movePlayer(s, ev, id, to, 'stepBack');
    }
    ev.push(pub({ type: 'SafetyCapApplied', tile, steppedBack: steppers }));
  }
}

/**
 * Run the settle loop (spec §4.5) until it needs challenge picks ('waiting')
 * or no tile in 1..N is shared ('done').
 */
export function runSettle(s: MatchState, ev: GameEvent[]): 'waiting' | 'done' {
  const phase = s.phase as SettlePhase;
  const ctx = phase.ctx;
  for (;;) {
    if (ctx.challenges.length > 0) {
      if (ctx.challenges.some((c) => c.winner === null)) return 'waiting';
      const knocked: Mover[] = [];
      for (const ch of ctx.challenges) {
        for (const loser of seatOrder(s, ch.losers)) {
          const p = getPlayer(s, loser);
          movePlayer(s, ev, loser, Math.max(0, p.position - s.config.collision.knockback), 'knockback');
          knocked.push({ player: loser, cause: 'knockback' });
        }
      }
      ctx.challenges = [];
      ctx.movers = knocked;
    }

    ctx.movers = resolveJumps(s, ev, ctx.movers);
    const shared = sharedTiles(s);
    if (shared.length === 0) return 'done';
    if (ctx.wave >= s.config.collision.maxWaves) {
      applySafetyCap(s, ev, ctx.movers);
      return 'done';
    }
    ctx.wave += 1;
    ctx.challenges = shared.map((tile) =>
      createChallenge(s, ev, tile, seatOrder(s, s.players.filter((p) => p.position === tile).map((p) => p.id))),
    );
    openWindow(s, ev, 'challenge', ctx.challenges.flatMap((c) => c.contesting));
    return 'waiting';
  }
}
