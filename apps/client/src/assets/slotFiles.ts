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
  | 'platform'
  | 'cloud'
  | 'step'
  | 'course.pad'
  | 'course.sweeper'
  | 'course.mushroom'
  | 'course.hoop'
  | 'course.fan'
  | 'course.ramp'
  | 'prop.chip'
  | 'prop.card'
  | 'prop.die'
  | 'podium'
  | 'menu.platform'
  | 'tile'
  | 'pad.target'
  | 'pad.plume'
  | 'shield'
  | 'slide.exit';

/** The model id (file name without .glb) for each slot that has a Blender model. A slot not listed keeps its code-built model. */
export const SLOT_FILES: Partial<Record<SlotName, string>> = {
  'piece.knight': 'knight',
  'piece.pawn': 'pawn',
  'piece.meeple': 'meeple',
  'piece.dragon': 'dragon',
  'piece.rook': 'rook',
  'piece.hat': 'hat',
  'piece.duck': 'duck',
  die: 'die',
  crown: 'crown',
  shield: 'shield',
  tile: 'tile',
  pad: 'pad',
  'pad.target': 'target',
  'pad.plume': 'plume',
  'slide.vortex': 'vortex',
  'slide.exit': 'exit',
  platform: 'platform',
  cloud: 'cloud',
  step: 'step',
  'course.pad': 'course_pad',
  'course.sweeper': 'sweeper',
  'course.mushroom': 'mushroom',
  'course.hoop': 'hoop',
  'course.fan': 'fan',
  'course.ramp': 'ramp',
  'prop.chip': 'chip',
  'prop.card': 'card',
  'prop.die': 'prop_die',
  podium: 'podium',
  'menu.platform': 'menu_platform',
};

/**
 * Slots drawn through instancing (spec #5 §6): useSlotMesh loads them as one mesh each, and the menu
 * preloads them, so a match never starts with them popping in. The world round the board is drawn the same
 * way (board theme spec §6).
 */
export const MESH_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>([
  'tile',
  'pad',
  'pad.target',
  'pad.plume',
  'slide.vortex',
  'slide.exit',
  'platform',
  'cloud',
  'step',
  'course.pad',
  'course.sweeper',
  'course.mushroom',
  'course.hoop',
  'course.fan',
  'course.ramp',
  'prop.chip',
  'prop.card',
  'prop.die',
  'podium',
  'menu.platform',
]);

/** Slots with a lighter model for Low quality (spec #5 A14): `<id>-low.glb`, about a third of the triangles. The pieces only:
 * the crown is one model, and thinning it lost its points. */
export const LOW_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>(['piece.knight', 'piece.pawn', 'piece.meeple', 'piece.dragon', 'piece.rook', 'piece.hat', 'piece.duck']);

/** The model id a slot loads: its lighter one on Low quality where it has one. Undefined where the slot keeps its code-built model. */
export function slotFile(name: SlotName, low = false): string | undefined {
  const id = SLOT_FILES[name];
  return id && low && LOW_SLOTS.has(name) ? `${id}-low` : id;
}

/** Where the game loads a model from (served from apps/client/public). */
export function modelUrl(id: string): string {
  return `/models/${id}.glb`;
}
