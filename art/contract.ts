import { LOW_SLOTS, type SlotName } from '../apps/client/src/assets/slotFiles';
import { PARTS, PLATFORM } from '../apps/client/src/scene/layout';
import type { GlbSummary } from './glb';

// What every model file must keep (spec #5 §4, §5): one rule per art/models/<id>.py.

export interface ModelRule {
  slot: SlotName;
  /** Where the origin sits: at the base centre, or the middle (the die, which tumbles round it). */
  origin: 'base' | 'centre';
  height: [number, number];
  /** The widest footprint, across X or Z. */
  maxWidth: number;
  maxTriangles: number;
  /**
   * Models that cast a shadow carry a Shadow mesh of at most this many triangles, which the game draws
   * into the shadow map in place of the model (spec #5 §6). Instanced board parts cast none, so carry none.
   */
  maxShadowTriangles?: number;
  maxMaterials: number;
  requiredMaterials: string[];
  /** Extra checks; each returns a problem, or null. */
  checks?: Array<(model: GlbSummary) => string | null>;
}

/** The game turns face 1 up by leaving the die unrotated (dieRotationFor), so the one-pip face must be +Y. */
function oneOnTop(model: GlbSummary): string | null {
  const one = model.byMaterial.One;
  if (!one) return null; // requiredMaterials reports a missing One
  const mid = [0, 1, 2].map((k) => (one.min[k]! + one.max[k]!) / 2);
  if (mid[1]! > 0.2 && Math.abs(mid[0]!) < 0.03 && Math.abs(mid[2]!) < 0.03) return null;
  return `the one-pip face is not on top (+Y): its pip is at ${mid.map((v) => (v + 0).toFixed(2)).join(', ')}`;
}

/** A material's part faces the camera (+Z) where the game stands a symbol on it (the rocket's porthole, spec #5 A16). */
function facesCamera(material: string, spot: { y: number; z: number }) {
  return (model: GlbSummary): string | null => {
    const part = model.byMaterial[material];
    if (!part) return null; // requiredMaterials reports it missing
    const front = part.max[2]!;
    if (Math.abs(front - spot.z) > 0.03) return `its ${material} faces away: its front is at ${front.toFixed(2)}, the symbol stands at ${spot.z}`;
    const middle = (part.min[1]! + part.max[1]!) / 2;
    return Math.abs(middle - spot.y) <= 0.04 ? null : `its ${material} is ${middle.toFixed(2)} high, the symbol stands at ${spot.y}`;
  };
}

/** The model's top is where the game lays its pair symbol (spec #5 A13, PARTS in the client's layout). */
function topAt(height: number) {
  return (model: GlbSummary): string | null =>
    Math.abs(model.max[1] - height) <= 0.006 ? null : `its top is at ${model.max[1].toFixed(3)}, but the symbol lies at ${height}`;
}

/** A material's top is at this height: the course pad's deck, where its obstacle stands (board theme spec §6). */
export function materialTop(material: string, height: number, tolerance = 0.06) {
  return (model: GlbSummary): string | null => {
    const part = model.byMaterial[material];
    if (!part) return null; // requiredMaterials reports it missing
    return Math.abs(part.max[1]! - height) <= tolerance ? null : `its ${material} top is at ${part.max[1]!.toFixed(2)}, but ${height} is expected`;
  };
}

// Triangle limits are guards, not the spec's targets (the user, Step 1 review: sculpted, curved models may
// go past them). What holds hard is the whole match: at most 150,000 triangles (spec #5 §1).
/** A shadow stand-in this small keeps the shadow's outline: the shadow map gives a piece only about 40 texels. */
const SHADOW = 600;
const piece = (slot: SlotName): ModelRule => ({
  slot,
  origin: 'base',
  height: [0.85, 1.3],
  maxWidth: 1.1,
  maxTriangles: 10000,
  maxShadowTriangles: SHADOW,
  maxMaterials: 4,
  requiredMaterials: ['Seat'],
});

