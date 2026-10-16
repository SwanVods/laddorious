import type { BoardEdit, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline, heldBeat } from '../src/director/beats';
import { BANNER_MS } from '../src/hud/Banner';
import { presentationFromView, stackOn, type PresentationState } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

/** Round 1 of the fixture's board, with some pieces moved. */
function start(positions: Record<PlayerId, number> = {}): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, ...positions } };
}

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice', bounced = false): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced, visibility: 'public' };
}

const hops = (tiles: number) => tiles * BEAT_MS.hopPerTile + BEAT_MS.landing;

/** What ends every real update: the round's bookkeeping and the next window opening (no time of their own). */
const roundOver: GameEvent[] = [
  { type: 'RoundEnded', round: 1, visibility: 'public' },
  { type: 'RoundStarted', round: 2, visibility: 'public' },
  { type: 'WindowOpened', windowId: 9, window: 'dice', players: ['p0', 'p1'], durationMs: 12_000, visibility: 'public' },
] as GameEvent[];

describe('the end hold, before the round moves on (2026-10-16: it never showed in a real match)', () => {
  const kinds = (events: GameEvent[], from = start()) => buildTimeline(events, from, 'p0', SIZE).map((b) => [b.kind, b.durationMs]);

  it('holds the last move of a round, with the round bookkeeping after it', () => {
    expect(kinds([moved('p0', 0, 3), moved('p1', 0, 5), ...roundOver])).toEqual([
      ['move', hops(5)],
      ['pause', BEAT_MS.endHold],
      ['info', 0],
      ['roundBreak', BEAT_MS.roundBreak], // then the break between rounds (2026-10-16)
      ['info', 0],
    ]);
  });

  it('holds the end of a face-off the same way', () => {
    const events: GameEvent[] = [
      { type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' },
      moved('p0', 6, 3, 'knockback'),
      ...roundOver,
    ];
    expect(kinds(events, start({ p0: 6, p1: 6 })).slice(-4)).toEqual([
      ['pause', BEAT_MS.endHold],
      ['info', 0],
      ['roundBreak', BEAT_MS.roundBreak],
      ['info', 0],
    ]);
  });
});

describe('buildTimeline', () => {
  it('rolls the dice of one update together', () => {
    const roll = (player: PlayerId, face: number): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced: false, auto: true, visibility: 'public' });
    const beats = buildTimeline([roll('p0', 3), roll('p1', 6)], start(), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs, b.events.length])).toEqual([['roll', BEAT_MS.roll, 2]]);
  });

  it('lets every dice move hop together, timed by the longest', () => {
    const beats = buildTimeline([moved('p0', 0, 3), moved('p1', 0, 5)], start(), 'p0', SIZE);
    expect(beats.map((b) => b.kind)).toEqual(['move', 'pause']); // and the end hold (2026-10-15)
    expect(beats[0]!.durationMs).toBe(hops(5));
    expect(beats[0]!.after.positions).toMatchObject({ p0: 3, p1: 5 });
  });

  it('times a bounce as the way up to the last tile and back', () => {
    const beats = buildTimeline([moved('p0', 97, 98, 'dice', true)], start({ p0: 97 }), 'p0', SIZE);
    expect(beats[0]!.durationMs).toBe(hops(3 + 2));
  });

  it('plays the chain dice move, slide, face-off, knockback and second slide as separate beats', () => {
    const chain: GameEvent[] = [
      moved('p0', 10, 16),
      moved('p0', 16, 6, 'snake'),
      { type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' },
      { type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' },
      moved('p0', 6, 3, 'knockback'),
      moved('p0', 3, 1, 'snake'),
    ];
    const beats = buildTimeline(chain, start({ p0: 10, p1: 6 }), 'p0', SIZE);
    expect(beats.map((b) => b.kind)).toEqual(['move', 'slide', 'faceOff', 'faceOffResult', 'knockback', 'slide', 'pause']);
    // My own face-off: the intro holds for its banner, and the result first shows the picks (2026-10-14).
    expect(beats.map((b) => b.durationMs)).toEqual([hops(6), BEAT_MS.slide, BEAT_MS.faceOffIntro, BEAT_MS.faceOffReveal + BEAT_MS.faceOffBanner, BEAT_MS.knockback + BEAT_MS.knockbackLand + BEAT_MS.knockbackSettle, BEAT_MS.slide, BEAT_MS.endHold]);
    // My result lasts until its banner is gone, so a draw's re-pick popup never opens under DRAW!
    expect(beats[3]!.durationMs).toBeGreaterThanOrEqual(BEAT_MS.faceOffReveal + BANNER_MS);
    const watching = buildTimeline(chain, start({ p0: 10, p1: 6 }), 'p2', SIZE);
    expect(watching.map((b) => b.durationMs).slice(2, 4)).toEqual([BEAT_MS.faceOff, BEAT_MS.faceOffResult]);
    expect(beats[2]!.after.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'], decided: false }]);
    // The face-off holds through the result and ends with the knock-back (2026-10-14).
    expect(beats[3]!.after.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'], decided: true }]);
    expect(beats[4]!.after.faceOffs).toEqual([]);
    expect(beats[5]!.after.positions.p0).toBe(1);
  });

  it('starts a new beat when a piece moves twice, and lets different pieces slide together', () => {
    const beats = buildTimeline(
      [moved('p0', 4, 14, 'ladder'), moved('p0', 14, 31, 'ladder'), moved('p1', 20, 2, 'snake'), moved('p2', 40, 22, 'snake')],
      start({ p0: 4, p1: 20, p2: 40 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => [b.kind, b.events.length])).toEqual([
      ['launch', 1],
      ['launch', 1],
      ['slide', 2],
      ['pause', 0],
    ]);
  });

  it('stacks a piece that lands on an occupied tile on top', () => {
    const [beat] = buildTimeline([moved('p0', 1, 4)], start({ p0: 1, p1: 4 }), 'p0', SIZE);
    expect(stackOn(beat!.after, 4)).toEqual(['p1', 'p0']);
  });

  it('shows a blocked snake as its own beat and leaves the piece on the snake head', () => {
    const beats = buildTimeline(
      [
        moved('p0', 10, 16),
        { type: 'SnakeBlocked', player: 'p0', tile: 16, effectId: 'e5', visibility: 'public' },
        { type: 'EffectRemoved', effectId: 'e5', owner: 'p0', reason: 'charges', visibility: 'public' },
      ],
      start({ p0: 10 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['move', hops(6)],
      ['snakeBlocked', BEAT_MS.snakeBlocked],
      ['pause', BEAT_MS.endHold], // the end hold, before the bookkeeping (2026-10-16)
      ['info', 0],
    ]);
    expect(beats[2]!.after.positions.p0).toBe(16);
  });

  it("keeps a private event for its owner and drops another player's", () => {
    const offer = (player: PlayerId): GameEvent => ({ type: 'MysteryOffered', player, tile: 23, rarity: 'common', cards: ['sprint', 'shove', 'cleanse'], visibility: { private: player } });
    const beats = buildTimeline([offer('p0'), offer('p1')], start(), 'p0', SIZE);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.events).toEqual([offer('p0')]);
  });

  it('reveals the picked cards together, gives each card its own beat in order, then moves the targets', () => {
    const events: GameEvent[] = [
      { type: 'CardSelected', player: 'p0', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false, visibility: 'public' },
      { type: 'CardSelected', player: 'p1', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: true, visibility: 'public' },
      { type: 'CardResolved', caster: 'p0', cardId: 'sprint', target: 'p0', result: 'hit', visibility: 'public' },
      { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'blocked', visibility: 'public' },
      moved('p0', 20, 23, 'card'),
    ];
    const beats = buildTimeline(events, start({ p0: 20 }), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['cardReveal', BEAT_MS.cardReveal],
      ['cardResolved', BEAT_MS.cardLead + BEAT_MS.card.hit],
      ['pause', BEAT_MS.cardPause],
      ['cardResolved', BEAT_MS.cardLead + BEAT_MS.card.blocked],
      ['cardMove', BEAT_MS.cardMove],
      ['pause', BEAT_MS.endHold], // the last card's pause is the end hold, at least a second (2026-10-15)
    ]);
    expect(beats[1]!.events[0]).toMatchObject({ caster: 'p0' });
    expect(beats[3]!.events[0]).toMatchObject({ caster: 'p1' });
  });

  it('plays each card and the move it makes before the next card (2026-10-14)', () => {
    const events: GameEvent[] = [
      { type: 'CardResolved', caster: 'p1', cardId: 'sprint', target: 'p1', result: 'hit', visibility: 'public' },
      moved('p1', 10, 13, 'card'),
      { type: 'CardResolved', caster: 'p0', cardId: 'sprint', target: 'p0', result: 'hit', visibility: 'public' },
      moved('p0', 20, 23, 'card'),
    ];
    const beats = buildTimeline(events, start({ p0: 20, p1: 10 }), 'p0', SIZE);
    expect(beats.map((b) => b.kind)).toEqual(['cardResolved', 'cardMove', 'pause', 'cardResolved', 'cardMove', 'pause']);
    // Each pause holds the card it follows, so the camera and the HUD stay on it (2026-10-14).
    expect(heldBeat(beats[2]!)).toBe(beats[0]);
    expect(heldBeat(beats[5]!)).toBe(beats[3]);
    expect(heldBeat(beats[1]!)).toBe(beats[1]);
    // The camera stays on the card's last moment through its pause, not back on the card (2026-10-16).
    expect(beats[2]!.lastMoment).toBe(beats[1]);
    expect(beats[5]!.lastMoment).toBe(beats[4]);
    expect(BEAT_MS.cardLead).toBeGreaterThanOrEqual(400);
  });

  it('pauses with the dice showing after the last roll, before the pieces move (2026-10-14)', () => {
    const rolled: GameEvent = { type: 'DieRolled', player: 'p0', natural: 3, face: 3, forced: false, auto: false, visibility: 'public' };
    const beats = buildTimeline([rolled, moved('p0', 2, 5)], start({ p0: 2 }), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['roll', beats[0]!.durationMs],
      ['pause', BEAT_MS.rollPause],
      ['move', hops(3)],
      ['pause', BEAT_MS.endHold],
    ]);
    expect(heldBeat(beats[1]!)).toBe(beats[0]);
    expect(beats[1]!.after).toBe(beats[0]!.after);
  });

  it('ends a won match with the victory beat', () => {
    const rankings = [{ player: 'p0', rank: 1, position: 100 }];
    const beats = buildTimeline(
      [moved('p0', 96, 100), { type: 'RoundEnded', round: 9, visibility: 'public' }, { type: 'MatchWon', winner: 'p0', rankings, visibility: 'public' }],
      start({ p0: 96 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => b.kind)).toEqual(['move', 'info', 'victory', 'ranks']);
    expect(beats[2]!.durationMs).toBe(BEAT_MS.victory);
  });

  it('follows the victory with the ranks reveal, one step per distinct place behind the winner (polish spec 4.5)', () => {
    const rankings = [
      { player: 'p0', rank: 1, position: 100 },
      { player: 'p1', rank: 2, position: 80 },
      { player: 'p2', rank: 2, position: 80 },
      { player: 'p3', rank: 4, position: 12 },
    ];
    const won: GameEvent = { type: 'MatchWon', winner: 'p0', rankings, visibility: 'public' };
    const beats = buildTimeline([moved('p0', 96, 100), won], start({ p0: 96, p1: 80, p2: 80, p3: 12 }), 'p0', SIZE);
    const [victory, ranks] = beats.slice(-2);
    expect(ranks).toMatchObject({ kind: 'ranks', events: [won], durationMs: 2 * BEAT_MS.rankStep + BEAT_MS.rankHold });
    expect(ranks!.after).toBe(victory!.after);
  });

  it('adds a board edit, then reverts it when it expires', () => {
    const base = start();
    const removed = base.jumps[0]!;
    const added = { id: 'x9a', from: 50, to: 71 };
    const edit: BoardEdit = { id: 'x9', added: [added], removed: [removed], lifetime: { rounds: 2 }, createdRound: 1, sourceCard: 'ladder-warp', sourcePlayer: 'p0' };
    const [made] = buildTimeline([{ type: 'BoardEdited', edit, visibility: 'public' }], base, 'p0', SIZE);
    expect(made!.kind).toBe('boardEdit');
    expect(made!.durationMs).toBe(BEAT_MS.boardEdit);
    expect(made!.after.jumps).toContainEqual(added);
    expect(made!.after.jumps).not.toContainEqual(removed);
    const [expired] = buildTimeline([{ type: 'BoardEditExpired', editId: 'x9', restored: [removed.id], dropped: [], visibility: 'public' }], made!.after, 'p0', SIZE);
    expect(expired!.after.jumps).toContainEqual(removed);
    expect(expired!.after.jumps).not.toContainEqual(added);
    expect(expired!.after.boardEdits).toEqual([]);
  });

  it('gives HUD-only events no time but still applies them; a new round gets its break first (2026-10-16)', () => {
    const beats = buildTimeline(
      [
        { type: 'RoundStarted', round: 2, visibility: 'public' },
        { type: 'WindowOpened', windowId: 5, window: 'dice', players: ['p0', 'p1'], durationMs: 12_000, visibility: 'public' },
      ],
      start(),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['roundBreak', BEAT_MS.roundBreak],
      ['info', 0],
    ]);
    expect(beats[1]!.after.round).toBe(2);
  });

  it('stacks pieces that reach one tile in the same beat in the order they land, the first at the bottom (2026-10-15)', () => {
    // p1's move comes first in the engine's order, but p2 lands first: it has fewer tiles to hop.
    const beats = buildTimeline([moved('p1', 96, 99), moved('p2', 97, 99)], start({ p1: 96, p2: 97 }), 'p0', SIZE);
    expect(stackOn(beats[0]!.after, 99)).toEqual(['p2', 'p1']);
  });

  it('holds the last moment for a second before the camera goes back to the overview (2026-10-15)', () => {
    const beats = buildTimeline([moved('p0', 0, 3), moved('p1', 3, 30, 'ladder')], start({ p1: 0 }), 'p0', SIZE);
    const last = beats.at(-1)!;
    expect(last.kind).toBe('pause');
    expect(last.durationMs).toBe(BEAT_MS.endHold);
    expect(heldBeat(last).kind).toBe('launch');
    expect(BEAT_MS.endHold).toBe(1000);
    // A timeline of only rolls has nothing to hold.
    const roll: GameEvent = { type: 'DieRolled', player: 'p0', natural: 3, face: 3, forced: false, auto: true, visibility: 'public' };
    expect(buildTimeline([roll], start(), 'p0', SIZE).at(-1)!.kind).toBe('roll');
  });
});
