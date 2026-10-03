export type Rarity = 'common' | 'rare' | 'epic';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic'];

export type JumpKind = 'snake' | 'ladder';

/** A snake (to < from) or ladder (to > from). */
export interface Jump {
  id: string;
  from: number;
  to: number;
}

export interface Board {
  /** N — the final tile. Tile 0 is the off-board start. */
  size: number;
  jumps: Jump[];
  /** tile → rarity; keys are tiles in 1..N-1 */
  mystery: Record<number, Rarity>;
  seed: string;
  generatorVersion: number;
}

export function jumpKind(j: Jump): JumpKind {
  return j.to < j.from ? 'snake' : 'ladder';
}

export function jumpLength(j: Jump): number {
  return Math.abs(j.to - j.from);
}

export function jumpFrom(board: Board, tile: number): Jump | undefined {
  return board.jumps.find((j) => j.from === tile);
}

export function isSnakeHead(board: Board, tile: number): boolean {
  const j = jumpFrom(board, tile);
  return j !== undefined && j.to < j.from;
}
