// The board's layout and the shape of a slide's lane (polish spec §3.3). The generator's
// no-crossing rule and the client's drawing both use these, so they always agree. A themed
// layout later replaces this one module.

export type LanePoint = [x: number, y: number];

export const BOARD_COLUMNS = 10;

/** Two slide lanes closer than this (centre line to centre line, in tiles) count as touching. */
export const LANE_CLEARANCE = 0.4;

/** A tile's grid cell: tile 1 at column 0, row 0, rows alternating direction. */
export function tileCell(tile: number): { col: number; row: number } {
  const row = Math.floor((tile - 1) / BOARD_COLUMNS);
  const along = (tile - 1) % BOARD_COLUMNS;
  return { col: row % 2 === 0 ? along : BOARD_COLUMNS - 1 - along, row };
}

function cellPoint(tile: number): LanePoint {
  const { col, row } = tileCell(tile);
  return [col, row];
}

/**
 * A slide's centre line in tile units (x = column, y = row), head first: a gentle S through
 * the head, a point a third of the way pushed to one side, a point two thirds of the way
 * pushed to the other, and the tail. The curve is a centripetal Catmull–Rom, the same maths
 * as three.js's CatmullRomCurve3, sampled at `samples + 1` evenly spaced parameters.
 */
export function laneCenterline(from: number, to: number, samples = 24): LanePoint[] {
  const head = cellPoint(from);
  const tail = cellPoint(to);
  const ax = tail[0] - head[0];
  const ay = tail[1] - head[1];
  const length = Math.hypot(ax, ay);
  const bend = length === 0 ? 0 : Math.min(0.75, 0.12 * length) / length;
  const side: LanePoint = [ay * bend, -ax * bend];
  const at = (s: number, sign: number): LanePoint => [head[0] + ax * s + sign * side[0], head[1] + ay * s + sign * side[1]];
  const controls = [head, at(1 / 3, 1), at(2 / 3, -1), tail];
  // The ends sit exactly on the tile centres; the polynomial would leave rounding error there.
  return Array.from({ length: samples + 1 }, (_, i) => (i === 0 ? head : i === samples ? tail : catmullRom(controls, i / samples)));
}

/** three.js CatmullRomCurve3.getPoint for an open, centripetal curve. */
function catmullRom(points: LanePoint[], t: number): LanePoint {
  const l = points.length;
  const p = (l - 1) * t;
  let index = Math.floor(p);
  let weight = p - index;
  if (weight === 0 && index === l - 1) {
    index = l - 2;
    weight = 1;
  }
  const extend = (a: LanePoint, b: LanePoint): LanePoint => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  const p0 = index > 0 ? points[index - 1]! : extend(points[0]!, points[1]!);
  const p1 = points[index]!;
  const p2 = points[index + 1]!;
  const p3 = index + 2 < l ? points[index + 2]! : extend(points[l - 1]!, points[l - 2]!);
  const gap = (a: LanePoint, b: LanePoint) => Math.pow((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, 0.25);
  let dt1 = gap(p1, p2);
  if (dt1 < 1e-4) dt1 = 1;
  let dt0 = gap(p0, p1);
  if (dt0 < 1e-4) dt0 = dt1;
  let dt2 = gap(p2, p3);
  if (dt2 < 1e-4) dt2 = dt1;
  const axis = (k: 0 | 1) => {
    const [x0, x1, x2, x3] = [p0[k], p1[k], p2[k], p3[k]];
    const t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1;
    const t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1;
    const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2;
    const c3 = 2 * x1 - 2 * x2 + t1 + t2;
    return x1 + t1 * weight + c2 * weight ** 2 + c3 * weight ** 3;
  };
  return [axis(0), axis(1)];
}

/** The smallest distance between two lanes' centre lines, in tiles; 0 when they cross. */
export function laneGap(a: readonly LanePoint[], b: readonly LanePoint[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      best = Math.min(best, segmentGap(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!));
      if (best === 0) return 0;
    }
  }
  return best;
}

function segmentGap(a: LanePoint, b: LanePoint, c: LanePoint, d: LanePoint): number {
  const cross = (o: LanePoint, p: LanePoint, q: LanePoint) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(pointGap(a, c, d), pointGap(b, c, d), pointGap(c, a, b), pointGap(d, a, b));
}

function pointGap(p: LanePoint, s: LanePoint, e: LanePoint): number {
  const vx = e[0] - s[0];
  const vy = e[1] - s[1];
  const span = vx * vx + vy * vy;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - s[0]) * vx + (p[1] - s[1]) * vy) / span));
  return Math.hypot(p[0] - s[0] - t * vx, p[1] - s[1] - t * vy);
}
