import type { Jump } from '@laddorious/core';
import { arcPoint, slideCurve, tileToWorld, type Vec3 } from './layout';

// The jumps' trails, low-poly and simple (spec #5, Step 2 round 5): a rocket's trail is a string of smoke
// puffs along the arc it flies, and a slide's is a dashed line of arrowheads along its lane.

/** Puffs on a rocket's trail. */
export const PUFFS = 12;
/** How far apart a slide's arrowheads are, along its lane. */
export const DASH_GAP = 0.6;

export interface Puff {
  position: Vec3;
  /** Its radius. */
  size: number;
}

export interface Dash {
  position: Vec3;
  /** The turn about Y that points its tip (+Z) on along the lane. */
  heading: number;
}

/** The smoke puffs along a rocket's flight to its flag, growing from small at the rocket to big at the flag. */
export function puffPoints(jump: Jump): Puff[] {
  const from = tileToWorld(jump.from);
  const to = tileToWorld(jump.to);
  const height = 1.2 + Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.12;
  return Array.from({ length: PUFFS }, (_, i) => {
    const s = (i + 0.5) / PUFFS;
    const [x, y, z] = arcPoint(from, to, s, height);
    return { position: [x, y + 0.15, z], size: 0.16 + 0.12 * s };
  });
}

/**
 * The arrowheads along a slide's lane, from its whirlpool to its splat, each pointing on toward the splat.
 * `phase` (0 to 1) slides them all along by part of a gap, so the line drifts while it shows.
 */
export function dashPoints(jump: Jump, phase = 0): Dash[] {
  const curve = slideCurve(jump.from, jump.to);
  const count = Math.max(2, Math.floor(curve.getLength() / DASH_GAP));
  return Array.from({ length: count }, (_, i) => {
    const t = Math.min(1, (i + 0.5 + phase) / count);
    const p = curve.getPointAt(t);
    const ahead = curve.getTangentAt(t);
    return { position: [p.x, 0.03, p.z], heading: Math.atan2(ahead.x, ahead.z) };
  });
}
