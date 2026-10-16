import { jumpKind } from '../board/types';
import { applyPlannedEdit, planBoardEdit } from '../cards/boardEdit';
import { cardById } from '../cards/catalog';
import { isValidTarget, selectTarget, targetCandidates } from '../cards/targeting';
import { isDie, usesDie, type CardDef, type EffectOp, type EffectTemplate } from '../cards/types';
import { nextInt, pickWeighted } from '../rng/stream';
import { addEffect, removeEffect, useAttackShield } from './effects';
import type { BoardEdit, CardResult, GameEvent, MatchState, Mover, PendingCard, PlayerId } from './types';
import { bounce, clonePlain, getPlayer, movePlayer, nextId, pub, seatOrder } from './util';

/**
 * Order pending cards for resolution: one card at a time, from the last-placed caster to the leader, a tie
 * on one tile by seat (the user, 2026-10-14; replaces spec §5.4's order by type). Each card resolves against
 * the board the one before it left, so cards never clash.
 */
export function groupPendingCards(players: ReadonlyArray<{ id: PlayerId; position: number }>, pending: PendingCard[]): PendingCard[][] {
  const place = (id: PlayerId) => players.findIndex((p) => p.id === id);
  const position = (id: PlayerId) => players[place(id)]!.position;
  return [...pending].sort((a, b) => position(a.caster) - position(b.caster) || place(a.caster) - place(b.caster)).map((pc) => [pc]);
}

interface CardIntents {
  deltas: Array<{ player: PlayerId; amount: number }>;
  placements: Array<Array<{ player: PlayerId; tile: number }>>;
  adds: Array<{ owner: PlayerId; template: EffectTemplate }>;
  removals: string[];
  edits: Array<Extract<EffectOp, { op: 'boardEdit' }>>;
}

interface CardOutcome {
  pc: PendingCard;
  card: CardDef;
  target: PlayerId | null;
  result: CardResult;
  reason?: 'no-target' | 'no-placement' | 'clash';
  /** The card's own die, when it has one. */
  roll?: number;
  /** A card for several players: who it hit, and whose shield blocked it. */
  targets?: PlayerId[];
  blocked?: PlayerId[];
  intents: CardIntents | null;
}

/** A card's steps with its die roll put in (2026-10-15). */
function withRoll<T>(x: T, roll: number | undefined): T {
  if (isDie(x)) return ((x.negate ? -1 : 1) * roll!) as T;
  if (Array.isArray(x)) return x.map((y: unknown) => withRoll(y, roll)) as T;
  if (typeof x === 'object' && x !== null) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, withRoll(v, roll)])) as T;
  return x;
}

/** Where a "move to" step lands, from the target's tile, or null when there is no such place (2026-10-16). */
function moveToTile(s: MatchState, op: Extract<EffectOp, { op: 'moveTo' }>, from: number): number | null {
  const heads = (kind: 'snake' | 'ladder') => s.board.jumps.filter((j) => jumpKind(j) === kind).map((j) => j.from);
  switch (op.rule) {
    case 'nearest-ladder-foot-ahead': {
      const ahead = heads('ladder').filter((t) => t > from);
      return ahead.length > 0 ? Math.min(...ahead) : null;
    }
    case 'snake-head-ahead': {
      const ahead = heads('snake').filter((t) => t > from);
      return ahead.length > 0 ? Math.min(...ahead) : null;
    }
    case 'ladder-foot-behind': {
      const behind = heads('ladder').filter((t) => t < from);
      return behind.length > 0 ? Math.max(...behind) : null;
    }
    case 'nearest-snake-head': {
      // The closest head either way; a tie goes to the one behind.
      const near = heads('snake').filter((t) => t !== from).sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);
      return near[0] ?? null;
    }
    case 'target':
      return bounce(from + (op.offset ?? 0), s.board.size);
    case 'tile':
      return op.tile !== undefined && op.tile >= 1 && op.tile < s.board.size ? op.tile : null;
  }
}

