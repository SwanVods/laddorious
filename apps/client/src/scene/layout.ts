import { BOARD_COLUMNS, laneCenterline, tileCell } from '@laddorious/core';
import { CatmullRomCurve3, Vector3 } from 'three';

export type Vec3 = [number, number, number];

/** World units per tile (spec #2 §6.1, §6.3). */
export const TILE_SIZE = 1.6;
/** Tiles are this thick; their top faces sit at y = 0. */
export const TILE_THICKNESS = 0.3;
export const COLUMNS = BOARD_COLUMNS;
const HALF = (COLUMNS - 1) / 2;

/** A tile's grid cell, from core's layout (polish spec §3.3): tile 1 at the front left, rows alternating direction. */
export { tileCell };

/**
 * Slide lane sizes in world units (polish spec §4.1): thin enough that two lanes core keeps
 * LANE_CLEARANCE apart never overlap, head vortex and exit ring included.
 */
export const LANE = { width: 0.3, edge: 0.1 } as const;

/**
 * The jump parts' sizes, and where their pair symbols lie (spec #5 A13), in game units on the tile top.
 * The Blender models (art/models/pad.py, target.py, vortex.py, exit.py) are built to these numbers, and
 * art/contract.ts checks their heights; the stand-ins in assets/models.ts use them too.
 */
export const PARTS = {
  /** The pad plate's top, where its symbol lies. */
  padTop: 0.31,
  /** At most 0.44: lanes a clearance apart never overlap, vortices and exits included (polish spec 4.1). */
  vortexRadius: 0.43,
  /** The still cap in a whirlpool's eye: its radius, and its top, where the symbol lies. */
  cap: { radius: 0.21, top: 0.07 },
  exitInner: 0.29,
  exitOuter: 0.43,
  /** Symbols on tile tops sit just above the board overlay. */
  onTile: 0.012,
  /** Each symbol's size across. */
  symbol: { pad: 0.5, landing: 0.52, eye: 0.33, exit: 0.36 },
} as const;

/** Centre of a tile's top face; row 0 is nearest the camera (+Z). Tile 0 is a start spot in front of the board, one per seat. */
export function tileToWorld(tile: number, seat = 0): Vec3 {
  if (tile <= 0) return [(seat - 1.5) * TILE_SIZE * 0.8, 0, (HALF + 1.4) * TILE_SIZE];
  const { col, row } = tileCell(tile);
  return [(col - HALF) * TILE_SIZE, 0, (HALF - row) * TILE_SIZE];
}

/** Which classic colour a square takes: they repeat along diagonals (spec #2 §6.1). */
export function squareColorIndex(tile: number, colours: number): number {
  const { col, row } = tileCell(tile);
  return (col + row) % colours;
}

/** The tiles a move passes through, both ends included; a bounce runs up to the last tile and back. */
export function tilePath(from: number, to: number, bounced: boolean, size: number): number[] {
  const path = [from];
  const walk = (target: number) => {
    let at = path[path.length - 1]!;
    while (at !== target) {
      at += Math.sign(target - at);
      path.push(at);
    }
  };
  if (bounced) walk(size);
  walk(to);
  return path;
}

/** The flat curve a slide lies along, head to tail: core's lane (a gentle S), in world units. */
export function slideCurve(from: number, to: number): CatmullRomCurve3 {
  return new CatmullRomCurve3(laneCenterline(from, to).map(([col, row]) => new Vector3((col - HALF) * TILE_SIZE, 0, (HALF - row) * TILE_SIZE)));
}

/** A point on an arc through the air: a parabola from one spot to another. */
export function arcPoint(from: Vec3, to: Vec3, s: number, height: number): Vec3 {
  return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s + height * 4 * s * (1 - s), from[2] + (to[2] - from[2]) * s];
}
