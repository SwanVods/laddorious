import { jumpFrom } from '../board/types';
import { jumpsAreOff } from '../cards/types';
import { nextInt } from '../rng/stream';
import { createChallenge } from './challenge';
import { effectsOn, evaluateAfterMove, spendCharge, useSnakeShield } from './effects';
import { InvariantError } from './errors';
import type { GameEvent, MatchState, Mover, PlayerId } from './types';
import { bounce, getPlayer, movePlayer, openWindow, pub, seatOrder, sharedTiles } from './util';

type SettlePhase = Extract<MatchState['phase'], { kind: 'settle' }>;

/** Far above any legal chain (a few movers × a few afterMove effects). */
const MAX_MOVES_PER_STEP = 1000;

/**
 * Step 1 of the settle loop: every mover follows snake/ladder chains, then its
 * afterMove conditionals fire. Returns all players who moved in this step.
 */
export function resolveJumps(s: MatchState, ev: GameEvent[], movers: Mover[]): Mover[] {
  const queue = [...movers];
  const moved = new Map<PlayerId, Mover>();
  // Everyone else's moves from "when" effects (2026-10-16), made once every landing so far has played out.
  const others = new Map<PlayerId, number>();
  let processed = 0;
  for (;;) {
    if (queue.length === 0) {
      if (others.size === 0) break;
      for (const p of s.players) {
        const amount = others.get(p.id);
        if (!amount) continue;
        const raw = p.position + amount;
        movePlayer(s, ev, p.id, bounce(raw, s.board.size), 'effect', raw > s.board.size);
        queue.push({ player: p.id, cause: 'effect' });
      }
      others.clear();
      continue;
    }
    // Valid cards cannot chain forever (validateCards); this guards hand-built effects.
    if (++processed > MAX_MOVES_PER_STEP) throw new InvariantError('runaway afterMove chain while settling');
    const m = queue.shift()!;
    moved.set(m.player, m);
    const p = getPlayer(s, m.player);
    // Snakes and ladders off (2026-10-16): nobody slides or climbs, and no snake shield is used.
    const off = jumpsAreOff(s.effects);
    let guard = 0;
    // What the landing did: its first jump, if one was taken (a "when" effect waits for it).
    let jumped: 'snake' | 'ladder' | null = null;
    for (;;) {
      const j = off ? undefined : jumpFrom(s.board, p.position);
      if (!j) break;
      if (j.to < j.from) {
        const shield = useSnakeShield(s, ev, p.id);
        if (shield) {
          ev.push(pub({ type: 'SnakeBlocked', player: p.id, tile: p.position, effectId: shield }));
          break;
        }
        movePlayer(s, ev, p.id, j.to, 'snake');
        jumped ??= 'snake';
      } else {
        movePlayer(s, ev, p.id, j.to, 'ladder');
        jumped ??= 'ladder';
      }
      if (++guard > s.board.jumps.length) throw new InvariantError('jump cycle while settling');
    }
    const fired = evaluateAfterMove(s, ev, p.id, m.cause, jumped);
    for (const o of fired.others) others.set(o.player, (others.get(o.player) ?? 0) + o.amount);
    const extra = fired.extra;
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
 * Guarded tiles (2026-10-16): on a shared tile whose guard was there before this step, everyone who arrived
 * is knocked back as if they lost a face-off, and no face-off starts. Returns the players knocked back.
 */
function guardTiles(s: MatchState, ev: GameEvent[], movers: Mover[]): Mover[] {
  const arrived = new Set(movers.map((m) => m.player));
  const knockedBack: Mover[] = [];
  for (const tile of sharedTiles(s)) {
    const here = seatOrder(s, s.players.filter((p) => p.position === tile).map((p) => p.id));
    const guard = here.find((id) => !arrived.has(id) && effectsOn(s, id, 'guardTile').length > 0);
    const knocked = guard ? here.filter((id) => id !== guard && arrived.has(id)) : [];
    if (!guard || knocked.length === 0) continue;
    for (const id of knocked) {
      movePlayer(s, ev, id, Math.max(0, tile - s.config.collision.knockback), 'knockback');
      knockedBack.push({ player: id, cause: 'knockback' });
    }
    ev.push(pub({ type: 'TileGuarded', tile, guard, knocked }));
  }
  return knockedBack;
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
          // Sore Loser (2026-10-16): a lost face-off moves its owner forward instead, once.
          const forward = effectsOn(s, loser, 'loseForward')[0];
          if (forward) spendCharge(s, ev, forward);
          const raw = forward ? p.position + s.config.collision.knockback : Math.max(0, p.position - s.config.collision.knockback);
          movePlayer(s, ev, loser, bounce(raw, s.board.size), 'knockback', raw > s.board.size);
          knocked.push({ player: loser, cause: 'knockback' });
        }
      }
      ctx.challenges = [];
      ctx.movers = knocked;
    }

    ctx.movers = resolveJumps(s, ev, ctx.movers);
    const repelled = guardTiles(s, ev, ctx.movers);
    if (repelled.length > 0) {
      ctx.movers = repelled;
      continue;
    }
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