/** Expand a card's ops against the current (snapshot) state. Returns null if an op has no valid placement. */
function collectIntents(s: MatchState, card: CardDef, caster: PlayerId, target: PlayerId, roll?: number): CardIntents | null {
  const intents: CardIntents = { deltas: [], placements: [], adds: [], removals: [], edits: [] };
  const targetPos = getPlayer(s, target).position;
  const visit = (op: EffectOp): boolean => {
    switch (op.op) {
      case 'moveRelative':
        intents.deltas.push({ player: target, amount: op.amount as number });
        return true;
      case 'moveTo': {
        const tile = moveToTile(s, op, targetPos);
        if (tile === null) return false;
        // `target` moves the caster to the target (Catch Up, Overtake); every other rule moves the target.
        intents.placements.push([{ player: op.rule === 'target' ? caster : target, tile }]);
        return true;
      }
      case 'swap': {
        if (target === caster) return false;
        const casterPos = getPlayer(s, caster).position;
        intents.placements.push([
          { player: caster, tile: targetPos },
          { player: target, tile: casterPos },
        ]);
        return true;
      }
      case 'addEffect':
        intents.adds.push({ owner: op.onCaster ? caster : target, template: op.template as EffectTemplate });
        return true;
      case 'conditional':
        intents.adds.push({
          owner: target,
          template: {
            params: { hook: 'afterMove', cause: op.trigger.cause, condition: op.trigger.condition, amount: op.amount, ...(op.who ? { who: op.who } : {}) },
            lifetime: op.lifetime,
          },
        });
        return true;
      case 'removeEffects': {
        const matching = s.effects
          .filter((e) => e.owner === target)
          .filter((e) => !op.filter.createdByOthers || e.sourcePlayer !== target)
          .filter((e) => !op.filter.hook || e.params.hook === op.filter.hook)
          .sort((a, b) => a.seq - b.seq);
        const n = op.count === 'all' ? matching.length : op.count;
        intents.removals.push(...matching.slice(0, n).map((e) => e.id));
        return true;
      }
      case 'boardEdit':
        intents.edits.push(op);
        return true;
      case 'gamble': {
        const chosen = op.outcomes[pickWeighted(s.rng.misc, op.outcomes.map((o) => o.weight))]!;
        return chosen.ops.every(visit);
      }
    }
  };
  const effects = roll === undefined ? card.effects : withRoll(card.effects, roll);
  return effects.every(visit) ? intents : null;
}

/** A card for several players (2026-10-15): each in seat order, a shield blocking it for its owner alone. */
function resolveAll(s: MatchState, ev: GameEvent[], pc: PendingCard, card: CardDef): CardOutcome {
  const caster = getPlayer(s, pc.caster);
  const candidates = seatOrder(s, new Set(targetCandidates(s.players, caster, card.target).map((p) => p.id)));
  if (candidates.length === 0) return { pc, card, target: null, result: 'fizzled', reason: 'no-target', intents: null };
  const roll = usesDie(card) ? 1 + nextInt(s.rng.misc, 6) : undefined;
  const merged: CardIntents = { deltas: [], placements: [], adds: [], removals: [], edits: [] };
  const targets: PlayerId[] = [];
  const blocked: PlayerId[] = [];
  for (const target of candidates) {
    if (card.type === 'attack' && target !== pc.caster && useAttackShield(s, ev, target)) {
      blocked.push(target);
      continue;
    }
    const intents = collectIntents(s, card, pc.caster, target, roll);
    if (!intents) continue;
    merged.deltas.push(...intents.deltas);
    merged.placements.push(...intents.placements);
    merged.adds.push(...intents.adds);
    merged.removals.push(...intents.removals);
    targets.push(target);
  }
  const result: CardResult = targets.length > 0 ? 'hit' : blocked.length > 0 ? 'blocked' : 'fizzled';
  return {
    pc, card, target: null, roll, targets, blocked, result,
    ...(result === 'fizzled' ? { reason: 'no-placement' as const } : {}),
    intents: targets.length > 0 ? merged : null,
  };
}

/**
 * Resolve one simultaneous group (spec §5.4) and return the players whose
 * position changed (they are settled next).
 */
