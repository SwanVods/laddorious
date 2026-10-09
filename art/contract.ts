import type { SlotName } from '../apps/client/src/assets/slotFiles';
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

/** A pad's arrow points forward (+Z), the way the game turns pads toward their landing: its tip reaches further forward than its tail reaches back. */
function arrowForward(model: GlbSummary): string | null {
  const arrow = model.byMaterial.Arrow;
  if (!arrow) return null; // requiredMaterials reports a missing Arrow
  const forward = arrow.max[2]!;
  const back = -arrow.min[2]!;
  return forward > back + 0.05 ? null : `the arrow does not point forward (+Z): it reaches ${forward.toFixed(2)} forward and ${back.toFixed(2)} back`;
}

// Triangle limits are guards, not the spec's targets (the user, Step 1 review: sculpted, curved models may
// go past them). What holds hard is the whole match: at most 150,000 triangles (spec #5 §1).
const piece = (slot: SlotName): ModelRule => ({ slot, origin: 'base', height: [0.85, 1.3], maxWidth: 1.1, maxTriangles: 10000, maxMaterials: 4, requiredMaterials: ['Seat'] });

export const MODELS: Record<string, ModelRule> = {
  knight: piece('piece.knight'),
  pawn: piece('piece.pawn'),
  meeple: piece('piece.meeple'),
  dragon: piece('piece.dragon'),
  rook: piece('piece.rook'),
  hat: piece('piece.hat'),
  duck: piece('piece.duck'),
  die: { slot: 'die', origin: 'centre', height: [0.45, 0.56], maxWidth: 0.56, maxTriangles: 5000, maxMaterials: 3, requiredMaterials: ['One'], checks: [oneOnTop] },
  crown: { slot: 'crown', origin: 'base', height: [0.5, 0.9], maxWidth: 1.15, maxTriangles: 8000, maxMaterials: 3, requiredMaterials: [] },
  // The board (spec #5 §4.2): parts stand on the tile top; instancing draws each once per material.
  tile: { slot: 'tile', origin: 'base', height: [0.21, 0.23], maxWidth: 1.53, maxTriangles: 200, maxMaterials: 1, requiredMaterials: ['Tint'] },
  pad: { slot: 'pad', origin: 'base', height: [0.12, 0.26], maxWidth: 1.25, maxTriangles: 1500, maxMaterials: 2, requiredMaterials: ['Arrow'], checks: [arrowForward] },
  target: { slot: 'pad.target', origin: 'base', height: [0.03, 0.12], maxWidth: 1.3, maxTriangles: 800, maxMaterials: 2, requiredMaterials: ['Glow'] },
  vortex: { slot: 'slide.vortex', origin: 'base', height: [0.05, 0.16], maxWidth: 0.72, maxTriangles: 1500, maxMaterials: 2, requiredMaterials: ['Glow'] },
  exit: { slot: 'slide.exit', origin: 'base', height: [0.04, 0.12], maxWidth: 0.72, maxTriangles: 800, maxMaterials: 1, requiredMaterials: [] },
};

/** All the model files together stay under this (spec #5 A9). */
export const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;
const LEVEL = 0.012;
const CENTRED = 0.08;

/** Every rule a model file breaks, in words; empty when it keeps them all. */
export function contractProblems(id: string, model: GlbSummary): string[] {
  const rule = MODELS[id];
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
  if (model.materials.length > rule.maxMaterials) problems.push(`it has ${model.materials.length} materials; at most ${rule.maxMaterials}`);
  for (const name of rule.requiredMaterials) if (!model.materials.includes(name)) problems.push(`it has no ${name} material`);
  if (model.transformedNodes.length > 0) problems.push(`these nodes still carry a transform: ${model.transformedNodes.join(', ')}`);
  for (const check of rule.checks ?? []) {
    const problem = check(model);
    if (problem) problems.push(problem);
  }
  return problems;
}
