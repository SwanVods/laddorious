import type { BoardConfig } from '../board/config';
import { RARITIES } from '../board/types';
import {
  CARD_TYPES,
  isDie,
  usesDie,
  type BoardEditLifetime,
  type CardDef,
  type CardEffectParams,
  type EffectOp,
  type Lifetime,
  type MoveCause,
} from '../cards/types';
import { ConfigError } from './errors';

const MOVE_CAUSES: readonly MoveCause[] = ['dice', 'snake', 'ladder', 'knockback', 'card', 'effect', 'stepBack'];
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isPositiveInt = (v: unknown): v is number => isInt(v) && v > 0;

function check(ok: boolean, where: string, message: string): void {
  if (!ok) throw new ConfigError(`${where}: ${message}`);
}

function checkLifetime(lifetime: Lifetime, where: string): void {
  if (lifetime === 'permanent') return;
  check(typeof lifetime === 'object' && lifetime !== null, where, 'lifetime must be "permanent" or { rounds?, charges? }');
  const { rounds, charges } = lifetime;
  check(rounds !== undefined || charges !== undefined, where, 'lifetime needs rounds and/or charges');
  check(rounds === undefined || isPositiveInt(rounds), where, 'lifetime.rounds must be a positive integer');
  check(charges === undefined || isPositiveInt(charges), where, 'lifetime.charges must be a positive integer');
}

function checkEditLifetime(lifetime: BoardEditLifetime, where: string): void {
  check(lifetime === 'permanent' || isPositiveInt(lifetime?.rounds), where, 'board edit lifetime must be "permanent" or { rounds: positive integer }');
}

/**
 * An afterMove effect keyed on 'effect' re-triggers on the movement it causes,
 * so it must run out of charges or it could loop forever (spec §4.6 termination).
 */
function checkAfterMove(cause: MoveCause, lifetime: Lifetime, where: string): void {
  check(MOVE_CAUSES.includes(cause), where, `unknown move cause ${String(cause)}`);
  if (cause === 'effect') {
    check(lifetime !== 'permanent' && isPositiveInt(lifetime.charges), where, "an afterMove effect on cause 'effect' needs charges");
  }
}

function checkParams(params: CardEffectParams, lifetime: Lifetime, where: string): void {
  switch (params.hook) {
    case 'diceFace':
      check(params.die === 'first' || params.die === 'each', where, 'diceFace.die must be first or each');
      check(isInt(params.set) && params.set >= 1 && params.set <= 6, where, 'diceFace.set must be 1..6');
      return;
    case 'diceTotal':
      check(['replace', 'multiply', 'add'].includes(params.op), where, 'diceTotal.op must be replace, multiply or add');
      check(isInt(params.value) || (params.op === 'add' && isDie(params.value)), where, DIE_PLACES);
      check(params.op === 'add' || (params.value as number) >= 0, where, 'diceTotal replace/multiply value must be >= 0');
      return;
    case 'beforeSnake':
    case 'beforeAttack':
      return;
    case 'afterMove':
      check(params.condition === 'landedOnSnakeHead', where, 'unknown afterMove condition');
      check(isInt(params.amount), where, 'afterMove.amount must be an integer');
      checkAfterMove(params.cause, lifetime, where);
      return;
    default:
      check(false, where, `unknown effect hook ${String((params as { hook?: unknown }).hook)}`);
  }
}

const DIE_PLACES = "the card's die can only be used to move or to add to a roll";

/** A card's steps with the card's die taken out of the places it may go, so any die left is misplaced. */
function withoutAllowedDie(op: EffectOp): EffectOp {
  if (op.op === 'moveRelative' && isDie(op.amount)) return { ...op, amount: 0 };
  if (op.op === 'addEffect' && op.template.params.hook === 'diceTotal' && op.template.params.op === 'add' && isDie(op.template.params.value)) {
    return { ...op, template: { ...op.template, params: { ...op.template.params, value: 0 } } };
  }
  if (op.op === 'gamble') return { ...op, outcomes: op.outcomes.map((o) => ({ ...o, ops: o.ops.map(withoutAllowedDie) })) };
  return op;
}

function checkOps(ops: EffectOp[], where: string): void {
  check(Array.isArray(ops), where, 'effects must be an array');
  ops.forEach((op, i) => {
    const at = `${where}[${i}]`;
    switch (op.op) {
      case 'moveRelative':
        check(isInt(op.amount) || isDie(op.amount), at, "moveRelative.amount must be an integer or the card's die");
        return;
      case 'moveTo':
        check(op.rule === 'nearest-ladder-foot-ahead', at, 'unknown moveTo rule');
        return;
      case 'swap':
        return;
      case 'addEffect':
        checkLifetime(op.template.lifetime, at);
        checkParams(op.template.params, op.template.lifetime, at);
        return;
      case 'removeEffects':
        check(op.count === 'all' || isPositiveInt(op.count), at, 'removeEffects.count must be "all" or a positive integer');
        return;
      case 'boardEdit':
        check(op.kind === 'snake' || op.kind === 'ladder', at, 'boardEdit.kind must be snake or ladder');
        checkEditLifetime(op.lifetime, at);
        if (op.action === 'create' || op.action === 'move') {
          check(isPositiveInt(op.minAhead) && isInt(op.maxAhead) && op.maxAhead >= op.minAhead, at, 'boardEdit needs 1 <= minAhead <= maxAhead');
        }
        if (op.action === 'create') check(isPositiveInt(op.length), at, 'boardEdit.length must be a positive integer');
        if (op.action === 'modify') check(isInt(op.lengthDelta), at, 'boardEdit.lengthDelta must be an integer');
        check(['create', 'remove', 'move', 'modify'].includes(op.action), at, 'unknown boardEdit action');
        return;
      case 'gamble':
        check(Array.isArray(op.outcomes) && op.outcomes.length > 0, at, 'gamble needs at least one outcome');
        op.outcomes.forEach((o, j) => {
          check(isPositiveInt(o.weight), `${at}.outcomes[${j}]`, 'gamble weights must be positive integers');
          checkOps(o.ops, `${at}.outcomes[${j}].ops`);
        });
        return;
      case 'conditional':
        check(op.trigger?.condition === 'landedOnSnakeHead', at, 'unknown conditional trigger');
        check(isInt(op.amount), at, 'conditional.amount must be an integer');
        checkLifetime(op.lifetime, at);
        checkAfterMove(op.trigger.cause, op.lifetime, at);
        return;
      default:
        check(false, at, `unknown op ${String((op as { op?: unknown }).op)}`);
    }
  });
}

