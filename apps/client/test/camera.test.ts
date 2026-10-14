import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { cameraShot, type ShotInput } from '../src/scene/camera';
import { BOARD_SCALE, COLUMNS, TILE_SIZE, tileToWorld, type Vec3 } from '../src/scene/layout';
import { openingUpdate } from './support/fixtures';

const SPOTS: Record<PlayerId, Vec3> = { p0: [1, 0, 1], p1: [5, 0, -3], p2: [-4, 0, 2], p3: [0, 0, -6] };
const after = presentationFromView(openingUpdate().view);
const beatOf = (kind: Beat['kind'], events: GameEvent[]): Beat => ({ kind, durationMs: 1000, events, after });
const moved = (player: PlayerId, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from: 1, to: 9, cause, bounced: false, visibility: 'public' });

function shot(over: Partial<ShotInput> = {}) {
  return cameraShot({ beat: null, window: 'dice', myPick: false, me: 'p0', watch: null, piece: (id) => SPOTS[id]!, reducedMotion: false, nowMs: 0, ...over });
}

describe('camera rules (spec #2 §5.3)', () => {
  it('shows the whole board while everyone rolls, framed a little toward the start row so the dock never hides it', () => {
    expect(shot()).toMatchObject({ mode: 'overview', target: [0, 0, 4 * BOARD_SCALE], position: [0, 23 * BOARD_SCALE, 26 * BOARD_SCALE] });
  });

  it('keeps every corner of the bigger board on screen in the overview, on a landscape phone (round 5)', () => {
    const { position, target } = shot({ reducedMotion: true });
    const camera = new PerspectiveCamera(42, 844 / 390, 0.5, 200);
    camera.position.set(...position);
    camera.lookAt(new Vector3(...target));
    camera.updateMatrixWorld();
    const half = (TILE_SIZE * COLUMNS) / 2;
    for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
      const p = new Vector3(x, 0, z).project(camera);
      expect(Math.abs(p.x), `corner ${x}, ${z}`).toBeLessThan(1);
      expect(Math.abs(p.y), `corner ${x}, ${z}`).toBeLessThan(1);
    }
  });

  it('drifts gently over the overview, and holds still with reduced motion', () => {
    expect(shot({ nowMs: 4000 }).position).not.toEqual(shot({ nowMs: 0 }).position);
    expect(shot({ nowMs: 4000, reducedMotion: true }).position).toEqual(shot({ nowMs: 0, reducedMotion: true }).position);
  });

  it('follows my piece while another piece moves', () => {
    expect(shot({ beat: beatOf('move', [moved('p1')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it("watches other players' face-off when I'm not in one, from the collision to the knock-back (2026-10-15)", () => {
    const theirs = [{ challengeId: 'c1', tile: 23, players: ['p1', 'p2'] }];
    const tile = tileToWorld(23);
    expect(shot({ window: 'challenge', faceOffs: theirs }).target).toEqual(tile);
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 23, players: ['p1', 'p2'], kind: 'rps', theme: null, visibility: 'public' };
    expect(shot({ beat: beatOf('faceOff', [started]), faceOffs: theirs }).target).toEqual(tile);
    expect(shot({ beat: beatOf('faceOffResult', []), faceOffs: theirs }).target).toEqual(tile);
    // Two at once: the first. Mine: the swoop on me, as before.
    expect(shot({ window: 'challenge', faceOffs: [...theirs, { challengeId: 'c2', tile: 40, players: ['p3', 'p0'] }] }).target).toEqual(SPOTS.p0);
    expect(shot({ window: 'challenge', faceOffs: [...theirs, { challengeId: 'c2', tile: 40, players: ['p3', 'p1'] }] }).target).toEqual(tile);
  });

  it('follows my piece through a face-off window when no face-off is shown', () => {
    expect(shot({ window: 'challenge' })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it("swoops in for my own slide or launch, and follows anyone else's (2026-10-14)", () => {
    expect(shot({ beat: beatOf('slide', [moved('p0', 'snake')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('launch', [moved('p0', 'ladder')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('slide', [moved('p2', 'snake')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
    expect(shot({ beat: beatOf('launch', [moved('p3', 'ladder')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p3 });
    expect(shot({ beat: beatOf('snakeBlocked', [{ type: 'SnakeBlocked', player: 'p1', tile: 9, visibility: 'public' } as GameEvent]) })).toMatchObject({ target: SPOTS.p1 });
  });

  it("follows another player's knock-back, but stays on me when I won it (2026-10-14)", () => {
    expect(shot({ beat: beatOf('knockback', [moved('p2', 'knockback')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
    // I won: I'm standing on the tile the loser flies from.
    const won = { type: 'Moved', player: 'p2', from: 9, to: 6, cause: 'knockback', bounced: false, visibility: 'public' } as GameEvent;
    expect(shot({ beat: beatOf('knockback', [won]), piece: (id) => (id === 'p0' ? tileToWorld(9) : SPOTS[id]!) }).target).toEqual(tileToWorld(9));
  });

  it('swoops in for a face-off I am in', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p3'], kind: 'rps', theme: null, visibility: 'public' };
    expect(shot({ beat: beatOf('faceOff', [started]) }).mode).toBe('swoop');
  });

  it('holds the shot of the moment a pause follows (2026-10-14)', () => {
    const card: GameEvent = { type: 'CardResolved', caster: 'p2', cardId: 'shove', target: 'p2', result: 'hit', visibility: 'public' };
    const held = beatOf('cardResolved', [card]);
    const pause: Beat = { kind: 'pause', durationMs: 600, events: [], after, holds: held };
    expect(shot({ beat: pause })).toEqual(shot({ beat: held }));
    const roll: Beat = { kind: 'pause', durationMs: 700, events: [], after, holds: beatOf('roll', []) };
    expect(shot({ beat: roll }).mode).toBe('overview');
  });

  describe('visits each card as it resolves (2026-10-14)', () => {
    const card = (caster: PlayerId, target: PlayerId | null): GameEvent => ({ type: 'CardResolved', caster, cardId: 'shove', target, result: 'hit', visibility: 'public' });
    const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

    it("frames the caster of a card on itself, whoever's it is", () => {
      expect(shot({ beat: beatOf('cardResolved', [card('p2', 'p2')]) }).target).toEqual(SPOTS.p2);
      expect(shot({ beat: beatOf('cardResolved', [card('p3', null)]) }).target).toEqual(SPOTS.p3);
    });

    it('frames the caster and the target together, pulled back to fit both', () => {
      const near = shot({ beat: beatOf('cardResolved', [card('p1', 'p0')]) });
      expect(near.target).toEqual(mid(SPOTS.p1!, SPOTS.p0!));
      const far = shot({ beat: beatOf('cardResolved', [card('p3', 'p1')]) });
      const back = (s: { position: Vec3; target: Vec3 }) => Math.hypot(s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]);
      expect(back(far)).toBeGreaterThan(back(shot({ beat: beatOf('cardResolved', [card('p2', 'p2')]) })));
    });

    it('follows the piece a card moves', () => {
      expect(shot({ beat: beatOf('cardMove', [moved('p2', 'card')]) }).target).toEqual(SPOTS.p2);
    });

    it('cuts instead of gliding with reduced motion', () => {
      expect(shot({ beat: beatOf('cardResolved', [card('p2', 'p2')]), reducedMotion: true }).cut).toBe(true);
      expect(shot({ beat: beatOf('cardResolved', [card('p2', 'p2')]) }).cut).toBe(false);
    });
  });

  it('swoops in for my Mystery pick', () => {
    expect(shot({ window: 'mystery', myPick: true }).mode).toBe('swoop');
  });

  it('shows the whole board while I peek during my Mystery pick (2026-10-14)', () => {
    expect(shot({ window: 'mystery', myPick: true, peeking: true }).mode).toBe('overview');
  });

  it('follows the watched piece instead of mine', () => {
    expect(shot({ watch: 'p2', beat: beatOf('slide', [moved('p0', 'snake')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
  });

  it('cuts instead of swooping with reduced motion', () => {
    expect(shot({ window: 'mystery', myPick: true, reducedMotion: true })).toMatchObject({ mode: 'swoop', cut: true });
  });

  it('swoops onto my win, and follows anyone else who wins', () => {
    const won = (winner: PlayerId): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(shot({ beat: beatOf('victory', [won('p0')]) })).toMatchObject({ mode: 'swoop', target: SPOTS.p0 });
    expect(shot({ beat: beatOf('victory', [won('p3')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p3 });
  });

  it('pulls back to the overview for the ranks reveal after the winner cam (polish spec 4.5)', () => {
    const won: GameEvent = { type: 'MatchWon', winner: 'p0', rankings: [], visibility: 'public' };
    expect(shot({ beat: beatOf('ranks', [won]), window: 'none' })).toMatchObject({ mode: 'overview', target: [0, 0, 4 * BOARD_SCALE] });
  });
});
