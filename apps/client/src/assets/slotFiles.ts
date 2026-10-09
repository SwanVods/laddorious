// Which asset slots have a Blender model, and its file (spec #5 §6). `pnpm art` writes
// apps/client/public/models/<id>.glb; art/test checks each listed file is built and keeps its
// contract. Plain TypeScript, so the art tests can read it too.

export type SlotName =
  | 'piece.knight'
  | 'piece.pawn'
  | 'piece.meeple'
  | 'piece.dragon'
  | 'piece.rook'
  | 'piece.hat'
  | 'piece.duck'
  | 'die'
  | 'pad'
  | 'slide.vortex'
  | 'crown'
  | 'island';

/** The model id (file name without .glb) for each slot that has a Blender model. A slot not listed keeps its code-built model. */
export const SLOT_FILES: Partial<Record<SlotName, string>> = {
  'piece.knight': 'knight',
  'piece.pawn': 'pawn',
  'piece.meeple': 'meeple',
  'piece.dragon': 'dragon',
  'piece.rook': 'rook',
  'piece.hat': 'hat',
  'piece.duck': 'duck',
};

/** Where the game loads a model from (served from apps/client/public). */
export function modelUrl(id: string): string {
  return `/models/${id}.glb`;
}
