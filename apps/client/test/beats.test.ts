import type { BoardEdit, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
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

describe('buildTimeline', () => {
  it('rolls the dice of one update together', () => {
    const roll = (player: PlayerId, face: number): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced: false, auto: true, visibility: 'public' });
    const beats = buildTimeline([roll('p0', 3), roll('p1', 6)], start(), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs, b.events.length])).toEqual([['roll', BEAT_MS.roll, 2]]);
  });

  it('lets every dice move hop together, timed by the longest', () => {
    const beats = buildTimeline([moved('p0', 0, 3), moved('p1', 0, 5)], start(), 'p0', SIZE);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.kind).toBe('move');
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
    expect(beats.map((b) => b.kind)).toEqual(['move', 'slide', 'faceOff', 'faceOffResult', 'knockback', 'slide']);
    expect(beats.map((b) => b.durationMs)).toEqual([hops(6), BEAT_MS.slide, BEAT_MS.faceOff, BEAT_MS.faceOffResult, BEAT_MS.knockback, BEAT_MS.slide]);
    expect(beats[2]!.after.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }]);
    expect(beats[3]!.after.faceOffs).toEqual([]);
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
      ['cardResolved', BEAT_MS.card.hit],
      ['cardResolved', BEAT_MS.card.blocked],
      ['cardMove', BEAT_MS.cardMove],
    ]);
    expect(beats[1]!.events[0]).toMatchObject({ caster: 'p0' });
    expect(beats[2]!.events[0]).toMatchObject({ caster: 'p1' });
  });

  it('ends a won match with the victory beat', () => {
    const rankings = [{ player: 'p0', rank: 1, position: 100 }];
    const beats = buildTimeline(
      [moved('p0', 96, 100), { type: 'RoundEnded', round: 9, visibility: 'public' }, { type: 'MatchWon', winner: 'p0', rankings, visibility: 'public' }],
      start({ p0: 96 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => b.kind)).toEqual(['move', 'info', 'victory']);
    expect(beats.at(-1)!.durationMs).toBe(BEAT_MS.victory);
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

  it('gives HUD-only events no time but still applies them', () => {
    const beats = buildTimeline(
      [
        { type: 'RoundStarted', round: 2, visibility: 'public' },
        { type: 'WindowOpened', windowId: 5, window: 'dice', players: ['p0', 'p1'], durationMs: 12_000, visibility: 'public' },
      ],
      start(),
      'p0',
      SIZE,
    );
    expect(beats).toHaveLength(1);
    expect(beats[0]).toMatchObject({ kind: 'info', durationMs: 0 });
    expect(beats[0]!.after.round).toBe(2);
  });
});
