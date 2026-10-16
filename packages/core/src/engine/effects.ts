import { type ActiveEffect, type EffectHook, type EffectParams, type EffectTemplate, type MoveCause } from '../cards/types';
import type { GameEvent, MatchState, PlayerId } from './types';
import { clonePlain, nextId, pub } from './util';

type ParamsOf<H extends EffectHook> = Extract<EffectParams, { hook: H }>;
type EffectWith<H extends EffectHook> = ActiveEffect & { params: ParamsOf<H> };

/** The owner's effects on one hook, oldest first. */
export function effectsOn<H extends EffectHook>(s: MatchState, owner: PlayerId, hook: H): EffectWith<H>[] {
  return s.effects
    .filter((e): e is EffectWith<H> => e.owner === owner && e.params.hook === hook)
    .sort((a, b) => a.seq - b.seq);
}

export function addEffect(
  s: MatchState,
  ev: GameEvent[],
  owner: PlayerId,
  template: EffectTemplate,
  sourceCard: string,
  sourcePlayer: PlayerId,
): ActiveEffect {
  const id = nextId(s, 'e');
  const effect: ActiveEffect = {
    id,
    owner,
    sourceCard,
    sourcePlayer,
    params: clonePlain(template.params),
    lifetime: clonePlain(template.lifetime),
    createdRound: s.round,
    seq: s.counter,
  };
  s.effects.push(effect);
  ev.push(pub({ type: 'EffectAdded', effect: clonePlain(effect) }));
  return effect;
}

export function removeEffect(s: MatchState, ev: GameEvent[], effectId: string, reason: 'card' | 'charges'): void {
  const idx = s.effects.findIndex((e) => e.id === effectId);
  if (idx < 0) return;
  const [e] = s.effects.splice(idx, 1);
  ev.push(pub({ type: 'EffectRemoved', effectId, owner: e!.owner, reason }));
}

/** The effect fired once: spend a charge if it has charges, removing it at 0. */
export function spendCharge(s: MatchState, ev: GameEvent[], effect: ActiveEffect): void {
  if (effect.lifetime === 'permanent' || effect.lifetime.charges === undefined) return;
  effect.lifetime.charges -= 1;
  if (effect.lifetime.charges <= 0) removeEffect(s, ev, effect.id, 'charges');
}

/** FACE stage (spec §5.6): applied to each die before the 6-check. */
export function applyFaceEffects(
  s: MatchState,
  ev: GameEvent[],
  player: PlayerId,
  dieIndex: number,
  natural: number,
): { face: number; forced: boolean } {
  let face = natural;
  let forced = false;
  for (const e of effectsOn(s, player, 'diceFace')) {
    if (e.params.die === 'each' || dieIndex === 0) {
      face = e.params.set;
      forced = true;
      spendCharge(s, ev, e);
    }
  }
  return { face, forced };
}

/** TOTAL stage (spec §5.6): Replace (newest wins) → Multiply (product) → Add (sum) → floor 0. All diceTotal effects fire. */
export function applyTotalEffects(s: MatchState, ev: GameEvent[], player: PlayerId, sum: number, factor = 1): number {
  const effects = effectsOn(s, player, 'diceTotal');
  let total = sum;
  const replaces = effects.filter((e) => e.params.op === 'replace');
  if (replaces.length > 0) total = replaces[replaces.length - 1]!.params.value;
  // `factor`: a roll check's multiply that held (2026-10-16), one more Multiply.
  total *= factor;
  for (const e of effects) if (e.params.op === 'multiply') total *= e.params.value;
  for (const e of effects) if (e.params.op === 'add') total += e.params.value;
  for (const e of effects) spendCharge(s, ev, e);
  const floored = Math.max(0, Math.trunc(total));
  // A reversed roll (2026-10-16) moves its player back by the total, after every other modifier.
  const reverse = effectsOn(s, player, 'reverseRoll');
  for (const e of reverse) spendCharge(s, ev, e);
  return reverse.length > 0 ? -floored : floored;
}

/** Returns the id of the effect that cancelled the snake, or null. A plain snake shield goes before a snake-or-attack one (2026-10-16). */
export function useSnakeShield(s: MatchState, ev: GameEvent[], player: PlayerId): string | null {
  const shield = effectsOn(s, player, 'beforeSnake')[0] ?? effectsOn(s, player, 'beforeSnakeOrAttack')[0];
  if (!shield) return null;
  spendCharge(s, ev, shield);
  return shield.id;
}

/** Returns the id of the effect that blocked the attack, or null. A plain shield goes before a snake-or-attack one (2026-10-16). */
export function useAttackShield(s: MatchState, ev: GameEvent[], player: PlayerId): string | null {
  const shield = effectsOn(s, player, 'beforeAttack')[0] ?? effectsOn(s, player, 'beforeSnakeOrAttack')[0];
  if (!shield) return null;
  spendCharge(s, ev, shield);
  return shield.id;
}

/**
 * afterMove conditionals (spec §4.5 step 1), on what the move's landing did: slid down a snake, climbed a
 * ladder, or neither. An effect fires only when its slide or climb happened, and only then spends a charge
 * (2026-10-16: the cards say "next time you…"; it used to be spent by the next move on that cause, slide or
 * not). Returns the owner's extra movement, and everyone else's from `who: 'others'` effects.
 */
export function evaluateAfterMove(
  s: MatchState,
  ev: GameEvent[],
  player: PlayerId,
  cause: MoveCause,
  jumped: 'snake' | 'ladder' | null,
): { extra: number; others: Array<{ player: PlayerId; amount: number }> } {
  let extra = 0;
  const others: Array<{ player: PlayerId; amount: number }> = [];
  if (jumped === null) return { extra, others };
  for (const e of effectsOn(s, player, 'afterMove')) {
    if (e.params.cause !== cause) continue;
    if ((e.params.condition === 'landedOnSnakeHead') !== (jumped === 'snake')) continue;
    if (e.params.who === 'others') {
      for (const p of s.players) if (p.id !== player) others.push({ player: p.id, amount: e.params.amount });
    } else {
      extra += e.params.amount;
    }
    spendCharge(s, ev, e);
  }
  return { extra, others };
}

/** Round end (spec §4.11): remove effects whose `rounds` lifetime has run out. */
export function expireEffects(s: MatchState, ev: GameEvent[]): void {
  const keep: ActiveEffect[] = [];
  for (const e of s.effects) {
    const rounds = e.lifetime === 'permanent' ? undefined : e.lifetime.rounds;
    if (rounds !== undefined && s.round >= e.createdRound + rounds) {
      ev.push(pub({ type: 'EffectExpired', effectId: e.id, owner: e.owner }));
    } else {
      keep.push(e);
    }
  }
  s.effects = keep;
}
