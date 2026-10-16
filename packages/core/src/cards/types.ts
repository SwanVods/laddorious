import type { JumpKind, Rarity } from '../board/types';

export type CardType = 'movement' | 'defense' | 'attack' | 'risky' | 'misc';
/** Every card type. Cards no longer resolve by type: they go one at a time, last place first (2026-10-14). */
export const CARD_TYPES: readonly CardType[] = ['movement', 'defense', 'attack', 'risky', 'misc'];

export type MoveCause = 'dice' | 'snake' | 'ladder' | 'knockback' | 'card' | 'effect' | 'stepBack';

export interface TargetRule {
  /** 'everyone' takes the caster too; it goes with pick 'all' (2026-10-15). */
  condition: 'self' | 'other' | 'everyone' | 'ahead-of-caster' | 'behind-of-caster' | 'section';
  /** Inclusive tile range, required when condition is 'section'. */
  section?: [number, number];
  /** 'all' hits every candidate, in seat order (2026-10-15). */
  pick: 'self' | 'nearest' | 'furthest' | 'leader' | 'last' | 'all';
  tieBreak: 'random' | 'lowest-seat';
}

/** 'permanent', or remaining rounds and/or charges — whichever runs out first. */
export type Lifetime = { rounds?: number; charges?: number } | 'permanent';

export type EffectParams =
  | { hook: 'diceFace'; die: 'first' | 'each'; set: number }
  | { hook: 'diceTotal'; op: 'replace' | 'multiply' | 'add'; value: number }
  | { hook: 'beforeSnake' }
  | { hook: 'beforeAttack' }
  | { hook: 'afterMove'; cause: MoveCause; condition: 'landedOnSnakeHead'; amount: number }
  /** Skip the owner's next roll (2026-10-16). */
  | { hook: 'skipRoll' }
  /** The owner's next roll moves them back (2026-10-16). */
  | { hook: 'reverseRoll' }
  /** Blocks the owner's next snake or attack, whichever comes first (2026-10-16). */
  | { hook: 'beforeSnakeOrAttack' }
  /** Snakes and ladders do nothing, for everyone, while it lasts (2026-10-16). */
  | { hook: 'jumpsOff' };

export type EffectHook = EffectParams['hook'];

export interface EffectTemplate {
  params: EffectParams;
  lifetime: Lifetime;
}

/** The card's own die (2026-10-15): rolled once when the card resolves, 1–6. */
export interface DieAmount {
  die: true;
  /** Use it as a step back, or a minus. */
  negate?: boolean;
}

/** A number on a card that may be the card's own die. */
export type CardNumber = number | DieAmount;

/** Whether snakes and ladders are off for everyone right now (2026-10-16). */
export const jumpsAreOff = (effects: readonly { params: { hook: string } }[]): boolean => effects.some((e) => e.params.hook === 'jumpsOff');

export const isDie = (x: unknown): x is DieAmount => typeof x === 'object' && x !== null && (x as { die?: unknown }).die === true;

/** An effect as a card writes it: a next-roll add may use the card's die. */
export type CardEffectParams =
  | Exclude<EffectParams, { hook: 'diceTotal' }>
  | { hook: 'diceTotal'; op: 'replace' | 'multiply' | 'add'; value: CardNumber };

export interface CardEffectTemplate {
  params: CardEffectParams;
  lifetime: Lifetime;
}

export interface ActiveEffect {
  id: string;
  /** The player the effect is attached to. */
  owner: string;
  sourceCard: string;
  sourcePlayer: string;
  params: EffectParams;
  /** Remaining lifetime; charges are decremented in place. */
  lifetime: Lifetime;
  createdRound: number;
  /** Global creation order. */
  seq: number;
}

export type BoardEditLifetime = { rounds: number } | 'permanent';

export type BoardEditOp =
  | { op: 'boardEdit'; action: 'create'; kind: JumpKind; minAhead: number; maxAhead: number; length: number; lifetime: BoardEditLifetime }
  | { op: 'boardEdit'; action: 'remove'; kind: JumpKind; lifetime: BoardEditLifetime }
  | { op: 'boardEdit'; action: 'move'; kind: JumpKind; minAhead: number; maxAhead: number; lifetime: BoardEditLifetime }
  | { op: 'boardEdit'; action: 'modify'; kind: JumpKind; lengthDelta: number; lifetime: BoardEditLifetime };

export type EffectOp =
  | { op: 'moveRelative'; amount: CardNumber }
  | { op: 'moveTo'; rule: 'nearest-ladder-foot-ahead' }
  | { op: 'swap' }
  | { op: 'addEffect'; template: CardEffectTemplate }
  | { op: 'removeEffects'; filter: { createdByOthers?: boolean; hook?: EffectHook }; count: number | 'all' }
  | BoardEditOp
  | { op: 'gamble'; outcomes: Array<{ weight: number; ops: EffectOp[] }> }
  | { op: 'conditional'; trigger: { cause: MoveCause; condition: 'landedOnSnakeHead' }; amount: number; lifetime: Lifetime };

export interface CardDef {
  id: string;
  name: string;
  text: string;
  type: CardType;
  rarity: Rarity;
  weight: number;
  target: TargetRule;
  effects: EffectOp[];
}

/** Whether any step of the card uses its own die. */
export function usesDie(card: { effects: unknown }): boolean {
  const walk = (x: unknown): boolean => isDie(x) || (typeof x === 'object' && x !== null && Object.values(x).some(walk));
  return walk(card.effects);
}
