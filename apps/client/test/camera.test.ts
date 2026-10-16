import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { DEFAULT_TUNING } from '../src/app/tuning';
import { HOME_MS, cameraShot, heldNext, homeShown, myPickPending, type ShotInput } from '../src/scene/camera';
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
    const { overview } = DEFAULT_TUNING.camera;
    expect(shot()).toMatchObject({ mode: 'overview', target: [0, 0, 4 * BOARD_SCALE], position: [0, overview.height, overview.distance + 4 * BOARD_SCALE] });
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

  it('sits about 15% closer than before (2026-10-15), and zooms by the wheel or pinch setting', () => {
    const near = shot({ reducedMotion: true });
    const back = (sh: { position: Vec3; target: Vec3 }) => Math.hypot(sh.position[0] - sh.target[0], sh.position[1] - sh.target[1], sh.position[2] - sh.target[2]);
    const before = Math.hypot(22 * BOARD_SCALE - 4 * BOARD_SCALE + 4 * BOARD_SCALE, 23 * BOARD_SCALE);
    expect(back(near)).toBeLessThan(before * 0.9);
    expect(back(shot({ reducedMotion: true, zoom: 0.5 }))).toBeCloseTo(back(near) * 0.5, 5);
    // Only the overview zooms.
    expect(shot({ beat: beatOf('move', [moved('p0')]), zoom: 0.5 })).toEqual(shot({ beat: beatOf('move', [moved('p0')]) }));
  });

  it('never turns: the overview stays square to the board, whatever the time (board theme spec B5)', () => {
    for (const nowMs of [0, 2250, 4500, 9000, 14_000]) {
      const { position, target } = shot({ nowMs });
      expect(position[0]).toBe(target[0]);
    }
  });

  it('moves the overview by the pan, camera and aim together, and only the overview (board theme spec B5)', () => {
    const still = shot({ zoom: 0.5 });
    const panned = shot({ zoom: 0.5, pan: [3, -4] });
    expect(panned.target).toEqual([still.target[0] + 3, 0, still.target[2] - 4]);
    expect(panned.position).toEqual([still.position[0] + 3, still.position[1], still.position[2] - 4]);
    expect(shot({ beat: beatOf('move', [moved('p0')]), pan: [3, -4] })).toEqual(shot({ beat: beatOf('move', [moved('p0')]) }));
  });

  it('follows my piece while I move with everyone, and shows the overview while only others move (2026-10-15)', () => {
    expect(shot({ beat: beatOf('move', [moved('p0'), moved('p1')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
    expect(shot({ beat: beatOf('move', [moved('p1')]) }).mode).toBe('overview');
  });

  it('stays on the last event through a beat with nothing to show, instead of snapping back to me (2026-10-15)', () => {
    const clash = beatOf('clash', []);
    expect(shot({ beat: clash, held: { player: 'p2' } })).toMatchObject({ mode: 'follow', target: SPOTS.p2, focus: { player: 'p2' } });
    expect(shot({ beat: clash, held: { tile: 23 } }).target).toEqual(tileToWorld(23));
    expect(shot({ beat: clash }).mode).toBe('overview');
  });

  it('stays on the last event while someone picks a card after a face-off, instead of the overview (2026-10-15)', () => {
    expect(shot({ beat: null, window: 'mystery', held: { tile: 23 } }).target).toEqual(tileToWorld(23));
    expect(shot({ beat: null, window: 'mystery', held: { player: 'p2' } }).target).toEqual(SPOTS.p2);
    // Nothing was on: the whole board.
    expect(shot({ beat: null, window: 'mystery' }).mode).toBe('overview');
    // The rig keeps what the camera was on through the card picks, and lets go when the window moves on.
    expect(heldNext({ beat: null, window: 'mystery', focus: null, held: { tile: 23 } })).toEqual({ tile: 23 });
    expect(heldNext({ beat: null, window: 'dice', focus: null, held: { tile: 23 } })).toBeNull();
    expect(heldNext({ beat: beatOf('slide', [moved('p2', 'snake')]), window: 'dice', focus: { player: 'p2' }, held: { tile: 23 } })).toEqual({ player: 'p2' });
    expect(heldNext({ beat: beatOf('clash', []), window: 'dice', focus: null, held: { tile: 23 } })).toEqual({ tile: 23 });
  });

  it('stays on me after my card pick, not on the event before it (2026-10-16)', () => {
    // Juno (p2) launched, then my pick opens: the camera swoops to me and remembers it.
    let held = heldNext({ beat: null, window: 'mystery', focus: { player: 'p2' }, held: null });
    const picking = shot({ window: 'mystery', myPick: true, held });
    held = heldNext({ beat: null, window: 'mystery', focus: picking.focus, held });
    // I've picked; the others are still picking.
    const waiting = shot({ window: 'mystery', myPick: false, held });
    expect(waiting.target).toEqual(SPOTS.p0);
  });

  it("stays on the piece a card moved through the card's pause, not back on its caster (2026-10-16)", () => {
    const card = beatOf('cardResolved', [{ type: 'CardResolved', caster: 'p1', cardId: 'long-shot', target: 'p2', result: 'hit', roll: 4, visibility: 'public' }]);
    const move = beatOf('cardMove', [moved('p2', 'card')]);
    const pause: Beat = { kind: 'pause', durationMs: 600, events: [], after, holds: card, lastMoment: move };
    expect(shot({ beat: pause }).target).toEqual(SPOTS.p2);
  });

  it('shows the whole board when a card moves several players (2026-10-16)', () => {
    expect(shot({ beat: beatOf('cardMove', [moved('p1', 'card'), moved('p2', 'card'), moved('p0', 'card')]) }).mode).toBe('overview');
  });

  it('goes back to the overview when the timeline is over, not to me (2026-10-15)', () => {
    expect(shot({ beat: null, held: { player: 'p2' } }).mode).toBe('overview');
    expect(shot({ beat: null, window: 'none' }).mode).toBe('overview');
  });

  it("stays on me through other players' jumps when I jump in the same round (2026-10-15)", () => {
    const mine = beatOf('launch', [moved('p0', 'ladder')]);
    const theirs = beatOf('slide', [moved('p2', 'snake')]);
    // Their slide after my launch, and before it.
    expect(shot({ beat: theirs, timeline: { beats: [mine, theirs], index: 1 } }).target).toEqual(SPOTS.p0);
    expect(shot({ beat: theirs, timeline: { beats: [theirs, mine], index: 0 } }).target).toEqual(SPOTS.p0);
    // Without a jump of mine in the round, the camera follows theirs.
    expect(shot({ beat: theirs, timeline: { beats: [theirs], index: 0 } }).target).toEqual(SPOTS.p2);
    // A card's moves are another moment: my jump before a card doesn't hold the camera through it.
    const reveal = beatOf('cardResolved', [{ type: 'CardResolved', caster: 'p2', cardId: 'shove', target: 'p2', result: 'hit', visibility: 'public' }]);
    expect(shot({ beat: theirs, timeline: { beats: [mine, reveal, theirs], index: 2 } }).target).toEqual(SPOTS.p2);
  });

  it('keeps every close shot at one distance, the winner cam included (2026-10-15)', () => {
    const { close } = DEFAULT_TUNING.camera;
    const distance = Math.hypot(close.height, close.back);
    const back = (s: { position: Vec3; target: Vec3 }) => Math.hypot(s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]);
    const won = (winner: PlayerId): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    const card: GameEvent = { type: 'CardResolved', caster: 'p2', cardId: 'shove', target: 'p2', result: 'hit', visibility: 'public' };
    for (const s of [
      shot({ beat: beatOf('slide', [moved('p0', 'snake')]) }),
      shot({ beat: beatOf('slide', [moved('p2', 'snake')]) }),
      shot({ beat: beatOf('victory', [won('p0')]) }),
      shot({ beat: beatOf('victory', [won('p3')]) }),
      shot({ beat: beatOf('cardResolved', [card]) }),
    ])
      expect(back(s)).toBeCloseTo(distance, 5);
    // Further than the old swoop (3.4 up, 4.6 back), which put the winner too close.
    expect(distance).toBeGreaterThan(Math.hypot(3.4, 4.6) * 1.4);
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
    // The first decided, waiting for the second: on to the second (2026-10-15).
    const firstDone = [{ ...theirs[0]!, decided: true }, { challengeId: 'c2', tile: 40, players: ['p3', 'p1'] }];
    expect(shot({ window: 'challenge', faceOffs: firstDone }).target).toEqual(tileToWorld(40));
    // ...but only after its own result beat, which stays on it.
    const won: GameEvent = { type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p1: 'rock', p2: 'paper' }, winner: 'p2', losers: ['p1'], outcome: 'win', visibility: 'public' };
    expect(shot({ beat: beatOf('faceOffResult', [won]), faceOffs: firstDone }).target).toEqual(tile);
  });

  it('shows the overview in a face-off window when no face-off is shown (2026-10-15)', () => {
    expect(shot({ window: 'challenge' }).mode).toBe('overview');
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

    it('glides with reduced motion too, never cutting (2026-10-15: reduce, not remove)', () => {
      expect(shot({ beat: beatOf('cardResolved', [card('p2', 'p2')]), reducedMotion: true }).cut).toBe(false);
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

  it('still swoops with reduced motion, gliding (2026-10-15)', () => {
    expect(shot({ window: 'mystery', myPick: true, reducedMotion: true })).toMatchObject({ mode: 'swoop', cut: false });
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

describe('camera fixes (2026-10-17)', () => {
  it('lets go of the last focus at the Break, so the next round starts on the overview', () => {
    const roundBreak = beatOf('roundBreak', []);
    expect(heldNext({ beat: roundBreak, window: 'dice', focus: null, held: { player: 'p2' } })).toBeNull();
    expect(heldNext({ beat: beatOf('ranks', []), window: 'none', focus: null, held: { player: 'p2' } })).toBeNull();
    // The next round's rolls, with nothing held: the whole board.
    expect(shot({ beat: beatOf('roll', []), held: null }).mode).toBe('overview');
  });

  it('shows the whole board for a card that hits several players', () => {
    const quake = beatOf('cardResolved', [{ type: 'CardResolved', caster: 'p1', cardId: 'earthquake', target: null, result: 'hit', targets: ['p0', 'p2', 'p3'], blocked: [], visibility: 'public' }]);
    expect(shot({ beat: quake }).mode).toBe('overview');
    // One target in the list is still a close shot.
    const one = beatOf('cardResolved', [{ type: 'CardResolved', caster: 'p1', cardId: 'earthquake', target: null, result: 'hit', targets: ['p2'], blocked: [], visibility: 'public' }]);
    expect(shot({ beat: one }).mode).toBe('follow');
  });

  it('goes to my piece for a moment after Back to my piece, wherever it stands, even mid-card', () => {
    const card = beatOf('cardResolved', [{ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'hit', visibility: 'public' }]);
    expect(shot({ home: true, beat: card })).toMatchObject({ mode: 'follow', target: SPOTS.p0, focus: { player: 'p0' } });
    expect(shot({ home: true }).target).toEqual(SPOTS.p0);
    // Pressed during the Break, too.
    expect(shot({ home: true, beat: beatOf('roundBreak', []) }).target).toEqual(SPOTS.p0);
    expect(homeShown(1000, 1000 + HOME_MS - 1)).toBe(true);
    expect(homeShown(1000, 1000 + HOME_MS)).toBe(false);
    expect(homeShown(null, 1000)).toBe(false);
    expect(HOME_MS).toBeGreaterThanOrEqual(1500);
  });

  it('goes to the tile a card puts a rocket or whirlpool on, or takes one off', () => {
    const edited = (added: { from: number; to: number }[], removed: { from: number; to: number }[] = []) =>
      beatOf('boardEdit', [{ type: 'BoardEdited', edit: { id: 'x', added: added.map((j, i) => ({ id: `a${i}`, ...j })), removed: removed.map((j, i) => ({ id: `r${i}`, ...j })), lifetime: { rounds: 2 }, createdRound: 1, sourceCard: 'c', sourcePlayer: 'p1' }, visibility: 'public' }]);
    expect(shot({ beat: edited([{ from: 50, to: 71 }]) })).toMatchObject({ mode: 'follow', target: tileToWorld(50), focus: { tile: 50 } });
    expect(shot({ beat: edited([], [{ from: 64, to: 30 }]) })).toMatchObject({ target: tileToWorld(64), focus: { tile: 64 } });
    // A card that changes several at once: the whole board.
    expect(shot({ beat: edited([{ from: 50, to: 71 }, { from: 80, to: 20 }]) }).mode).toBe('overview');
  });
});

describe('my Mystery pick (2026-10-15)', () => {
  it('waits on my pick while my offer is open, and stops as soon as I pick, before the view catches up', () => {
    const open = { picked: null };
    expect(myPickPending(open, 7, null)).toBe(true);
    expect(myPickPending(open, 7, 7)).toBe(false);
    expect(myPickPending(open, 8, 7)).toBe(true);
    expect(myPickPending({ picked: 0 }, 7, null)).toBe(false);
    expect(myPickPending(null, 7, null)).toBe(false);
  });
});
