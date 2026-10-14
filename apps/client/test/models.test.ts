import { Euler, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { islandGeometry } from '../src/scene/Surroundings';
import { DIE_FACES, PIECE_GEOMETRY, crownGeometry, dieGeometry, dieRotationFor, exitGeometry, padGeometry, targetGeometry, tileGeometry, vortexGeometry } from '../src/assets/models';
import { PARTS, TILE_SIZE, TILE_THICKNESS } from '../src/scene/layout';
import { PIECES } from '../src/service/matchService';

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('code-built models (spec #2 §6.2, §6.3)', () => {
  it.each(PIECES)('builds the %s under 5k triangles, standing on its origin, about one unit tall', (piece) => {
    const g = PIECE_GEOMETRY[piece]();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(triangles(g)).toBeLessThan(5000);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(0.9);
    expect(box.max.y).toBeLessThan(1.2);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThan(1.05);
  });

  it('builds the tile stand-in: a rounded slab on its base, the 0.95 of a tile across, under 200 triangles (spec #5 §4.2)', () => {
    const g = tileGeometry();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(TILE_THICKNESS, 5);
    expect(box.max.x - box.min.x).toBeCloseTo(TILE_SIZE * 0.95, 5);
    expect(triangles(g)).toBeLessThanOrEqual(200);
  });

  it("stands the jumps' stand-ins on the tile: a rocket, a flag, a flat whirlpool and a flat splat (spec #5 A13, A16)", () => {
    const flat = (g: BufferGeometry, y: number) => {
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeCloseTo(y, 5);
      expect(g.boundingBox!.max.y).toBeCloseTo(y, 5);
    };
    flat(vortexGeometry(), 0.03);
    flat(exitGeometry(), PARTS.splat.top);
    const flag = targetGeometry();
    flag.computeBoundingBox();
    expect(flag.boundingBox!.max.y).toBeCloseTo(PARTS.flag.height, 5);
    const rocket = padGeometry();
    rocket.computeBoundingBox();
    expect(rocket.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(rocket.boundingBox!.max.y).toBeCloseTo(PARTS.rocket.height, 5);
  });

  it("spreads the island past every corner of the bigger board, wobble and all (round 5)", () => {
    const island = islandGeometry();
    const position = island.getAttribute('position');
    const corner = Math.hypot(TILE_SIZE * 5, TILE_SIZE * 5);
    let nearest = Infinity;
    // The top rim's vertices (not the top face's centre).
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i));
      if (position.getY(i) > 1 && r > 1) nearest = Math.min(nearest, r);
    }
    expect(nearest).toBeGreaterThan(corner);
  });

  it('maps each die face into its own cell of the pip atlas', () => {
    const g = dieGeometry();
    const uv = g.getAttribute('uv');
    expect(g.groups).toHaveLength(6);
    g.groups.forEach((group, face) => {
      const cell = DIE_FACES[face]! - 1;
      const col = cell % 3;
      const row = Math.floor(cell / 3);
      for (let i = group.start; i < group.start + group.count; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(col / 3 - 1e-6);
        expect(uv.getX(i)).toBeLessThanOrEqual((col + 1) / 3 + 1e-6);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(row / 2 - 1e-6);
        expect(uv.getY(i)).toBeLessThanOrEqual((row + 1) / 2 + 1e-6);
      }
    });
  });

  it('turns the rolled face up', () => {
    const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
    DIE_FACES.forEach((face, i) => {
      const up = normals[i]!.clone().applyEuler(new Euler(...dieRotationFor(face)));
      expect([up.x, up.y, up.z].map((v) => Math.round(v) + 0)).toEqual([0, 1, 0]);
    });
  });

  it('stands the crown on its base, with five raised points', () => {
    const g = crownGeometry();
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 3);
    const pos = g.getAttribute('position');
    // Keyed in hundredths: the seam repeats the first vertex up to a float error.
    const points = new Set<string>();
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.6) points.add(`${Math.round(pos.getX(i) * 100)},${Math.round(pos.getZ(i) * 100)}`);
    expect(points.size).toBe(5);
  });
});
