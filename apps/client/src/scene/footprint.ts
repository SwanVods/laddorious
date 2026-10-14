import type { PlayerId } from '@laddorious/core';
import { PIECE_SIZES } from '../assets/pieceSizes';
import type { PieceId } from '../service/matchService';
import { PIECE_SCALE } from './layout';

// Where pieces stand so that nothing overlaps (the user, 2026-10-14): each piece's measured size, its
// footprint on the ground as a turned rectangle, and the spots for a face-off.

/** A footprint on the ground: four corners as [x, z]. */
export interface Rect {
  corners: Array<[number, number]>;
}

/** The pieces at the table, by player. The scene sets them; a player it doesn't know stands as a knight. */
let seatPieces: Partial<Record<PlayerId, PieceId>> = {};

export function setSeatPieces(pieces: Partial<Record<PlayerId, PieceId>>): void {
  seatPieces = { ...pieces };
}

export const pieceOf = (player: PlayerId): PieceId => seatPieces[player] ?? 'knight';

/** A piece's size in the world: its height, and how far it reaches in front, behind and to each side. */
export function sizeOf(piece: PieceId): { height: number; front: number; back: number; side: number } {
  const s = PIECE_SIZES[piece];
  return { height: s.height * PIECE_SCALE, front: s.front * PIECE_SCALE, back: s.back * PIECE_SCALE, side: s.side * PIECE_SCALE };
}

/** A piece's footprint standing at (x, z), turned to `heading` about Y (its front is +Z before the turn). */
export function footprint(piece: PieceId, x: number, z: number, heading: number): Rect {
  const { front, back, side } = sizeOf(piece);
  const [c, s] = [Math.cos(heading), Math.sin(heading)];
  const local: Array<[number, number]> = [[-side, -back], [side, -back], [side, front], [-side, front]];
  return { corners: local.map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]) };
}

/** Whether two footprints overlap (touching edges don't count): separating-axis test on their edges. */
export function overlaps(a: Rect, b: Rect): boolean {
  for (const rect of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = rect.corners[i]!;
      const [x2, z2] = rect.corners[(i + 1) % 4]!;
      const axis = [z1 - z2, x2 - x1];
      const project = (r: Rect) => r.corners.map(([x, z]) => x * axis[0]! + z * axis[1]!);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

/** The gap left between two pieces in a face-off. */
const GAP = 0.06;
/** A face-off pair turns this far from facing each other square-on, toward the camera (+Z), as in the mockup. */
const TOWARD_CAMERA = Math.atan2(0.5, 1);

/**
 * Where each player in a face-off stands, from the tile's centre, and which way they face. Two stand nose
 * to nose with a small gap, each turned three-quarters toward the camera. Three or four stand in a ring,
 * facing its middle, far enough apart for the widest of them.
 */
export function faceOffSpots(players: readonly PlayerId[]): Array<{ dx: number; dz: number; heading: number }> {
  if (players.length === 2) {
    const [a, b] = players.map(pieceOf) as [PieceId, PieceId];
    const headingA = Math.PI / 2 - TOWARD_CAMERA;
    const headingB = -Math.PI / 2 + TOWARD_CAMERA;
    const reachA = Math.max(...footprint(a, 0, 0, headingA).corners.map(([x]) => x));
    const reachB = Math.min(...footprint(b, 0, 0, headingB).corners.map(([x]) => x));
    return [
      { dx: -(reachA + GAP / 2), dz: 0, heading: headingA },
      { dx: -reachB + GAP / 2, dz: 0, heading: headingB },
    ];
  }
  const n = players.length;
  const sizes = players.map((p) => sizeOf(pieceOf(p)));
  const widest = Math.max(...sizes.map((s) => Math.hypot(s.side, Math.max(s.front, s.back))));
  const radius = Math.max(widest + GAP, (widest + GAP / 2) / Math.sin(Math.PI / n));
  return players.map((_, i) => {
    const angle = Math.PI / n + (2 * Math.PI * i) / n;
    const dx = radius * Math.sin(angle);
    const dz = radius * Math.cos(angle);
    return { dx, dz, heading: Math.atan2(-dx, -dz) };
  });
}
