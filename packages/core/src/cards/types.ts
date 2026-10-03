import type { JumpKind, Rarity } from '../board/types';

export type CardType = 'movement' | 'defense' | 'attack' | 'risky' | 'misc';
/** Resolution order by type (spec §5.4). */
export const CARD_TYPES: readonly CardType[] = ['movement', 'defense', 'attack', 'risky', 'misc'];
/** Resolution order by rarity within a type (spec §5.4). */
export const RARITY_ORDER: readonly Rarity[] = ['epic', 'rare', 'common'];

export type MoveCause = 'dice' | 'snake' | 'ladder' | 'knockback' | 'card' | 'effect' | 'stepBack';

export interface TargetRule {
  condition: 'self' | 'other' | 'ahead-of-caster' | 'behind-of-caster' | 'section';
  /** Inclusive tile range, required when condition is 'section'. */
  section?: [number, number];
  pick: 'self' | 'nearest' | 'furthest' | 'leader' | 'last';
  tieBreak: 'random' | 'lowest-seat';
}

/** 'permanent', or remaining rounds and/or charges — whichever runs out first. */
export type Lifetime = { rounds?: number; charges?: number } | 'permanent';

export type EffectParams =
  | { hook: 'diceFace'; die: 'first' | 'each'; set: number }
  | { hook: 'diceTotal'; op: 'replace' | 'multiply' | 'add'; value: number }
  | { hook: 'beforeSnake' }
  | { hook: 'beforeAttack' }
  | { hook: 'afterMove'; cause: MoveCause; condition: 'landedOnSnakeHead'; amount: number };

export type EffectHook = EffectParams['hook'];

export interface EffectTemplate {
  params: EffectParams;
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
  | { op: 'moveRelative'; amount: number }
  | { op: 'moveTo'; rule: 'nearest-ladder-foot-ahead' }
  | { op: 'swap' }
  | { op: 'addEffect'; template: EffectTemplate }
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
