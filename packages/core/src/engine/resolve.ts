import { jumpKind } from '../board/types';
import { applyPlannedEdit, planBoardEdit } from '../cards/boardEdit';
import { cardById } from '../cards/catalog';
import { isValidTarget, selectTarget } from '../cards/targeting';
import { CARD_TYPES, RARITY_ORDER, type CardDef, type EffectOp, type EffectTemplate } from '../cards/types';
import { pickWeighted } from '../rng/stream';
import { addEffect, removeEffect, useAttackShield } from './effects';
import type { BoardEdit, CardResult, GameEvent, MatchState, Mover, PendingCard, PlayerId } from './types';
import { bounce, clonePlain, getPlayer, movePlayer, nextId, pub, seatOrder } from './util';

/** Order pending cards into resolution groups: type, then rarity; same type+rarity = one group (spec §5.4). */
export function groupPendingCards(cards: readonly CardDef[], pending: PendingCard[]): PendingCard[][] {
  const groups: PendingCard[][] = [];
  for (const type of CARD_TYPES) {
    for (const rarity of RARITY_ORDER) {
      const group = pending.filter((pc) => {
        const c = cardById(cards, pc.cardId);
        return c.type === type && c.rarity === rarity;
      });
      if (group.length > 0) groups.push(group);
    }
  }
  return groups;
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
  intents: CardIntents | null;
}

/** Expand a card's ops against the current (snapshot) state. Returns null if an op has no valid placement. */
function collectIntents(s: MatchState, card: CardDef, caster: PlayerId, target: PlayerId): CardIntents | null {
  const intents: CardIntents = { deltas: [], placements: [], adds: [], removals: [], edits: [] };
  const targetPos = getPlayer(s, target).position;
  const visit = (op: EffectOp): boolean => {
    switch (op.op) {
      case 'moveRelative':
        intents.deltas.push({ player: target, amount: op.amount });
        return true;
      case 'moveTo': {
        const foot = s.board.jumps
          .filter((j) => jumpKind(j) === 'ladder' && j.from > targetPos)
          .sort((a, b) => a.from - b.from)[0];
        if (!foot) return false;
        intents.placements.push([{ player: target, tile: foot.from }]);
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
        intents.adds.push({ owner: target, template: op.template });
        return true;
      case 'conditional':
        intents.adds.push({
          owner: target,
          template: {
            params: { hook: 'afterMove', cause: op.trigger.cause, condition: op.trigger.condition, amount: op.amount },
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
  return card.effects.every(visit) ? intents : null;
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
    const caster = getPlayer(s, pc.caster);
    const target =
      pc.target !== null && isValidTarget(s.players, caster, card.target, pc.target)
        ? pc.target
        : selectTarget(s.players, caster, card.target, s.rng.misc);
    if (target === null) {
      outcomes.push({ pc, card, target: null, result: 'fizzled', reason: 'no-target', intents: null });
      continue;
    }
    if (card.type === 'attack' && target !== pc.caster && useAttackShield(s, ev, target)) {
      outcomes.push({ pc, card, target, result: 'blocked', intents: null });
      continue;
    }
    const intents = collectIntents(s, card, pc.caster, target);
    if (!intents) {
      outcomes.push({ pc, card, target, result: 'fizzled', reason: 'no-placement', intents: null });
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
      outcomes.push({ pc, card, target, result: 'fizzled', reason: 'no-placement', intents: null });
      continue;
    }
    outcomes.push({ pc, card, target, result: 'hit', intents });
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
