import { BOARD_COLUMNS, laneCenterline, tileCell } from '@laddorious/core';
import { CatmullRomCurve3, Vector3 } from 'three';

export type Vec3 = [number, number, number];

/** World units per tile (spec #2 §6.1, §6.3). */
export const TILE_SIZE = 2.0;
/** How much bigger the board is than the first one (1.6 a square): the camera, island and shadows fitted to it scale by this (Step 2, round 5). */
export const BOARD_SCALE = TILE_SIZE / 1.6;
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
  /** A ladder's start is a launch rocket (the user, Step 2 review 4): the symbol stands here, just in front of its porthole, facing the camera (+Z). */
  rocket: { y: 0.66, z: 0.275, height: 1.15 },
  /** At most 0.44: lanes a clearance apart never overlap, vortices and exits included (polish spec 4.1). */
  vortexRadius: 0.43,
  /** The still cap in a whirlpool's eye: its radius, and its top, where the symbol lies. */
  cap: { radius: 0.21, top: 0.07 },
  /** A ladder's end is a flag (the user's pick, Step 2 review 3): the gold symbol stands on its pennant, facing the camera (+Z). */
  flag: { x: 0.15, y: 1.0, z: 0.052, height: 1.27, pole: -0.17 },
  /** A portal's end is a flat splat, at most this far across from its centre, its symbol on its top. */
  splat: { radius: 0.43, top: 0.04 },
  /**
   * On Low the ends are flat images (round 5): each image's size across, and where its symbol lies on it
   * (x right, z toward the camera, from the tile's centre).
   */
  flat: {
    y: 0.012,
    rocket: { size: 1.0, symbol: { x: 0, z: -0.11, size: 0.2 } },
    flag: { size: 1.0, symbol: { x: 0.06, z: -0.19, size: 0.26 } },
    swirl: { size: 0.86 },
    splat: { size: 0.86, symbol: { x: 0, z: 0, size: 0.34 } },
  },
  /** Symbols on tile tops sit just above the board overlay. */
  onTile: 0.012,
  /** Each symbol's size across. */
  symbol: { pad: 0.22, landing: 0.34, eye: 0.33, exit: 0.34 },
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
