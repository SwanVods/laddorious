import type { PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { PIECE_SIZES } from '../src/assets/pieceSizes';
import { faceOffSpots, footprint, overlaps, setSeatPieces, type Rect } from '../src/scene/footprint';
import { PARTS, TILE_ACROSS, tileToWorld } from '../src/scene/layout';
import { restPose } from '../src/scene/motion';
import { PIECE_SCALE } from '../src/scene/Pieces';
import { PIECES, type PieceId } from '../src/service/matchService';
import { openingUpdate } from './support/fixtures';

// No object overlaps another when pieces stack or face off (the user, 2026-10-14): every pair of the
// seven pieces, measured from their models, checked as turned rectangles on the ground.

const board = openingUpdate().view.board;
const ladder = board.jumps.find((j) => j.to > j.from)!;
const ids = ['p0', 'p1', 'p2', 'p3'];

function state(tile: number, players: PlayerId[], faceOff: boolean): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return {
    ...shown,
    positions: Object.fromEntries(ids.map((id) => [id, players.includes(id) ? tile : 0])),
    arrivals: [...players, ...ids.filter((id) => !players.includes(id))],
    faceOffs: faceOff ? [{ challengeId: 'c1', tile, players }] : [],
  };
}

/** Where each player's piece stands, as a turned rectangle on the ground. */
function rects(s: PresentationState, players: PlayerId[], pieces: PieceId[]): Rect[] {
  return players.map((id, i) => {
    const { position, rotation, scale } = restPose(s, id, i);
    // At the size the piece is drawn (a crowded face-off ring is drawn smaller, 2026-10-15).
    const at = footprint(pieces[i]!, 0, 0, rotation[1]);
    return { corners: at.corners.map(([x, z]) => [position[0] + x * scale[0], position[2] + z * scale[2]] as [number, number]) };
  });
}

/** The flag's footprint on its tile: the model's ground extent at the flag's corner. */
function flagRect(tile: number): Rect {
  const [x, , z] = tileToWorld(tile);
  const cx = x + PARTS.flagCorner.x;
  const cz = z + PARTS.flagCorner.z;
  return { corners: [[cx - 0.348, cz - 0.176], [cx + 0.468, cz - 0.176], [cx + 0.468, cz + 0.176], [cx - 0.348, cz + 0.176]] };
}

const pairs = PIECES.flatMap((a) => PIECES.map((b) => [a, b] as [PieceId, PieceId]));
const plain = Array.from({ length: 98 }, (_, i) => i + 2).find((t) => !board.jumps.some((j) => j.from === t || j.to === t) && !board.mystery[t])!;

describe('nothing overlaps when pieces stack or face off (2026-10-14)', () => {
  it.each(pairs)('stands a %s and a %s apart in a face-off, on a plain tile and on a flag tile', (a, b) => {
    setSeatPieces({ p0: a, p1: b });
    for (const tile of [plain, ladder.to]) {
      const s = state(tile, ['p0', 'p1'], true);
      const [ra, rb] = rects(s, ['p0', 'p1'], [a, b]);
      expect(overlaps(ra!, rb!), `tile ${tile}`).toBe(false);
      if (tile === ladder.to) for (const r of [ra!, rb!]) expect(overlaps(r, flagRect(tile))).toBe(false);
    }
  });

  it.each(PIECES)('keeps a %s standing on a flag tile clear of the flag', (piece) => {
    setSeatPieces({ p0: piece });
    const [r] = rects(state(ladder.to, ['p0'], false), ['p0'], [piece]);
    expect(overlaps(r!, flagRect(ladder.to))).toBe(false);
  });

  it.each(pairs)('sets a %s exactly on the head of a %s below it', (top, bottom) => {
    setSeatPieces({ p0: bottom, p1: top });
    const s = state(plain, ['p0', 'p1'], false);
    const under = restPose(s, 'p0', 0).position[1];
    const over = restPose(s, 'p1', 1).position[1];
    expect(over - under).toBeCloseTo(PIECE_SIZES[bottom].height * PIECE_SCALE, 3);
  });

  it.each([3, 4])('stands %i pieces in a face-off in a ring, none touching another', (n) => {
    for (const piece of PIECES) {
      const players = ids.slice(0, n);
      setSeatPieces(Object.fromEntries(players.map((id) => [id, piece])));
      const rs = rects(state(plain, players, true), players, players.map(() => piece));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlaps(rs[i]!, rs[j]!), `${piece} ${i}-${j}`).toBe(false);
    }
  });

  it('turns a face-off pair three-quarters toward the camera, still facing each other', () => {
    setSeatPieces({ p0: 'knight', p1: 'knight' });
    const s = state(plain, ['p0', 'p1'], true);
    const left = restPose(s, 'p0', 0);
    const right = restPose(s, 'p1', 1);
    expect(left.position[0]).toBeLessThan(right.position[0]);
    // Facing +X and -X, each turned partway toward the camera (+Z).
    expect(Math.sin(left.rotation[1])).toBeGreaterThan(0.7);
    expect(Math.sin(right.rotation[1])).toBeLessThan(-0.7);
    expect(Math.cos(left.rotation[1])).toBeGreaterThan(0.2);
    expect(Math.cos(right.rotation[1])).toBeGreaterThan(0.2);
  });
});

describe('a face-off of three or four (2026-10-15)', () => {
  it('stays on its own square, the pieces drawn a little smaller when they would reach a neighbour', () => {
    const big: PieceId[] = ['dragon', 'duck', 'rook', 'hat'];
    for (const n of [3, 4]) {
      const players = big.slice(0, n).map((_, i) => `q${i}`);
      setSeatPieces(Object.fromEntries(players.map((id, i) => [id, big[i]!])));
      const spots = faceOffSpots(players);
      spots.forEach((spot, i) => {
        expect(spot.scale).toBeGreaterThan(0.5);
        expect(spot.scale).toBeLessThanOrEqual(1);
        // The footprint, at the spot's size, from the square's centre.
        for (const [x, z] of footprint(big[i]!, 0, 0, spot.heading).corners) {
          expect(Math.abs(spot.dx + x * spot.scale), `${n}: ${big[i]}`).toBeLessThanOrEqual(TILE_ACROSS / 2 + 1e-6);
          expect(Math.abs(spot.dz + z * spot.scale), `${n}: ${big[i]}`).toBeLessThanOrEqual(TILE_ACROSS / 2 + 1e-6);
        }
      });
    }
    // A pair keeps its size.
    setSeatPieces({ q0: 'dragon', q1: 'duck' });
    expect(faceOffSpots(['q0', 'q1']).map((s) => s.scale)).toEqual([1, 1]);
  });
});

