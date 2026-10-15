import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import type { DirectorState, PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { sizeOf } from '../src/scene/footprint';
import { PARTS, tileToWorld } from '../src/scene/layout';
import { CROWN_FLY_MS, END_TILE_FORWARD, cameraPoint, crownPose, crownWinner, landingPose, stackLandings, STILL_END, beatPose, endReaction, projectileAt, restPose, GENTLE, shieldBlocking } from '../src/scene/motion';
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
    expect(restPose(state, 'p0', 0).position[1] - restPose(state, 'p1', 1).position[1]).toBeCloseTo(sizeOf('knight').height);
  });

  it('stands face-off opponents side by side, facing each other', () => {
    const state = { ...at({ p0: 6, p1: 6 }), faceOffs: [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }] };
    const left = restPose(state, 'p0', 0);
    const right = restPose(state, 'p1', 1);
    expect(right.position[0]).toBeGreaterThan(left.position[0]);
    expect(Math.sin(left.rotation[1])).toBeGreaterThan(0.7); // facing +X, toward the other
    expect(Math.sin(right.rotation[1])).toBeLessThan(-0.7);
  });
});

describe('pieces at a rocket or a flag (2026-10-14)', () => {
  const ladder = openingUpdate().view.board.jumps.find((j) => j.to > j.from)!;

  it('stacks pieces in the middle of a flag or rocket tile, a little toward the camera, the end standing in its corner', () => {
    for (const tile of [ladder.from, ladder.to]) {
      const state = { ...at({ p0: tile, p1: tile }), arrivals: ['p0', 'p1', 'p2', 'p3'] };
      const [x, , z] = tileToWorld(tile);
      expectNear(restPose(state, 'p0', 0).position, [x, 0, z + END_TILE_FORWARD]);
      expect(restPose(state, 'p1', 1).position[1]).toBeCloseTo(sizeOf('knight').height);
    }
  });

  it('keeps a face-off on a flag tile side by side in the middle, clear of the flag in its corner', () => {
    const state = { ...at({ p0: ladder.to, p1: ladder.to }), faceOffs: [{ challengeId: 'c1', tile: ladder.to, players: ['p0', 'p1'] }] };
    const [x, , z] = tileToWorld(ladder.to);
    const pole = [x + PARTS.flagCorner.x + PARTS.flag.pole, z + PARTS.flagCorner.z];
    for (const id of ['p0', 'p1']) {
      const [px, , pz] = restPose(state, id, Number(id.slice(1))).position;
      expect(pz).toBeCloseTo(z + END_TILE_FORWARD);
      expect(Math.hypot(px - pole[0]!, pz - pole[1]!)).toBeGreaterThan(0.35);
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

  it("leaves other jumps' ends still, and every end still with no beat", () => {
    expect(endReaction(launch, other, 200)).toEqual({ rocket: STILL_END, flag: STILL_END });
    expect(endReaction(null, ladder, 200)).toEqual({ rocket: STILL_END, flag: STILL_END });
  });

  it('crouches the rocket, then lifts it off with the piece on a flaring flame, and sets it back down (2026-10-15)', () => {
    const crouch = endReaction(launch, ladder, 150).rocket;
    expect(crouch.lift).toBe(0);
    expect(crouch.squash).toBeLessThan(1);
    const up = endReaction(launch, ladder, 560).rocket;
    expect(up.lift).toBeGreaterThan(0.3);
    expect(up.flare).toBeGreaterThan(0.8);
    const landing = endReaction(launch, ladder, 960).rocket;
    expect(landing.lift).toBe(0);
    expect(landing.flare).toBeLessThan(0.3);
    expect(STILL_END).toMatchObject({ lift: 0, flare: 0 });
  });

  it('lifts the rocket a quarter as high with reduced motion, its flame flaring as usual', () => {
    const full = endReaction(launch, ladder, 560).rocket;
    const calm = endReaction(launch, ladder, 560, true).rocket;
    expect(calm.lift).toBeCloseTo(full.lift * GENTLE, 6);
    expect(calm.flare).toBeCloseTo(full.flare, 6);
  });

  it('rocks the rocket gently with reduced motion: a quarter as far (2026-10-15)', () => {
    const full = endReaction(launch, ladder, 200).rocket;
    const calm = endReaction(launch, ladder, 200, true).rocket;
    expect(calm.sway).toBeCloseTo(full.sway * GENTLE, 6);
    expect(calm.pop - 1).toBeCloseTo((full.pop - 1) * GENTLE, 6);
    expect(calm).not.toEqual(STILL_END);
  });
});

describe('landing on a stack (2026-10-14)', () => {
  // p1 and p2 already stand on PLAIN, p2 on top; p0 hops 3 tiles onto them.
  const from = { ...at({ p0: PLAIN - 3, p1: PLAIN, p2: PLAIN }), arrivals: ['p3', 'p1', 'p2', 'p0'] };
  const hop = { ...beat([moved('p0', PLAIN - 3, PLAIN)], from), startedAt: 1000 };
  const landed = 1000 + 3 * BEAT_MS.hopPerTile;
  const still = restPose(hop.after, 'p0', 0);

  it('records who landed on whom, and when', () => {
    expect(stackLandings(hop, SIZE)).toEqual([{ player: 'p0', under: 'p2', atMs: landed }]);
  });

  it('records nothing for a landing on an empty tile', () => {
    const lone = { ...beat([moved('p3', 2, 5)], at({ p3: 2 })), startedAt: 0 };
    expect(stackLandings(lone, SIZE)).toEqual([]);
  });

  it('wiggles the piece that landed, dying away by 800 ms', () => {
    const landings = stackLandings(hop, SIZE);
    expect(landingPose(still, 'p0', landings, landed + 200, false).rotation[0]).not.toBeCloseTo(still.rotation[0], 3);
    expect(landingPose(still, 'p0', landings, landed + 800, false).rotation[0]).toBeCloseTo(still.rotation[0], 6);
  });

  it('squashes only the piece directly under it, and only briefly', () => {
    const landings = stackLandings(hop, SIZE);
    const under = restPose(hop.after, 'p2', 2);
    expect(landingPose(under, 'p2', landings, landed + 130, false).scale[1]).toBeLessThan(0.9);
    expect(landingPose(under, 'p2', landings, landed + 260, false).scale[1]).toBeCloseTo(1, 6);
    const bottom = restPose(hop.after, 'p1', 1);
    expect(landingPose(bottom, 'p1', landings, landed + 130, false)).toEqual(bottom);
  });

  it('wiggles gently with reduced motion: a quarter as far (2026-10-15)', () => {
    const landings = stackLandings(hop, SIZE);
    const full = landingPose(still, 'p0', landings, landed + 200, false).rotation[0] - still.rotation[0];
    const calm = landingPose(still, 'p0', landings, landed + 200, true).rotation[0] - still.rotation[0];
    expect(calm).toBeCloseTo(full * GENTLE, 6);
    expect(calm).not.toBe(0);
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

  it('opens my face-off with the collision: both stay stacked, then the top one hops down to its spot', () => {
    expect(faceOff.durationMs).toBe(BEAT_MS.faceOffIntro);
    const hold = BEAT_MS.faceOffIntro - BEAT_MS.unstack;
    for (const id of players) expectNear(beatPose(faceOff, from, id, Number(id.slice(1)), hold - 50, SIZE).position, restPose(from, id, Number(id.slice(1))).position);
    const top = from.arrivals.filter((id) => players.includes(id)).at(-1)!;
    const seat = Number(top.slice(1));
    const a = restPose(from, top, seat).position;
    const b = spot(top);
    const mid = beatPose(faceOff, from, top, seat, hold + BEAT_MS.unstack / 2, SIZE).position;
    expect(mid[1]).toBeGreaterThan((a[1] + b[1]) / 2 + 0.3); // a hop, not a slide
    for (const id of players) expectNear(beatPose(faceOff, from, id, Number(id.slice(1)), faceOff.durationMs, SIZE).position, spot(id));
  });

  it('keeps both pieces at their face-off spots through the result, not back on a stack', () => {
    for (const id of players) expectNear(beatPose(result, faceOff.after, id, Number(id.slice(1)), result.durationMs, SIZE).position, spot(id));
  });

  it('backflips the loser away from its face-off spot along a high arc, then lands it with a squash', () => {
    expect(knockback.durationMs).toBe(BEAT_MS.knockback + BEAT_MS.knockbackLand + BEAT_MS.knockbackSettle);
    expectNear(beatPose(knockback, result.after, 'p0', 0, 0, SIZE).position, spot('p0'));
    const mid = beatPose(knockback, result.after, 'p0', 0, BEAT_MS.knockback / 2, SIZE);
    expect(mid.position[1]).toBeGreaterThan(1.6);
    expect(mid.rotation[0]).toBeLessThan(-1); // nose up and over backwards, about its own side
    expect(mid.rotation[1]).toBeCloseTo(restPose(faceOff.after, 'p0', 0).rotation[1]); // still facing the winner
    const landing = beatPose(knockback, result.after, 'p0', 0, BEAT_MS.knockback + BEAT_MS.knockbackLand / 2, SIZE);
    expect(landing.scale[1]).toBeLessThan(0.9);
  });

  it('keeps the winner at its spot until the loser lands, then settles it', () => {
    expectNear(beatPose(knockback, result.after, 'p1', 1, BEAT_MS.knockback, SIZE).position, spot('p1'));
  });

  it('settles the winner from its face-off spot to the middle of the tile, alone', () => {
    expectNear(beatPose(knockback, result.after, 'p1', 1, 0, SIZE).position, spot('p1'));
    const [x, , z] = tileToWorld(PLAIN);
    expectNear(beatPose(knockback, result.after, 'p1', 1, knockback.durationMs, SIZE).position, [x, 0, z]);
  });
});

describe('hops, like the mockup (2026-10-14)', () => {
  const from = at({ p0: 10 });
  const hop = beat([moved('p0', 10, 13)], from);
  const start = tileToWorld(10);
  const next = tileToWorld(11);
  const across = (t: number) => {
    const p = beatPose(hop, from, 'p0', 0, t, SIZE).position;
    return Math.hypot(p[0] - start[0], p[2] - start[2]) / Math.hypot(next[0] - start[0], next[2] - start[2]);
  };

  it('eases each hop in and out: slow off the ground, slow into the landing', () => {
    expect(across(BEAT_MS.hopAir * 0.25)).toBeLessThan(0.2);
    expect(across(BEAT_MS.hopAir * 0.75)).toBeGreaterThan(0.8);
  });

  it('lands every hop with a short squash, not just the last', () => {
    const squash = beatPose(hop, from, 'p0', 0, BEAT_MS.hopAir + (BEAT_MS.hopPerTile - BEAT_MS.hopAir) / 2, SIZE);
    expect(squash.scale[1]).toBeLessThan(0.95);
    expect(beatPose(hop, from, 'p0', 0, BEAT_MS.hopPerTile * 1.01, SIZE).scale[1]).toBeGreaterThan(1); // stretching up into the next hop
  });

  it('takes the hop up onto a stack slower and higher', () => {
    const stacked = { ...at({ p0: 12, p1: 13 }), arrivals: ['p1', 'p2', 'p3', 'p0'] };
    const up = beat([moved('p0', 12, 13)], stacked);
    const plain = beat([moved('p0', 10, 11)], from);
    expect(up.durationMs - plain.durationMs).toBeCloseTo(BEAT_MS.hopPerTile * 0.4, 0);
    const top = restPose(up.after, 'p0', 0).position[1];
    const peak = Math.max(...Array.from({ length: 40 }, (_, i) => beatPose(up, stacked, 'p0', 0, (i / 40) * up.durationMs, SIZE).position[1]));
    expect(peak).toBeGreaterThan(top / 2 + 0.85);
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
  const during = (b: PlayingBeat | null): DirectorState => ({ presentation: from, beat: b, settled: null, log: [], timeline: null });
  const { view } = openingUpdate();
  const after: DirectorState = { presentation: from, beat: null, settled: { view: { ...view, phase: { kind: 'finished', winner: 'p2', rankings } }, events: [], timer: null }, log: [], timeline: null };

  it('knows the winner from the victory beat, and after it from the settled view', () => {
    expect(crownWinner(during(null))).toBeNull();
    expect(crownWinner(during(victory))).toBe('p2');
    expect(crownWinner(after)).toBe('p2');
  });

  it("waits on the board's last tile, whatever the board's size (2026-10-15)", () => {
    const small: DirectorState = { presentation: from, beat: null, settled: { view: { ...view, board: { ...view.board, size: 64 } }, events: [], timer: null }, log: [], timeline: null };
    const last = tileToWorld(64);
    expectNear(crownPose(small, null, 1000).position, [last[0], 0.01, last[2]]);
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

  it('still flies with reduced motion, bouncing only a quarter as high (2026-10-15)', () => {
    expectNear(crownPose(during(victory), head, 0, true).position, [goal[0], 0.01, goal[2]]);
    const bounce = (reduced: boolean) => crownPose(during(victory), head, CROWN_FLY_MS + 100, reduced).position[1] - head[1];
    expect(bounce(true)).toBeCloseTo(bounce(false) * GENTLE, 6);
    expect(crownPose(during(victory), head, CROWN_FLY_MS + 100, true).sparkle).toBeGreaterThan(0);
  });
});

describe('the shield bubble flaring (2026-10-15)', () => {
  const blocked: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'blocked', visibility: 'public' };
  const card: PlayingBeat = { kind: 'cardResolved', durationMs: BEAT_MS.cardLead + 1200, events: [blocked], after: at({}), startedAt: 1000 };
  const lands = 1000 + BEAT_MS.cardLead + 600;

  it("flares only once the card's projectile reaches the shield, not during the camera's lead-in", () => {
    expect(shieldBlocking(card, 'p0', 1000 + 100)).toBe(false);
    expect(shieldBlocking(card, 'p0', lands - 10)).toBe(false);
    expect(shieldBlocking(card, 'p0', lands + 10)).toBe(true);
    expect(shieldBlocking(card, 'p1', lands + 10)).toBe(false);
  });

  it('flares at once for a slide it stops, and not without a beat', () => {
    const stopped: PlayingBeat = { kind: 'snakeBlocked', durationMs: 800, events: [{ type: 'SnakeBlocked', player: 'p0', tile: 9, visibility: 'public' } as GameEvent], after: at({}), startedAt: 0 };
    expect(shieldBlocking(stopped, 'p0', 0)).toBe(true);
    expect(shieldBlocking(null, 'p0', 0)).toBe(false);
  });
});

describe("the camera's point on a hopping piece (2026-10-15)", () => {
  // Following each hop up and down, and each hop's start and stop, made the camera wobble (the user felt sick).
  const from = at({ p0: PLAIN - 4 });
  const hop = beat([moved('p0', PLAIN - 4, PLAIN)], from);
  const state = (now: number) => ({ beat: { ...hop }, presentation: from, now });
  const point = (now: number) => cameraPoint({ beat: hop, presentation: from } as never, 'p0', 0, now, SIZE)!;

  it("glides at board height, with none of the hops' arcs", () => {
    const top = Math.max(restPose(from, 'p0', 0).position[1], restPose(hop.after, 'p0', 0).position[1]);
    for (let t = 0; t <= hop.durationMs; t += 25) expect(point(t)[1]).toBeLessThanOrEqual(top + 1e-6);
    void state;
  });

  it("keeps moving through each hop's landing, where the piece itself pauses", () => {
    const pose = (t: number) => beatPose(hop, from, 'p0', 0, t, SIZE).position;
    // Find a moment the piece stands still between hops.
    let still = -1;
    for (let t = 50; t < hop.durationMs - 300; t += 10) {
      const a = pose(t), b = pose(t + 10);
      if (Math.hypot(b[0] - a[0], b[2] - a[2]) < 1e-9) { still = t; break; }
    }
    expect(still).toBeGreaterThan(0);
    const a = point(still), b = point(still + 10);
    expect(Math.hypot(b[0] - a[0], b[2] - a[2])).toBeGreaterThan(0.005);
  });

  it('ends where the piece lands, and follows the piece itself in other beats', () => {
    expectNear(point(hop.durationMs + 100), restPose(hop.after, 'p0', 0).position);
    expectNear(cameraPoint({ beat: null, presentation: from } as never, 'p0', 0, 0, SIZE)!, restPose(from, 'p0', 0).position);
  });
});