export function resolveGroup(s: MatchState, ev: GameEvent[], group: PendingCard[]): Mover[] {
  const snapshot = new Map(s.players.map((p) => [p.id, p.position] as const));
  const outcomes: CardOutcome[] = [];

  for (const pc of group) {
    const card = cardById(s.config.cards, pc.cardId);
    if (card.target.pick === 'all') {
      outcomes.push(resolveAll(s, ev, pc, card));
      continue;
    }
    const caster = getPlayer(s, pc.caster);
    const target =
      pc.target !== null && isValidTarget(s.players, caster, card.target, pc.target)
        ? pc.target
        : selectTarget(s.players, caster, card.target, s.rng.misc);
    if (target === null) {
      outcomes.push({ pc, card, target: null, result: 'fizzled', reason: 'no-target', intents: null });
      continue;
    }
    // The card's own die (2026-10-15): rolled once, after a target is found.
    const roll = usesDie(card) ? 1 + nextInt(s.rng.misc, 6) : undefined;
    if (card.type === 'attack' && target !== pc.caster && useAttackShield(s, ev, target)) {
      outcomes.push({ pc, card, target, roll, result: 'blocked', intents: null });
      continue;
    }
    const intents = collectIntents(s, card, pc.caster, target, roll);
    if (!intents) {
      outcomes.push({ pc, card, target, roll, result: 'fizzled', reason: 'no-placement', intents: null });
      continue;
    }
    // Board edits apply immediately in caster seat order; they only fire on landing (D9).
    let editFailed = false;
    for (const op of intents.edits) {
      const editId = nextId(s, 'x');
      const plan = planBoardEdit(s.board, op, getPlayer(s, target).position, editId);
      if (!plan) {
        editFailed = true;
        continue;
      }
      applyPlannedEdit(s.board, plan);
      const edit: BoardEdit = {
        id: editId,
        added: plan.added,
        removed: plan.removed,
        lifetime: op.lifetime,
        createdRound: s.round,
        sourceCard: card.id,
        sourcePlayer: pc.caster,
      };
      s.boardEdits.push(edit);
      ev.push(pub({ type: 'BoardEdited', edit: clonePlain(edit) }));
    }
    if (editFailed && intents.edits.length === card.effects.length) {
      outcomes.push({ pc, card, target, roll, result: 'fizzled', reason: 'no-placement', intents: null });
      continue;
    }
    outcomes.push({ pc, card, target, roll, result: 'hit', intents });
  }

  // Clash: absolute placements touching the same player all fizzle (D11).
  const touches = new Map<PlayerId, number>();
  for (const o of outcomes) for (const pl of o.intents?.placements ?? []) for (const t of pl) touches.set(t.player, (touches.get(t.player) ?? 0) + 1);
  const clashed = outcomes.filter((o) => o.intents?.placements.some((pl) => pl.some((t) => touches.get(t.player)! > 1)));
  if (clashed.length > 0) {
    const players = new Set(clashed.flatMap((o) => o.intents!.placements.flat().map((t) => t.player)));
    ev.push(pub({ type: 'Clash', cardIds: clashed.map((o) => o.card.id), casters: clashed.map((o) => o.pc.caster), players: seatOrder(s, players) }));
    for (const o of clashed) {
      o.result = 'fizzled';
      o.reason = 'clash';
      o.intents!.placements = [];
    }
  }

  for (const o of outcomes) {
    ev.push(
      pub({
        type: 'CardResolved',
        caster: o.pc.caster,
        cardId: o.card.id,
        target: o.target,
        result: o.result,
        ...(o.reason ? { reason: o.reason } : {}),
        ...(o.roll !== undefined ? { roll: o.roll } : {}),
        ...(o.targets ? { targets: o.targets, blocked: o.blocked ?? [] } : {}),
      }),
    );
  }

  // Positions: surviving placement first, then summed relative moves, with bounce.
  const placed = new Map<PlayerId, number>();
  const deltas = new Map<PlayerId, number>();
  for (const o of outcomes) {
    for (const pl of o.intents?.placements ?? []) for (const t of pl) placed.set(t.player, t.tile);
    for (const d of o.intents?.deltas ?? []) deltas.set(d.player, (deltas.get(d.player) ?? 0) + d.amount);
  }
  const movers: Mover[] = [];
  for (const p of s.players) {
    const start = snapshot.get(p.id)!;
    const base = placed.get(p.id) ?? start;
    const raw = base + (deltas.get(p.id) ?? 0);
    const to = bounce(raw, s.board.size);
    const bounced = raw > s.board.size;
    if (to !== start || bounced) {
      movePlayer(s, ev, p.id, to, 'card', bounced);
      movers.push({ player: p.id, cause: 'card' });
    }
  }

  // Effects: removals only see effects that existed before this group's adds.
  for (const o of outcomes) for (const id of o.intents?.removals ?? []) removeEffect(s, ev, id, 'card');
  for (const o of outcomes) {
    for (const a of o.intents?.adds ?? []) addEffect(s, ev, a.owner, a.template, o.card.id, o.pc.caster);
  }
  return movers;
}