export const MODELS: Record<string, ModelRule> = {
  knight: piece('piece.knight'),
  pawn: piece('piece.pawn'),
  meeple: piece('piece.meeple'),
  dragon: piece('piece.dragon'),
  rook: piece('piece.rook'),
  hat: piece('piece.hat'),
  duck: piece('piece.duck'),
  die: { slot: 'die', origin: 'centre', height: [0.45, 0.56], maxWidth: 0.56, maxTriangles: 2500, maxShadowTriangles: SHADOW, maxMaterials: 3, requiredMaterials: ['One'], checks: [oneOnTop] },
  crown: { slot: 'crown', origin: 'base', height: [0.5, 0.9], maxWidth: 1.15, maxTriangles: 8000, maxShadowTriangles: SHADOW, maxMaterials: 3, requiredMaterials: [] },
  // The board (spec #5 §4.2, A13): parts stand on the tile top; instancing draws each once per material, and
  // the instance colour (each jump's pair colour) paints Tint, so every jump part has it.
  tile: { slot: 'tile', origin: 'base', height: [0.29, 0.31], maxWidth: 2.31, maxTriangles: 200, maxMaterials: 1, requiredMaterials: ['Tint'] },
  // A ladder's start is a launch rocket: Tint, a glowing cream porthole facing the camera, a glowing flame (A16).
  pad: { slot: 'pad', origin: 'base', height: [0.65, 0.8], maxWidth: 0.62, maxTriangles: 1500, maxMaterials: 3, requiredMaterials: ['Tint', 'Window'], checks: [facesCamera('Window', PARTS.rocket)] },
  // A ladder's end is a flag, all Tint; a portal's end is a flat splat.
  target: { slot: 'pad.target', origin: 'base', height: [1.2, 1.35], maxWidth: 1.3, maxTriangles: 1500, maxMaterials: 1, requiredMaterials: ['Tint'] },
  vortex: { slot: 'slide.vortex', origin: 'base', height: [0.08, 0.14], maxWidth: 0.88, maxTriangles: 1500, maxMaterials: 2, requiredMaterials: ['Inside', 'Tint'] },
  // The world (board theme spec §3, §7): instanced, no shadows, light. Round parts are lathed, so their counts are exact.
  platform: { slot: 'platform', origin: 'base', height: [PLATFORM.rimTop - 0.05, PLATFORM.rimTop + 0.05], maxWidth: 55.5, maxTriangles: 3600, maxMaterials: 3, requiredMaterials: ['Deck', 'Stripe', 'Cushion'] },
  cloud: { slot: 'cloud', origin: 'base', height: [2.45, 2.75], maxWidth: 5.6, maxTriangles: 220, maxMaterials: 1, requiredMaterials: ['Cloud'] },
  step: { slot: 'step', origin: 'base', height: [0.55, 0.65], maxWidth: 3.7, maxTriangles: 120, maxMaterials: 1, requiredMaterials: ['Tint'] },
  exit: { slot: 'slide.exit', origin: 'base', height: [0.03, 0.06], maxWidth: 0.88, maxTriangles: 800, maxMaterials: 1, requiredMaterials: ['Tint'], checks: [topAt(PARTS.splat.top)] },
};

/** All the model files together stay under this (spec #5 A9). */
export const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;
const LEVEL = 0.012;
const CENTRED = 0.08;

/** A Low file (spec #5 A14) carries at most this share of its model's triangle limit (separate details like eyes stay whole). */
const LOW_SHARE = 0.4;

/** A model's rule, or for `<id>-low` its Low file's: the same shape, fewer triangles, no shadow stand-in. */
function ruleFor(id: string): (ModelRule & { low?: true }) | undefined {
  const low = /^(.+)-low$/.exec(id);
  if (!low) return MODELS[id];
  const base = MODELS[low[1]!];
  if (!base || !LOW_SLOTS.has(base.slot)) return undefined;
  return { ...base, maxTriangles: Math.round(base.maxTriangles * LOW_SHARE), maxShadowTriangles: undefined, low: true };
}

/** Every rule a model file breaks, in words; empty when it keeps them all. */
export function contractProblems(id: string, model: GlbSummary): string[] {
  const rule = ruleFor(id);
  if (!rule) return [`${id} has no rule in art/contract.ts`];
  const [x0, y0, z0] = model.min;
  const [x1, y1, z1] = model.max;
  const height = y1 - y0;
  const problems: string[] = [];
  if (rule.origin === 'base' && Math.abs(y0) > LEVEL) problems.push(`its base is at y = ${y0.toFixed(3)}, not 0`);
  if (rule.origin === 'centre' && Math.abs((y0 + y1) / 2) > LEVEL) problems.push(`its middle is at y = ${((y0 + y1) / 2).toFixed(3)}, not 0`);
  if (Math.abs((x0 + x1) / 2) > CENTRED || Math.abs((z0 + z1) / 2) > CENTRED) problems.push(`it is off centre: ${((x0 + x1) / 2).toFixed(2)}, ${((z0 + z1) / 2).toFixed(2)}`);
  if (height < rule.height[0] || height > rule.height[1]) problems.push(`it is ${height.toFixed(2)} tall; ${rule.height[0]}–${rule.height[1]} expected`);
  const width = Math.max(x1 - x0, z1 - z0);
  if (width > rule.maxWidth) problems.push(`it is ${width.toFixed(2)} wide; at most ${rule.maxWidth}`);
  if (model.triangles > rule.maxTriangles) problems.push(`it has ${model.triangles} triangles; at most ${rule.maxTriangles}`);
  if (rule.maxShadowTriangles === undefined) {
    if (model.shadowTriangles > 0) problems.push(rule.low ? 'it has a Shadow mesh, but Low quality casts no shadows' : 'it has a Shadow mesh, but the game draws it instanced, without one');
  } else if (model.shadowTriangles === 0) problems.push('it has no Shadow mesh; the game casts its shadow from one');
  else if (model.shadowTriangles > rule.maxShadowTriangles) problems.push(`its Shadow mesh has ${model.shadowTriangles} triangles; at most ${rule.maxShadowTriangles}`);
  if (model.materials.length > rule.maxMaterials) problems.push(`it has ${model.materials.length} materials; at most ${rule.maxMaterials}`);
  for (const name of rule.requiredMaterials) if (!model.materials.includes(name)) problems.push(`it has no ${name} material`);
  if (model.transformedNodes.length > 0) problems.push(`these nodes still carry a transform: ${model.transformedNodes.join(', ')}`);
  for (const check of rule.checks ?? []) {
    const problem = check(model);
    if (problem) problems.push(problem);
  }
  return problems;
}
