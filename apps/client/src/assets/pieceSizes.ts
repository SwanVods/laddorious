import type { PieceId } from '../service/matchService';

/**
 * Each piece model's size, measured from the built files (model units; the scene scales pieces by
 * PIECE_SCALE): its height, and how far it reaches in front (+Z, the way it faces), behind and to each
 * side. Stacks and face-offs stand pieces by these, so nothing overlaps (2026-10-14).
 * art/test/pieceSizes.test.ts fails if a rebuilt model no longer matches.
 */
export const PIECE_SIZES: Record<PieceId, { height: number; front: number; back: number; side: number }> = {
  knight: { height: 1.248, front: 0.459, back: 0.446, side: 0.356 },
  pawn: { height: 1.009, front: 0.368, back: 0.368, side: 0.368 },
  meeple: { height: 1.04, front: 0.2, back: 0.2, side: 0.471 },
  dragon: { height: 1.142, front: 0.564, back: 0.483, side: 0.357 },
  rook: { height: 0.94, front: 0.435, back: 0.435, side: 0.435 },
  hat: { height: 0.97, front: 0.48, back: 0.48, side: 0.479 },
  duck: { height: 0.894, front: 0.471, back: 0.481, side: 0.319 },
};
