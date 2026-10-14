import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import type { DirectorState, PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { PARTS, tileToWorld } from '../src/scene/layout';
import { CROWN_FLY_MS, END_ROW, FACE_OFF_GAP, crownPose, crownWinner, STACK_HEIGHT, STILL_END, beatPose, endReaction, projectileAt, restPose } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

/** A tile no rocket or flag stands on, where pieces stack. */
const PLAIN = (() => {
  const ends = new Set(openingUpdate().view.board.jumps.filter((j) => j.to > j.from).flatMap((j) => [j.from, j.to]));
  return Array.from({ length: 98 }, (_, i) => i + 2).find((t) => !ends.has(t))!;
})();

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
    const state = { ...at({ p0: PLAIN, p1: PLAIN }), arrivals: ['p1', 'p0', 'p2', 'p3'] };
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

describe('pieces at a rocket or a flag (round 5)', () => {
  const ladder = openingUpdate().view.board.jumps.find((j) => j.to > j.from)!;
  const players = ['p0', 'p1', 'p2', 'p3'];
  const flat = (p: readonly number[]) => [p[0]!, p[2]!] as const;
  const apart = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

  /** Where n pieces stand on a tile, and that tile's centre on the ground. */
  function row(tile: number, n: number) {
    const state = at(Object.fromEntries(players.slice(0, n).map((id) => [id, tile])));
    return players.slice(0, n).map((id, seat) => restPose(state, id, seat).position);
  }

  it.each([1, 2, 3, 4])('stands %i pieces in a row in front of a flag, clear of its pole and of each other', (n) => {
    const [x, , z] = tileToWorld(ladder.to);
    const pole = [x + PARTS.flag.pole, z];
    const spots = row(ladder.to, n);
    for (const [i, spot] of spots.entries()) {
      expect(spot[1]).toBe(0); // side by side, not stacked
      expect(spot[2]).toBeCloseTo(z + END_ROW.forward);
      expect(apart(flat(spot), pole)).toBeGreaterThan(0.35);
      for (const other of spots.slice(i + 1)) expect(apart(flat(spot), flat(other))).toBeGreaterThan(0.35);
    }
  });

  it('stands pieces in a row in front of a rocket too, clear of it', () => {
    const [x, , z] = tileToWorld(ladder.from);
    const spots = row(ladder.from, 4);
    for (const spot of spots) {
      expect(spot[1]).toBe(0);
      expect(apart(flat(spot), [x, z])).toBeGreaterThan(0.35);
    }
    expect(new Set(spots.map((s) => s[0])).size).toBe(4);
  });

  it('still stacks pieces on a plain tile', () => {
    const [low, high] = row(PLAIN, 2);
    expect(high![1] - low![1]).toBeCloseTo(STACK_HEIGHT);
  });

  it('keeps a face-off on a flag tile side by side, moved forward clear of the pole', () => {
    const state = { ...at({ p0: ladder.to, p1: ladder.to }), faceOffs: [{ challengeId: 'c1', tile: ladder.to, players: ['p0', 'p1'] }] };
    const left = restPose(state, 'p0', 0).position;
    const right = restPose(state, 'p1', 1).position;
    expect(right[0] - left[0]).toBeCloseTo(FACE_OFF_GAP);
    const [x, , z] = tileToWorld(ladder.to);
    for (const spot of [left, right]) {
      expect(spot[2]).toBeCloseTo(z + END_ROW.forward);
      expect(apart(flat(spot), [x + PARTS.flag.pole, z])).toBeGreaterThan(0.35);
    }
  });
});

describe('the ends react (round 5)', () => {
  const ladder = openingUpdate().view.board.jumps.find((j) => j.to > j.from)!;
  const other = openingUpdate().view.board.jumps.find((j) => j.to > j.from && j.id !== ladder.id)!;
  const from = at({ p0: ladder.from });
  const launch = beat([moved('p0', ladder.from, ladder.to, 'ladder')], from);

  it('shakes a rocket as a piece launches from it, and leaves its flag still till the landing', () => {
    const early = endReaction(launch, ladder, 200);
    expect(early.rocket).not.toEqual(STILL_END);
    expect(early.flag).toEqual(STILL_END);
  });

  it('waves the flag as the piece lands at it, and the rocket has settled', () => {
    const late = endReaction(launch, ladder, launch.durationMs - 250);
    expect(late.flag.sway).not.toBe(0);
    expect(late.flag.pop).toBeGreaterThan(1);
    expect(late.rocket).toEqual(STILL_END);
  });

  it("leaves other jumps' ends still, and every end still with reduced motion or no beat", () => {
    expect(endReaction(launch, other, 200)).toEqual({ rocket: STILL_END, flag: STILL_END });
    expect(endReaction(launch, ladder, 200, true)).toEqual({ rocket: STILL_END, flag: STILL_END });
    expect(endReaction(null, ladder, 200)).toEqual({ rocket: STILL_END, flag: STILL_END });
  });
});

describe('after a face-off (2026-10-14)', () => {
  const players = ['p0', 'p1'];
  const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: PLAIN, players, kind: 'rps', theme: null, visibility: 'public' };
  const resolved: GameEvent = { type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' };
  const knocked = moved('p0', PLAIN, PLAIN - 3, 'knockback');
  const from = at({ p0: PLAIN, p1: PLAIN });
  const timeline = buildTimeline([started, resolved, knocked], from, 'p0', SIZE).map((b) => ({ ...b, startedAt: 0 }));
  const [faceOff, result, knockback] = timeline as [PlayingBeat, PlayingBeat, PlayingBeat];
  const spot = (id: string) => restPose(faceOff.after, id, Number(id.slice(1))).position;

  it('keeps both pieces at their face-off spots through the result, not back on a stack', () => {
    for (const id of players) expectNear(beatPose(result, faceOff.after, id, Number(id.slice(1)), result.durationMs, SIZE).position, spot(id));
  });

  it('flips the loser away from its face-off spot, backwards, along an arc', () => {
    expectNear(beatPose(knockback, result.after, 'p0', 0, 0, SIZE).position, spot('p0'));
    const mid = beatPose(knockback, result.after, 'p0', 0, knockback.durationMs / 2, SIZE);
    expect(mid.position[1]).toBeGreaterThan(1);
    expect(Math.abs(mid.rotation[0])).toBeGreaterThan(1);
  });

  it('settles the winner from its face-off spot to the middle of the tile, alone', () => {
    expectNear(beatPose(knockback, result.after, 'p1', 1, 0, SIZE).position, spot('p1'));
    const [x, , z] = tileToWorld(PLAIN);
    expectNear(beatPose(knockback, result.after, 'p1', 1, knockback.durationMs, SIZE).position, [x, 0, z]);
  });
});

describe('beat poses (spec #2 §5.1)', () => {
  it('hops tile by tile on a dice move', () => {
    const from = at({ p0: 2 });
    const b = beat([moved('p0', 2, 5)], from);
    expectNear(beatPose(b, from, 'p0', 0, 0, SIZE).position, restPose(from, 'p0', 0).position);
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile, SIZE).position, tileToWorld(3));
    expect(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 1.5, SIZE).position[1]).toBeGreaterThan(0.3);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, restPose(b.after, 'p0', 0).position);
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
    expectNear(end.position, restPose(b.after, 'p0', 0).position);
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
    // It waits for the camera's lead-in (2026-10-14), then flies over the first half of what's left.
    expect(projectileAt(b, from, seatOf, BEAT_MS.cardLead / 2)).toBeNull();
    const play = b.durationMs - BEAT_MS.cardLead;
    const start = projectileAt(b, from, seatOf, BEAT_MS.cardLead)!;
    expect(start[0]).toBeCloseTo(restPose(from, 'p1', 1).position[0]);
    expect(start[2]).toBeCloseTo(restPose(from, 'p1', 1).position[2]);
    expect(projectileAt(b, from, seatOf, BEAT_MS.cardLead + play * 0.25)![1]).toBeGreaterThan(1.5);
    expect(projectileAt(b, from, seatOf, BEAT_MS.cardLead + play * 0.6)).toBeNull();
    expect(projectileAt({ ...b, events: [{ ...card, target: 'p1' }] }, from, seatOf, 0)).toBeNull();
  });
});

