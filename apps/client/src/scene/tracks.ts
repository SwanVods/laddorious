import type { Jump } from '@laddorious/core';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { LANE, arcPoint, tileToWorld } from './layout';

// The jumps' tracks (spec #5 §4.2): the arched trail from a launch pad to its landing, and a slide's
// raised channel. Both are swept along a path, with v running along it so their chevrons scroll.

/** A flat strip along points, `width` wide at height y; v runs along it in widths so chevrons tile. */
export function ribbonGeometry(points: Vector3[], width: number, y: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  let along = 0;
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    const sx = (-dz / length) * (width / 2);
    const sz = (dx / length) * (width / 2);
    if (i > 0) along += p.distanceTo(points[i - 1]!);
    positions.push(p.x + sx, y, p.z + sz, p.x - sx, y, p.z - sz);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, along / width, 1, along / width);
    if (i > 0) {
      const a = (i - 1) * 2;
      // Counter-clockwise seen from above, so the strip's front face (and its light) points up.
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/**
 * A cross-section swept along points. Each section point is (across, up): `across` to the path's
 * right, `up` square to the path. u runs across the section, v along the path in `unit`s.
 * Faces point to the section's left as you walk it: walk a wall's section left to right over its top
 * and they face out; walk down into a trough and up again and they face in.
 */
export function sweepGeometry(points: Vector3[], section: ReadonlyArray<readonly [number, number]>, unit: number): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const tangent = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const n = section.length;
  let along = 0;
  points.forEach((p, i) => {
    tangent.subVectors(points[Math.min(points.length - 1, i + 1)]!, points[Math.max(0, i - 1)]!).normalize();
    side.set(-tangent.z, 0, tangent.x).normalize();
    up.crossVectors(side, tangent);
    if (i > 0) along += p.distanceTo(points[i - 1]!);
    section.forEach(([a, b], k) => {
      positions.push(p.x + side.x * a + up.x * b, p.y + side.y * a + up.y * b, p.z + side.z * a + up.z * b);
      uvs.push(k / (n - 1), along / unit);
    });
    if (i === 0) return;
    for (let k = 0; k + 1 < n; k++) {
      const a = (i - 1) * n + k;
      const b = a + n;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A pad's trail: a rounded trough, open to the sky, arching from the pad to its landing. */
export const TRAIL = { width: 0.34, depth: 0.08, lift: 0.04, samples: 24 } as const;
const TRAIL_SECTION = Array.from({ length: 7 }, (_, k): [number, number] => {
  const a = Math.PI * (1 + k / 6);
  return [(TRAIL.width / 2) * Math.cos(a), TRAIL.depth * Math.sin(a)];
});

/** The arc a pad's trail follows, from the pad to the landing tile (the old dots' arc, lifted a little). */
export function trailPath(jump: Jump): Vector3[] {
  const from = tileToWorld(jump.from);
  const to = tileToWorld(jump.to);
  const height = 1.2 + Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.12;
  return Array.from({ length: TRAIL.samples + 1 }, (_, i) => {
    const [x, y, z] = arcPoint(from, to, i / TRAIL.samples, height);
    return new Vector3(x, y + TRAIL.lift, z);
  });
}

export function trailGeometry(points: Vector3[]): BufferGeometry {
  return sweepGeometry(points, TRAIL_SECTION, TRAIL.width);
}

/** A slide's channel: a dark floor between two rounded walls, the lane plus its walls across. */
export const CHANNEL = { wall: 0.06, height: 0.09, floor: 0.02, samples: 40 } as const;

/** One wall's section, walked left to right over its rounded top. */
function wallSection(centre: number): Array<[number, number]> {
  const half = CHANNEL.wall / 2;
  const top = CHANNEL.height;
  return [
    [centre - half, 0],
    [centre - half, top - half],
    [centre - half * 0.7, top - half * 0.3],
    [centre, top],
    [centre + half * 0.7, top - half * 0.3],
    [centre + half, top - half],
    [centre + half, 0],
  ];
}

export function channelGeometry(points: Vector3[]): { floor: BufferGeometry; walls: BufferGeometry } {
  const offset = LANE.width / 2 + CHANNEL.wall / 2;
  return {
    floor: ribbonGeometry(points, LANE.width, CHANNEL.floor),
    // Both walls in one sweep, so the channel grows along its length (spec #5 A13); the strip joining
    // them runs under the floor, out of sight.
    walls: sweepGeometry(points, [...wallSection(-offset), ...wallSection(offset)], LANE.width),
  };
}

/** The turn about Y that points a pad's front (+Z, like every model's) at its landing tile. */
export function padHeading(jump: Jump): number {
  const [fx, , fz] = tileToWorld(jump.from);
  const [tx, , tz] = tileToWorld(jump.to);
  return Math.atan2(tx - fx, tz - fz);
}
