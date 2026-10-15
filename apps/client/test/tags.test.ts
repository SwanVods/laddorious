import type { PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { DirectorState } from '../src/director/director';
import { presentationFromView, type FaceOff } from '../src/director/presentation';
import { sizeOf } from '../src/scene/footprint';
import { restPose } from '../src/scene/motion';
import { TAG_EDGE, TAG_HEIGHT, TAG_PEEK_MS, createTagPeeks, tagAnchor, tagScreenPoint, tagVisible } from '../src/scene/tags';
import { openingUpdate } from './support/fixtures';

function state(positions: Record<PlayerId, number>, arrivals: PlayerId[] = ['p0', 'p1', 'p2', 'p3'], faceOffs: FaceOff[] = []): DirectorState {
  const shown = presentationFromView(openingUpdate().view);
  return { presentation: { ...shown, positions: { ...shown.positions, ...positions }, arrivals, faceOffs }, beat: null, settled: null, log: [], timeline: null };
}

/** A tile no rocket or flag stands on, where pieces stack. */
const PLAIN = (() => {
  const ends = new Set(openingUpdate().view.board.jumps.filter((j) => j.to > j.from).flatMap((j) => [j.from, j.to]));
  return Array.from({ length: 98 }, (_, i) => i + 2).find((t) => !ends.has(t))!;
})();

const anchor = (s: DirectorState, player: PlayerId) => tagAnchor(s, player, Number(player.slice(1)), 0, 100)!;

describe('name tags (spec #2 §7.2)', () => {
  it('hangs a tag above a piece standing alone', () => {
    const s = state({ p2: 9 });
    const [x, y, z] = restPose(s.presentation!, 'p2', 2).position;
    expect(anchor(s, 'p2')).toEqual([x, y + TAG_HEIGHT, z]);
  });

  it('hangs the top piece’s tag above the stack, and puts the one underneath beside it', () => {
    const s = state({ p0: PLAIN, p1: PLAIN }, ['p1', 'p0', 'p2', 'p3']);
    const top = anchor(s, 'p0');
    const under = anchor(s, 'p1');
    const [x] = restPose(s.presentation!, 'p1', 1).position;
    expect(top[0]).toBeCloseTo(x);
    expect(top[1]).toBeCloseTo(sizeOf('knight').height + TAG_HEIGHT);
    expect(Math.abs(under[0] - x)).toBeGreaterThan(0.5);
    expect(under[1]).toBeLessThan(top[1]);
  });

  it('keeps face-off opponents’ tags above their own pieces', () => {
    const s = state({ p0: 6, p1: 6 }, ['p1', 'p0', 'p2', 'p3'], [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }]);
    for (const p of ['p0', 'p1']) {
      const [x, y, z] = restPose(s.presentation!, p, Number(p.slice(1))).position;
      expect(anchor(s, p)).toEqual([x, y + TAG_HEIGHT, z]);
    }
  });

  it('staggers the tags on the start row, where the pieces stand close together', () => {
    const s = state({});
    const heights = ['p0', 'p1', 'p2', 'p3'].map((p) => anchor(s, p)[1]);
    expect(heights[1]! - heights[0]!).toBeGreaterThan(0.4);
    expect(heights[2]).toBeCloseTo(heights[0]!);
    expect(heights[3]).toBeCloseTo(heights[1]!);
  });

  it('has nothing to show before the first update', () => {
    expect(tagAnchor({ presentation: null, beat: null, settled: null, log: [], timeline: null }, 'p0', 0, 0, 100)).toBeNull();
  });
});

describe('which name tags show (round 5)', () => {
  it('always shows my own tag', () => {
    expect(tagVisible('p0', 'p0', createTagPeeks(), 0)).toBe(true);
  });

  it("hides another player's tag until the mouse is over their piece", () => {
    const peeks = createTagPeeks();
    expect(tagVisible('p1', 'p0', peeks, 0)).toBe(false);
    peeks.hovered = 'p1';
    expect(tagVisible('p1', 'p0', peeks, 0)).toBe(true);
    expect(tagVisible('p2', 'p0', peeks, 0)).toBe(false);
  });

  it("hides a tag while its piece's die shows, even mine, so the die isn't behind it (2026-10-14)", () => {
    expect(tagVisible('p0', 'p0', createTagPeeks(), 0, false, true)).toBe(false);
    expect(tagVisible('p0', 'p0', createTagPeeks(), 0, true, true)).toBe(false);
  });

  it('shows every tag once the match is won, so the ranks reveal can hang its badges on them', () => {
    expect(tagVisible('p1', 'p0', createTagPeeks(), 0, true)).toBe(true);
  });

  it("shows another player's tag for a while after their piece is tapped, and a second tap starts the wait again", () => {
    const peeks = createTagPeeks();
    peeks.tap('p1', 1000);
    expect(tagVisible('p1', 'p0', peeks, 1000 + TAG_PEEK_MS - 1)).toBe(true);
    expect(tagVisible('p1', 'p0', peeks, 1000 + TAG_PEEK_MS)).toBe(false);
    peeks.tap('p1', 2000);
    expect(tagVisible('p1', 'p0', peeks, 1000 + TAG_PEEK_MS)).toBe(true);
  });
});

describe('where a tag goes on screen (2026-10-15)', () => {
  it('places a tag at its piece, and hides it when the piece is behind the camera', () => {
    expect(tagScreenPoint({ x: 0.2, y: -0.3, z: 0.9 }, false)).toEqual({ x: 0.2, y: -0.3 });
    expect(tagScreenPoint({ x: 0.2, y: -0.3, z: 1.2 }, false)).toBeNull();
  });

  it('keeps a tag at the screen edge toward its piece while ranks show, so its badge stays in view', () => {
    expect(tagScreenPoint({ x: 3, y: 0.5, z: 0.9 }, true)).toEqual({ x: TAG_EDGE, y: 0.5 });
    expect(tagScreenPoint({ x: 0.1, y: -4, z: 0.9 }, true)).toEqual({ x: 0.1, y: -TAG_EDGE });
    // Behind the camera the projection flips: the piece is toward the other side.
    const behind = tagScreenPoint({ x: 0.5, y: 0.2, z: 1.3 }, true)!;
    expect(behind.x).toBeLessThan(0);
    expect(Math.max(Math.abs(behind.x), Math.abs(behind.y))).toBeCloseTo(TAG_EDGE, 6);
  });
});