/** Shape and value checks for one card definition. */
export function validateCardDef(c: CardDef): void {
  const where = `card ${String(c.id)}`;
  check(typeof c.id === 'string' && c.id.length > 0, where, 'id must be a non-empty string');
  check(CARD_TYPES.includes(c.type), where, `unknown type ${String(c.type)}`);
  check(RARITIES.includes(c.rarity), where, `unknown rarity ${String(c.rarity)}`);
  check(isPositiveInt(c.weight), where, 'weight must be a positive integer');
  const t = c.target;
  check(['self', 'other', 'ahead-of-caster', 'behind-of-caster', 'section'].includes(t?.condition), where, 'unknown target condition');
  check(['self', 'nearest', 'furthest', 'leader', 'last'].includes(t.pick), where, 'unknown target pick');
  check(t.tieBreak === 'random' || t.tieBreak === 'lowest-seat', where, 'unknown target tieBreak');
  if (t.condition === 'section') {
    check(Array.isArray(t.section) && isInt(t.section[0]) && isInt(t.section[1]) && t.section[0] <= t.section[1], where, 'section must be [from, to]');
  }
  check(!Array.isArray(c.effects) || !usesDie({ effects: c.effects.map(withoutAllowedDie) }), where, DIE_PLACES);
  checkOps(c.effects, `${where}.effects`);
}

/** Value checks for a fully merged board config (spec §7.2, §9). */
export function validateBoardConfig(b: BoardConfig): void {
  const range = (r: [number, number], min: number, name: string) =>
    check(Array.isArray(r) && isInt(r[0]) && isInt(r[1]) && r[0] >= min && r[1] >= r[0], 'board', `${name} must be [lo, hi] integers with ${min} <= lo <= hi`);
  check(isInt(b.size) && b.size >= 10, 'board', 'size must be an integer >= 10');
  check(isPositiveInt(b.generatorVersion), 'board', 'generatorVersion must be a positive integer');
  range(b.ladders.count, 0, 'ladders.count');
  range(b.ladders.length, 1, 'ladders.length');
  range(b.snakes.count, 0, 'snakes.count');
  range(b.snakes.length, 1, 'snakes.length');
  check(Number.isFinite(b.mysteryDensity) && b.mysteryDensity >= 0 && b.mysteryDensity < 1, 'board', 'mysteryDensity must be in [0, 1)');
  const weights = RARITIES.map((r) => b.mysteryRarityWeights[r]);
  check(weights.every((w) => isInt(w) && w >= 0) && weights.some((w) => w > 0), 'board', 'mysteryRarityWeights must be non-negative integers, not all 0');
  check(isInt(b.finishZone.tiles) && b.finishZone.tiles >= 0, 'board', 'finishZone.tiles must be an integer >= 0');
  check(isInt(b.finishZone.maxSnakes) && b.finishZone.maxSnakes >= 0, 'board', 'finishZone.maxSnakes must be an integer >= 0');
  check(isPositiveInt(b.finishZone.maxSnakeLength), 'board', 'finishZone.maxSnakeLength must be a positive integer');
  check(isPositiveInt(b.maxConsecutiveSnakeHeads), 'board', 'maxConsecutiveSnakeHeads must be a positive integer');
  const sp = b.mysterySpacing;
  check(isPositiveInt(sp.maxPerWindow) && isPositiveInt(sp.window) && isPositiveInt(sp.maxGap), 'board', 'mysterySpacing values must be positive integers');
  const a = b.analysis;
  check(Array.isArray(a.median4pRounds) && Number.isFinite(a.median4pRounds[0]) && a.median4pRounds[1] >= a.median4pRounds[0], 'board', 'analysis.median4pRounds must be [lo, hi]');
  check(isPositiveInt(a.maxRounds2p), 'board', 'analysis.maxRounds2p must be a positive integer');
  check(Number.isFinite(a.maxTailProbability) && a.maxTailProbability >= 0 && a.maxTailProbability <= 1, 'board', 'analysis.maxTailProbability must be in [0, 1]');
  check(isPositiveInt(b.maxAttempts), 'board', 'maxAttempts must be a positive integer');
}
