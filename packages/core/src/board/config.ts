import type { Rarity } from './types';

export interface BoardConfig {
  size: number;
  generatorVersion: number;
  ladders: { count: [number, number]; length: [number, number] };
  snakes: { count: [number, number]; length: [number, number] };
  /** Fraction of tiles 1..N-1 that are Mystery tiles. */
  mysteryDensity: number;
  /** Weights for a Mystery tile's rarity (spec §7.2: Common 70 / Rare 25 / Epic 5). */
  mysteryRarityWeights: Record<Rarity, number>;
  /** Last `tiles` tiles before N: at most `maxSnakes` snake heads, each at most `maxSnakeLength` long. */
  finishZone: { tiles: number; maxSnakes: number; maxSnakeLength: number };
  maxConsecutiveSnakeHeads: number;
  mysterySpacing: { maxPerWindow: number; window: number; maxGap: number };
  analysis: { median4pRounds: [number, number]; maxRounds2p: number; maxTailProbability: number };
  maxAttempts: number;
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  size: 100,
  // 5 (2026-10-16): no three snake heads or three ladder feet in a row; 4: slide lanes may cross; 3 kept them apart.
  generatorVersion: 5,
  ladders: { count: [8, 10], length: [4, 30] },
  snakes: { count: [8, 10], length: [4, 30] },
  mysteryDensity: 0.18,
  mysteryRarityWeights: { common: 70, rare: 25, epic: 5 },
  finishZone: { tiles: 9, maxSnakes: 1, maxSnakeLength: 10 },
  maxConsecutiveSnakeHeads: 5,
  mysterySpacing: { maxPerWindow: 4, window: 10, maxGap: 12 },
  analysis: { median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 },
  maxAttempts: 500,
};
