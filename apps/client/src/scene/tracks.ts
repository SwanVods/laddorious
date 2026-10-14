import type { Jump } from '@laddorious/core';
import { CatmullRomCurve3, Vector3, type Curve } from 'three';
import { TILE_SIZE, arcPoint, slideCurve, tileToWorld, type Vec3 } from './layout';

// The jumps' trails, low-poly and simple (spec #5, Step 2 round 5; the user, 2026-10-14): a line of chevron
// arrowheads, along a slide's lane on the board or along a rocket's arc through the air, drifting on.

/** How far apart the arrowheads are, along the way: 0.3 of a square's step, as many to a tile as on the 2.0 board (board theme spec B3). */
export const DASH_GAP = 0.3 * TILE_SIZE;
/** How high above the arc a rocket's arrowheads fly, and how many points trace the arc. */
const LIFT = 0.15;
const ARC_SAMPLES = 24;

export interface Dash {
  position: Vec3;
  /** The turn about Y that points its tip (+Z) on along the way. */
  heading: number;
  /** How far its tip tilts up (positive) or down along a rocket's arc; 0 on a slide. */
  pitch: number;
}

/** The arc a rocket's piece flies, from its tile to its flag's, as a curve. */
export function ladderCurve(from: number, to: number): Curve<Vector3> {
  const a = tileToWorld(from);
  const b = tileToWorld(to);
  const height = 1.2 + Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.12;
  const points = Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => {
    const [x, y, z] = arcPoint(a, b, i / ARC_SAMPLES, height);
    return new Vector3(x, y + LIFT, z);
  });
  return new CatmullRomCurve3(points);
}

/**
 * The arrowheads along a jump: a slide's lie flat on its lane, from its whirlpool to its splat; a rocket's
 * fly along its arc to the flag, each tilted along it. `phase` (0 to 1) moves them all on by part of a gap,
 * so the line drifts while it shows.
 */
export function dashPoints(jump: Jump, phase = 0): Dash[] {
  const ladder = jump.to > jump.from;
  const curve = ladder ? ladderCurve(jump.from, jump.to) : slideCurve(jump.from, jump.to);
  const count = Math.max(2, Math.floor(curve.getLength() / DASH_GAP));
  return Array.from({ length: count }, (_, i) => {
    const t = Math.min(1, (i + 0.5 + phase) / count);
    const p = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    const pitch = ladder ? Math.atan2(d.y, Math.hypot(d.x, d.z)) : 0;
    return { position: [p.x, ladder ? p.y : 0.03, p.z], heading: Math.atan2(d.x, d.z), pitch };
  });
}
