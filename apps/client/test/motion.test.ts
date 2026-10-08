import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { tileToWorld } from '../src/scene/layout';
import { FACE_OFF_GAP, STACK_HEIGHT, beatPose, projectileAt, restPose } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

function at(positions: Record<PlayerId, number> = {}): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, ...positions } };
}

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice', bounced = false): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced, visibility: 'public' };
}

/** The one beat these events make, started at time 0. */
function beat(events: GameEvent[], from: PresentationState): PlayingBeat {
  const [only] = buildTimeline(events, from, 'p0', SIZE);
  return { ...only!, startedAt: 0 };
}

function expectNear(actual: number[], expected: number[]) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 5));
}

describe('rest poses', () => {
  it('lines the pieces up on the start row, one spot per seat', () => {
    const poses = [0, 1, 2, 3].map((seat) => restPose(at(), `p${seat}`, seat));
    expect(new Set(poses.map((p) => p.position[0])).size).toBe(4);
  });

  it('faces each piece along its row, so the camera sees its profile', () => {
    expect(restPose(at({ p0: 5 }), 'p0', 0).rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(restPose(at({ p0: 15 }), 'p0', 0).rotation[1]).toBeCloseTo(-Math.PI / 2);
    expect(restPose(at(), 'p0', 0).rotation[1]).toBeCloseTo(Math.PI / 2);
  });

  it('stands a later arrival on top of the stack', () => {
    const state = { ...at({ p0: 5, p1: 5 }), arrivals: ['p1', 'p0', 'p2', 'p3'] };
    expect(restPose(state, 'p0', 0).position[1] - restPose(state, 'p1', 1).position[1]).toBeCloseTo(STACK_HEIGHT);
  });

  it('stands face-off opponents side by side, facing each other', () => {
    const state = { ...at({ p0: 6, p1: 6 }), faceOffs: [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }] };
    const left = restPose(state, 'p0', 0);
    const right = restPose(state, 'p1', 1);
    expect(right.position[0] - left.position[0]).toBeCloseTo(FACE_OFF_GAP);
    expect(left.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(right.rotation[1]).toBeCloseTo(-Math.PI / 2);
  });
});

describe('beat poses (spec #2 §5.1)', () => {
  it('hops tile by tile on a dice move', () => {
    const from = at({ p0: 2 });
    const b = beat([moved('p0', 2, 5)], from);
    expectNear(beatPose(b, from, 'p0', 0, 0, SIZE).position, tileToWorld(2));
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile, SIZE).position, tileToWorld(3));
    expect(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 1.5, SIZE).position[1]).toBeGreaterThan(0.3);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(5));
  });

  it('walks a bounce up to the last tile and back', () => {
    const from = at({ p0: 97 });
    const b = beat([moved('p0', 97, 98, 'dice', true)], from);
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 3, SIZE).position, tileToWorld(100));
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(98));
  });

  it('rides a slide as an orb and pops out at the tail', () => {
    const from = at({ p0: 47 });
    const b = beat([moved('p0', 47, 26, 'snake')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).orb).toBe(true);
    const end = beatPose(b, from, 'p0', 0, b.durationMs, SIZE);
    expect(end.orb).toBe(false);
    expectNear(end.position, tileToWorld(26));
    expectNear(end.scale, [1, 1, 1]);
  });

  it('arcs a launch above both ends and lands on the ladder top', () => {
    const from = at({ p0: 4 });
    const b = beat([moved('p0', 4, 14, 'ladder')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).position[1]).toBeGreaterThan(1);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(14));
  });

  it('eases a piece the beat does not move from its old spot to its new one', () => {
    const from = { ...at({ p0: 6, p1: 6 }), arrivals: ['p0', 'p1', 'p2', 'p3'] };
    const b = beat([{ type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' }], from);
    expectNear(beatPose(b, from, 'p1', 1, 0, SIZE).position, restPose(from, 'p1', 1).position);
    expectNear(beatPose(b, from, 'p1', 1, b.durationMs, SIZE).position, restPose(b.after, 'p1', 1).position);
  });

  it("throws a card's projectile from the caster to its target, never at the caster itself", () => {
    const from = at({ p0: 10, p1: 20 });
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    const b = beat([card], from);
    const seatOf = (id: PlayerId) => Number(id.slice(1));
    const start = projectileAt(b, from, seatOf, 0)!;
    expect(start[0]).toBeCloseTo(tileToWorld(20)[0]);
    expect(start[2]).toBeCloseTo(tileToWorld(20)[2]);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.25)![1]).toBeGreaterThan(1.5);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.6)).toBeNull();
    expect(projectileAt({ ...b, events: [{ ...card, target: 'p1' }] }, from, seatOf, 0)).toBeNull();
  });
});
