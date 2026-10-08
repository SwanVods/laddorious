import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '../board/config';
import { RARITIES } from '../board/types';
import { STARTER_CARDS } from '../cards/starter';
import { CARD_TYPES, type CardDef, type CardType } from '../cards/types';
import { ConfigError } from './errors';
import { validateBoardConfig, validateCardDef } from './validation';

export interface MatchConfig {
  /** Board seed — may be public (daily challenges, shared replays). */
  seed: string;
  /**
   * Seed for the dice, card and misc streams. Keep it secret whenever `seed` is
   * public: anyone who knows it can predict every roll, hand and gamble.
   * Defaults to `seed`.
   */
  rngSeed: string;
  board: BoardConfig;
  windows: { diceMs: number; challengeMs: number; mysteryMs: number };
  mystery: { typeWeights: Record<CardType, number>; maxRerolls: number };
  /** maxReplays: replays/continuations after the initial pick round (spec §4.7: 3 → at most 4 pick rounds). */
  collision: { knockback: number; maxReplays: number; maxWaves: number };
  cards: CardDef[];
  checkInvariants: boolean;
}

/** Board settings where nested objects may be partial too (arrays such as count ranges stay whole). */
export type BoardConfigInput = {
  [K in keyof BoardConfig]?: BoardConfig[K] extends readonly unknown[] ? BoardConfig[K] : BoardConfig[K] extends object ? Partial<BoardConfig[K]> : BoardConfig[K];
};

export interface MatchConfigInput {
  seed: string;
  rngSeed?: string;
  board?: BoardConfigInput;
  windows?: Partial<MatchConfig['windows']>;
  mystery?: Partial<MatchConfig['mystery']>;
  collision?: Partial<MatchConfig['collision']>;
  cards?: CardDef[];
  checkInvariants?: boolean;
}

export const DEFAULT_WINDOWS: MatchConfig['windows'] = {
  diceMs: 12_000,
  challengeMs: 8_000,
  mysteryMs: 30_000,
};

export function resolveConfig(input: MatchConfigInput): MatchConfig {
  if (typeof input.seed !== 'string' || input.seed.length === 0) throw new ConfigError('seed must be a non-empty string');
  if (input.rngSeed !== undefined && (typeof input.rngSeed !== 'string' || input.rngSeed.length === 0)) {
    throw new ConfigError('rngSeed must be a non-empty string');
  }
  const cfg: MatchConfig = {
    seed: input.seed,
    rngSeed: input.rngSeed ?? input.seed,
    board: mergeBoardConfig(input.board),
    windows: { ...DEFAULT_WINDOWS, ...input.windows },
    mystery: {
      typeWeights: { movement: 1, defense: 1, attack: 1, risky: 1, misc: 1 },
      maxRerolls: 2,
      ...input.mystery,
    },
    collision: { knockback: 3, maxReplays: 3, maxWaves: 3, ...input.collision },
    cards: input.cards ?? STARTER_CARDS,
    checkInvariants: input.checkInvariants ?? true,
  };
  validateConfig(cfg);
  return cfg;
}

/** Defaults, with each nested section merged field by field so a partial section keeps its other defaults. */
export function mergeBoardConfig(input: BoardConfigInput = {}): BoardConfig {
  const d = DEFAULT_BOARD_CONFIG;
  return {
    ...d,
    ...input,
    ladders: { ...d.ladders, ...input.ladders },
    snakes: { ...d.snakes, ...input.snakes },
    mysteryRarityWeights: { ...d.mysteryRarityWeights, ...input.mysteryRarityWeights },
    finishZone: { ...d.finishZone, ...input.finishZone },
    mysterySpacing: { ...d.mysterySpacing, ...input.mysterySpacing },
    analysis: { ...d.analysis, ...input.analysis },
  };
}

export function validateConfig(cfg: MatchConfig): void {
  validateBoardConfig(cfg.board);
  const knownWindows = Object.keys(DEFAULT_WINDOWS);
  for (const [k, v] of Object.entries(cfg.windows)) {
    if (!knownWindows.includes(k)) throw new ConfigError(`windows.${k} is not a known window (expected ${knownWindows.join(', ')})`);
    if (!Number.isInteger(v) || v <= 0) throw new ConfigError(`windows.${k} must be a positive integer, got ${v}`);
  }
  const { knockback, maxReplays, maxWaves } = cfg.collision;
  if (!Number.isInteger(knockback) || knockback < 1) throw new ConfigError('collision.knockback must be >= 1');
  if (!Number.isInteger(maxReplays) || maxReplays < 0) throw new ConfigError('collision.maxReplays must be >= 0');
  if (!Number.isInteger(maxWaves) || maxWaves < 1) throw new ConfigError('collision.maxWaves must be >= 1');
  if (!Number.isInteger(cfg.mystery.maxRerolls) || cfg.mystery.maxRerolls < 0 || cfg.mystery.maxRerolls > 3) {
    throw new ConfigError('mystery.maxRerolls must be 0..3');
  }
  const typeWeights = CARD_TYPES.map((type) => cfg.mystery.typeWeights[type]);
  if (!typeWeights.every((w) => Number.isInteger(w) && w >= 0) || !typeWeights.some((w) => w > 0)) {
    throw new ConfigError('mystery.typeWeights must be non-negative integers, not all 0');
  }
  validateCards(cfg.cards);
}

/** Each card is well-formed, ids are unique, and every (type, rarity) bucket holds at least one card. */
export function validateCards(cards: CardDef[]): void {
  const ids = new Set<string>();
  for (const c of cards) {
    if (ids.has(c.id)) throw new ConfigError(`duplicate card id ${c.id}`);
    ids.add(c.id);
    validateCardDef(c);
  }
  for (const type of CARD_TYPES) {
    for (const rarity of RARITIES) {
      if (!cards.some((c) => c.type === type && c.rarity === rarity)) {
        throw new ConfigError(`no card for bucket (${type}, ${rarity})`);
      }
    }
  }
}
