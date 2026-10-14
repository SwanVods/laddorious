import { LANE_CLEARANCE, laneCenterline, tileCell as coreTileCell } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BOARD_HALF, COLUMNS, LANE, PARTS, PLATFORM, TILE_ACROSS, TILE_SIZE, TILE_THICKNESS, slideCurve, squareColorIndex, tileCell, tilePath, tileToWorld } from '../src/scene/layout';

function expectAt(point: number[], x: number, z: number) {
  expect(point[0]).toBeCloseTo(x);
  expect(point[1]).toBeCloseTo(0);
  expect(point[2]).toBeCloseTo(z);
}

describe('board layout (spec #2 §6.1)', () => {
  it('steps 2.7 from square to square, so the board spans 27 units (board theme spec B3)', () => {
    expect(TILE_SIZE).toBe(2.7);
    const [x1] = tileToWorld(1);
    const [x2] = tileToWorld(2);
    expect(x2 - x1).toBeCloseTo(2.7, 5);
    expect(TILE_SIZE * COLUMNS).toBeCloseTo(27);
  });

  it('lays the tiles on a serpentine 10×10 grid, 2.7 units apart, tile 1 at the front left', () => {
    expectAt(tileToWorld(1), -12.15, 12.15);
    expectAt(tileToWorld(10), 12.15, 12.15);
    expectAt(tileToWorld(11), 12.15, 9.45);
    expectAt(tileToWorld(100), -12.15, -12.15);
    expect(TILE_SIZE * COLUMNS).toBeCloseTo(27);
  });

  it('draws 2.3 squares on a 2.7 step, leaving a 0.4 gap (board theme spec B3)', () => {
    expect(TILE_ACROSS).toBe(2.3);
    expect(TILE_SIZE - TILE_ACROSS).toBeCloseTo(0.4);
    expect(BOARD_HALF).toBeCloseTo(13.5);
  });

  it('stands the start spots on the deck, inside the platform (board theme spec §4)', () => {
    for (let seat = 0; seat < 4; seat++) {
      const [x, y, z] = tileToWorld(0, seat);
      expect(y).toBe(-TILE_THICKNESS);
      expect(Math.abs(x)).toBeLessThan(PLATFORM.halfWidth);
      expect(z).toBeLessThan(PLATFORM.halfDepth - 1.5);
    }
  });

  it('puts one start spot per seat in front of the board', () => {
    const spots = [0, 1, 2, 3].map((seat) => tileToWorld(0, seat));
    expect(new Set(spots.map((s) => s[0])).size).toBe(4);
    for (const spot of spots) expect(spot[2]).toBeGreaterThan(tileToWorld(1)[2] + TILE_SIZE / 2);
  });

  it('repeats the square colours along diagonals', () => {
    expect(tileCell(1)).toEqual({ col: 0, row: 0 });
    expect(tileCell(20)).toEqual({ col: 0, row: 1 });
    expect(squareColorIndex(2, 5)).toBe(squareColorIndex(20, 5));
    expect(squareColorIndex(1, 5)).not.toBe(squareColorIndex(2, 5));
  });

  it('walks a move tile by tile, up to the last tile and back on a bounce', () => {
    expect(tilePath(3, 6, false, 100)).toEqual([3, 4, 5, 6]);
    expect(tilePath(9, 6, false, 100)).toEqual([9, 8, 7, 6]);
    expect(tilePath(97, 98, true, 100)).toEqual([97, 98, 99, 100, 99, 98]);
  });

  it('lays a slide from its head to its tail', () => {
    const curve = slideCurve(47, 26);
    const head = curve.getPoint(0);
    const tail = curve.getPoint(1);
    expectAt([head.x, head.y, head.z], tileToWorld(47)[0], tileToWorld(47)[2]);
    expectAt([tail.x, tail.y, tail.z], tileToWorld(26)[0], tileToWorld(26)[2]);
  });

  it('takes its layout from core, so the generator and the board agree (polish spec 3.3)', () => {
    for (let tile = 1; tile <= 100; tile++) expect(tileCell(tile)).toEqual(coreTileCell(tile));
  });

  it('runs a slide along the lane core keeps clear of other lanes', () => {
    const line = laneCenterline(47, 26);
    const curve = slideCurve(47, 26);
    line.forEach(([col, row], i) => {
      const p = curve.getPoint(i / (line.length - 1));
      expect(p.x).toBeCloseTo((col - (COLUMNS - 1) / 2) * TILE_SIZE, 1);
      expect(p.z).toBeCloseTo(((COLUMNS - 1) / 2 - row) * TILE_SIZE, 1);
    });
  });

  it('draws lanes thin enough that two lanes a clearance apart never overlap, vortices included (polish spec 4.1)', () => {
    const halfLane = (LANE.width + LANE.edge) / 2;
    expect(LANE.width).toBe(0.3);
    expect(PARTS.vortexRadius + halfLane).toBeLessThan(LANE_CLEARANCE * TILE_SIZE);
    expect(PARTS.splat.radius + halfLane).toBeLessThan(LANE_CLEARANCE * TILE_SIZE);
  });
});