describe('the crown (round 5)', () => {
  const goal = tileToWorld(100);
  const head: [number, number, number] = [3, 2.4, -1];
  const rankings = [{ player: 'p2', rank: 1, position: 100 }];
  const from = at({ p2: 100 });
  const victory = beat([{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }], from);
  const during = (b: PlayingBeat | null): DirectorState => ({ presentation: from, beat: b, settled: null, log: [] });
  const { view } = openingUpdate();
  const after: DirectorState = { presentation: from, beat: null, settled: { view: { ...view, phase: { kind: 'finished', winner: 'p2', rankings } }, events: [], timer: null }, log: [] };

  it('knows the winner from the victory beat, and after it from the settled view', () => {
    expect(crownWinner(during(null))).toBeNull();
    expect(crownWinner(during(victory))).toBe('p2');
    expect(crownWinner(after)).toBe('p2');
  });

  it('spins on tile 100 before the win', () => {
    const a = crownPose(during(null), null, 1000);
    expectNear(a.position, [goal[0], 0.01, goal[2]]);
    expect(crownPose(during(null), null, 2000).turn).not.toBeCloseTo(a.turn);
  });

  it('flies from tile 100 over an arc onto the head, and bounces there as the bounce dies away', () => {
    expectNear(crownPose(during(victory), head, 0).position, [goal[0], 0.01, goal[2]]);
    const mid = crownPose(during(victory), head, CROWN_FLY_MS / 2).position;
    expect(mid[1]).toBeGreaterThan((0.01 + head[1]) / 2 + 1);
    expect(crownPose(during(victory), head, CROWN_FLY_MS + 100).position[1]).toBeGreaterThan(head[1]);
    expectNear(crownPose(during(victory), head, victory.durationMs).position, head);
  });

  it('bursts its sparkles as it lands, not before', () => {
    expect(crownPose(during(victory), head, CROWN_FLY_MS - 1).sparkle).toBeNull();
    expect(crownPose(during(victory), head, CROWN_FLY_MS + 100).sparkle).toBeGreaterThan(0);
  });

  it('stays on the head through the ranks and after', () => {
    expectNear(crownPose(during({ ...victory, kind: 'ranks' }), head, 0).position, head);
    expectNear(crownPose(after, head, 99_000).position, head);
  });

  it('cuts straight to the head with reduced motion, with no sparkles', () => {
    const pose = crownPose(during(victory), head, 0, true);
    expectNear(pose.position, head);
    expect(pose.sparkle).toBeNull();
  });
});
