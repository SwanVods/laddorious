import { Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { LANE, slideCurve, tileToWorld } from '../src/scene/layout';
import { CHANNEL, TRAIL, channelGeometry, padHeading, trailGeometry, trailPath } from '../src/scene/tracks';

const triangles = (g: BufferGeometry) => g.index!.count / 3;
const ladder = { id: 'l1', from: 22, to: 52 };
/** Points across the trail's section: its lips, its floor and the curve between. */
const SECTION = 7;

describe('the jump tracks (spec #5 §4.2)', () => {
  it('arches a trail from the pad to its landing tile, as high as the pad sends a piece', () => {
    const path = trailPath(ladder);
    const [fx, , fz] = tileToWorld(ladder.from);
    const [tx, , tz] = tileToWorld(ladder.to);
    expect(path).toHaveLength(TRAIL.samples + 1);
    expect([path[0]!.x, path[0]!.z]).toEqual([fx, fz]);
    expect(path.at(-1)!.x).toBeCloseTo(tx, 5);
    expect(path.at(-1)!.z).toBeCloseTo(tz, 5);
    const span = Math.hypot(tx - fx, tz - fz);
    expect(Math.max(...path.map((p) => p.y))).toBeCloseTo(1.2 + span * 0.12 + TRAIL.lift, 2);
  });

  it('sweeps the trail as a rounded trough within 600 triangles, its floor below its lips and facing the sky', () => {
    const g = trailGeometry(trailPath(ladder));
    expect(triangles(g)).toBeLessThanOrEqual(600);
    const position = g.getAttribute('position');
    const normal = g.getAttribute('normal');
    const top = (TRAIL.samples / 2) * SECTION; // the section at the top of the arc
    const floor = top + 3;
    expect(position.getY(floor)).toBeLessThan(position.getY(top));
    expect(normal.getY(floor)).toBeGreaterThan(0.9);
  });

  it('runs v along the trail from the pad to the landing, so its lights travel there', () => {
    const uv = trailGeometry(trailPath(ladder)).getAttribute('uv');
    for (let i = 1; i <= TRAIL.samples; i++) expect(uv.getY(i * SECTION)).toBeGreaterThan(uv.getY((i - 1) * SECTION));
  });

  it("turns a pad's front (+Z) toward its landing tile", () => {
    for (const jump of [ladder, { id: 'l2', from: 5, to: 26 }, { id: 'l3', from: 82, to: 99 }, { id: 'l4', from: 58, to: 88 }]) {
      const front = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), padHeading(jump));
      const [fx, , fz] = tileToWorld(jump.from);
      const [tx, , tz] = tileToWorld(jump.to);
      expect(front.dot(new Vector3(tx - fx, 0, tz - fz).normalize())).toBeCloseTo(1, 5);
    }
  });

  it("raises a slide's channel: two rounded walls outside the lane, from head to tail, within 1,200 triangles", () => {
    const points = slideCurve(79, 50).getPoints(CHANNEL.samples);
    const { floor, walls } = channelGeometry(points);
    expect(triangles(floor) + triangles(walls)).toBeLessThanOrEqual(1200);
    walls.computeBoundingBox();
    expect(walls.boundingBox!.max.y).toBeCloseTo(CHANNEL.height, 3);
    const normal = walls.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(-0.01);
    // The walls' outer feet stand either side of the head at the first section, and of the tail at the last:
    // each section holds the left wall's points, then the right wall's (one sweep, so the channel grows along its length).
    const position = walls.getAttribute('position');
    for (const [at, point] of [[0, points[0]!], [CHANNEL.samples * 2 * SECTION, points.at(-1)!]] as const) {
      const right = at + 2 * SECTION - 1;
      expect((position.getX(at) + position.getX(right)) / 2).toBeCloseTo(point.x, 5);
      expect((position.getZ(at) + position.getZ(right)) / 2).toBeCloseTo(point.z, 5);
    }
    // No wall reaches into the lane.
    for (let i = 0; i < position.count; i++) {
      const gap = Math.min(...points.map((p) => Math.hypot(position.getX(i) - p.x, position.getZ(i) - p.z)));
      expect(gap).toBeGreaterThan(LANE.width / 2 - 0.01);
    }
  });
});
