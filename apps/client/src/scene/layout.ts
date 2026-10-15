import { BOARD_COLUMNS, laneCenterline, tileCell } from '@laddorious/core';
import { CatmullRomCurve3, Vector3 } from 'three';

export type Vec3 = [number, number, number];

/** The scene scales piece models by this. */
export const PIECE_SCALE = 1.3;

/** World units from one square's centre to the next (board theme spec B3: bigger squares; the 2026-10-15 review narrowed the gaps). */
export const TILE_SIZE = 2.5;
/** A square's width across (the tile model, art/models/tile.py): 0.2 of deck shows between squares. */
export const TILE_ACROSS = 2.3;
/** How much bigger the board is than the first one (1.6 a square): the camera's aim and the shadows scale by this. */
export const BOARD_SCALE = TILE_SIZE / 1.6;
/** Tiles are this thick; their top faces sit at y = 0. */
export const TILE_THICKNESS = 0.3;
export const COLUMNS = BOARD_COLUMNS;
const HALF = (COLUMNS - 1) / 2;
/** Half the board's width, edge to edge. */
export const BOARD_HALF = (TILE_SIZE * COLUMNS) / 2;

/**
 * The platform the board stands on (board theme spec §3, §4), built to these by art/models/platform.py,
 * heights from the model's base (its cushion's knot): the deck's top, where the tiles stand; the rim's top;
 * and the deck's half sizes.
 */
export const PLATFORM = { deckTop: 6.0, rimTop: 7.3, halfWidth: 23.5, halfDepth: 17.5 } as const;
/** A floating obstacle's pad (art/models/course_pad.py): its top, where its obstacle stands, and its radius. */
export const COURSE = { padTop: 2.0, padRadius: 5 } as const;
/** The menu's little platform under the podium (art/models/menu_platform.py): its deck's top and its radius. */
export const MENU_PLATFORM = { deckTop: 1.2, radius: 2.3 } as const;

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
  /**
   * A ladder's rocket and flag stand in their tile's top-right corner (the user, 2026-10-14): right is +X,
   * the far side is -Z. The middle stays free, so pieces stack there like on any tile.
   */
  corner: { x: 0.6, z: -0.65 },
  /** The flag stands a little further in: its pennant reaches right of its pole. */
  flagCorner: { x: 0.5, z: -0.7 },
  /** A ladder's start is a small launch rocket, standing on its fins (2026-10-14): the symbol stands here, just in front of its porthole, facing the camera (+Z). */
  rocket: { y: 0.413, z: 0.193, height: 0.71 },
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
   * (x right, z toward the camera, from the tile's centre). The rocket and the flag lie in the middle of
   * their tile, about as big as a "?" (2026-10-15).
   */
  flat: {
    y: 0.012,
    rocket: { size: 1.15, symbol: { x: 0, z: -0.126, size: 0.23 } },
    flag: { size: 1.2, symbol: { x: 0.072, z: -0.229, size: 0.32 } },
    swirl: { size: 0.86 },
    splat: { size: 0.86, symbol: { x: 0, z: 0, size: 0.34 } },
  },
  /** Symbols on tile tops sit just above the board overlay. */
  onTile: 0.012,
  /** Each symbol's size across. */
  symbol: { pad: 0.154, landing: 0.34, eye: 0.33, exit: 0.34 },
} as const;

/** Centre of a tile's top face; row 0 is nearest the camera (+Z). Tile 0 is a start spot in front of the board, one per seat. */
export function tileToWorld(tile: number, seat = 0): Vec3 {
  // Start spots stand on the deck in front of the board (board theme spec §4).
  if (tile <= 0) return [(seat - 1.5) * TILE_SIZE * 0.8, -TILE_THICKNESS, (HALF + 1.4) * TILE_SIZE];
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
