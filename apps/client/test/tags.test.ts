import type { PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { DirectorState } from '../src/director/director';
import { presentationFromView, type FaceOff } from '../src/director/presentation';
import { STACK_HEIGHT, restPose } from '../src/scene/motion';
import { TAG_HEIGHT, tagAnchor } from '../src/scene/tags';
import { openingUpdate } from './support/fixtures';

function state(positions: Record<PlayerId, number>, arrivals: PlayerId[] = ['p0', 'p1', 'p2', 'p3'], faceOffs: FaceOff[] = []): DirectorState {
  const shown = presentationFromView(openingUpdate().view);
  return { presentation: { ...shown, positions: { ...shown.positions, ...positions }, arrivals, faceOffs }, beat: null, settled: null, log: [] };
}

const anchor = (s: DirectorState, player: PlayerId) => tagAnchor(s, player, Number(player.slice(1)), 0, 100)!;

describe('name tags (spec #2 §7.2)', () => {
  it('hangs a tag above a piece standing alone', () => {
    const s = state({ p2: 9 });
    const [x, y, z] = restPose(s.presentation!, 'p2', 2).position;
    expect(anchor(s, 'p2')).toEqual([x, y + TAG_HEIGHT, z]);
  });

  it('hangs the top piece’s tag above the stack, and puts the one underneath beside it', () => {
    const s = state({ p0: 5, p1: 5 }, ['p1', 'p0', 'p2', 'p3']);
    const top = anchor(s, 'p0');
    const under = anchor(s, 'p1');
    const [x] = restPose(s.presentation!, 'p1', 1).position;
    expect(top[0]).toBeCloseTo(x);
    expect(top[1]).toBeCloseTo(STACK_HEIGHT + TAG_HEIGHT);
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
    expect(tagAnchor({ presentation: null, beat: null, settled: null, log: [] }, 'p0', 0, 0, 100)).toBeNull();
  });
});
