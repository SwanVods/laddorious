import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '../board/config';
import { RARITIES } from '../board/types';
import { STARTER_CARDS } from '../cards/starter';
import { CARD_TYPES, type CardDef, type CardType } from '../cards/types';
import { ConfigError } from './errors';

export interface MatchConfig {
  seed: string;
  board: BoardConfig;
  windows: { diceMs: number; bonusGraceMs: number; challengeMs: number; mysteryMs: number };
  mystery: { typeWeights: Record<CardType, number>; maxRerolls: number };
  /** maxReplays: replays/continuations after the initial pick round (spec §4.7: 3 → at most 4 pick rounds). */
  collision: { knockback: number; maxReplays: number; maxWaves: number };
  cards: CardDef[];
  checkInvariants: boolean;
}

export interface MatchConfigInput {
  seed: string;
  board?: Partial<BoardConfig>;
  windows?: Partial<MatchConfig['windows']>;
  mystery?: Partial<MatchConfig['mystery']>;
  collision?: Partial<MatchConfig['collision']>;
  cards?: CardDef[];
  checkInvariants?: boolean;
}

export const DEFAULT_WINDOWS: MatchConfig['windows'] = {
  diceMs: 12_000,
  bonusGraceMs: 5_000,
  challengeMs: 8_000,
  mysteryMs: 15_000,
};

export function resolveConfig(input: MatchConfigInput): MatchConfig {
  if (typeof input.seed !== 'string' || input.seed.length === 0) throw new ConfigError('seed must be a non-empty string');
  const cfg: MatchConfig = {
    seed: input.seed,
    board: { ...DEFAULT_BOARD_CONFIG, ...input.board },
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

export function validateConfig(cfg: MatchConfig): void {
  for (const [k, v] of Object.entries(cfg.windows)) {
    if (!Number.isInteger(v) || v <= 0) throw new ConfigError(`windows.${k} must be a positive integer, got ${v}`);
  }
  const { knockback, maxReplays, maxWaves } = cfg.collision;
  if (!Number.isInteger(knockback) || knockback < 1) throw new ConfigError('collision.knockback must be >= 1');
  if (!Number.isInteger(maxReplays) || maxReplays < 0) throw new ConfigError('collision.maxReplays must be >= 0');
  if (!Number.isInteger(maxWaves) || maxWaves < 1) throw new ConfigError('collision.maxWaves must be >= 1');
  if (!Number.isInteger(cfg.mystery.maxRerolls) || cfg.mystery.maxRerolls < 0 || cfg.mystery.maxRerolls > 3) {
    throw new ConfigError('mystery.maxRerolls must be 0..3');
  }
  validateCards(cfg.cards);
}

/** Every (type, rarity) bucket must hold at least one card with positive weight; ids must be unique. */
export function validateCards(cards: CardDef[]): void {
  const ids = new Set<string>();
  for (const c of cards) {
    if (ids.has(c.id)) throw new ConfigError(`duplicate card id ${c.id}`);
    ids.add(c.id);
    if (!Number.isInteger(c.weight) || c.weight <= 0) throw new ConfigError(`card ${c.id} weight must be a positive integer`);
    if (c.target.condition === 'section' && !c.target.section) throw new ConfigError(`card ${c.id} needs a section range`);
  }
  for (const type of CARD_TYPES) {
    for (const rarity of RARITIES) {
      if (!cards.some((c) => c.type === type && c.rarity === rarity)) {
        throw new ConfigError(`no card for bucket (${type}, ${rarity})`);
      }
    }
  }
}
