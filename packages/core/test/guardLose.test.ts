import { describe, expect, it } from 'vitest';
import { describeCard, type CatalogCard, type EffectTemplate, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { runSettle } from '../src/engine/settle';
import { choose, makeBoard, ofType, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const GUARD: EffectTemplate = { params: { hook: 'guardTile' }, lifetime: { rounds: 5 } };
const FORWARD: EffectTemplate = { params: { hook: 'loseForward' }, lifetime: { charges: 1 } };
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'test', owner);
const card = (t: EffectTemplate): CatalogCard => ({ id: 'x', name: 'x', type: 'defense', rarity: 'common', weight: 1, target: SELF, effects: [{ op: 'addEffect', template: t }] });
/** Settle a step where `movers` just arrived where they stand. */
function settle(s: MatchState, movers: string[]): { result: string; ev: GameEvent[] } {
  const ev: GameEvent[] = [];
  s.phase = { kind: 'settle', ctx: { movers: movers.map((player) => ({ player, cause: 'dice' as const })), wave: 0, challenges: [] }, after: 'mysteryDetect' };
  return { result: runSettle(s, ev), ev };
}

describe('guarding your tile (2026-10-16)', () => {
  it('knocks back whoever lands on the guard, with no face-off', () => {
    const s = setup({ players: 2, positions: [20, 20] });
    put(s, 'p1', GUARD);
    const { result, ev } = settle(s, ['p2']);
    expect(result).toBe('done');
    expect(positions(s)).toEqual([20, 17]);
    expect(ofType(ev, 'TileGuarded')).toMatchObject([{ tile: 20, guard: 'p1', knocked: ['p2'] }]);
    expect(ofType(ev, 'ChallengeStarted')).toEqual([]);
  });

  it("is an ordinary face-off when the guard lands on someone else's tile", () => {
    const s = setup({ players: 2, positions: [20, 20] });
    put(s, 'p1', GUARD);
    const { result, ev } = settle(s, ['p1']);
    expect(result).toBe('waiting');
    expect(ofType(ev, 'ChallengeStarted')).toHaveLength(1);
  });
});

describe('losing a face-off forward (2026-10-16)', () => {
  it('moves the loser forward instead of back, once', () => {
    const s = play(setup({ dice: [[5, 5], [5, 5]] }), [roll('p1'), roll('p2')]).state;
    put(s, 'p2', FORWARD);
    const first = play(s, [choose('p1', 'rock'), choose('p2', 'scissors')]).state;
    expect(positions(first)).toEqual([5, 8]);
    expect(first.effects).toEqual([]);
  });

  it("moves only its owner forward, through a chain of face-offs (the user's report, 2026-10-16)", () => {
    // I (p1) have Sore Loser and share tile 10 with p2; p3 stands on 13. No rockets or whirlpools anywhere.
    const s = setup({ players: 3, positions: [10, 10, 13], board: makeBoard(100) });
    put(s, 'p1', FORWARD);
    settle(s, ['p1']);
    // I lose to p2: forward 3 instead, onto p3's tile; I lose to p3: back 3, onto p2 again; I win this time.
    const { state, events } = play(s, [choose('p1', 'rock'), choose('p2', 'paper'), choose('p1', 'rock'), choose('p3', 'paper'), choose('p1', 'paper'), choose('p2', 'rock')]);
    expect(ofType(events, 'Moved').map((e) => [e.player, e.from, e.to])).toEqual([['p1', 10, 13], ['p1', 13, 10], ['p2', 10, 7]]);
    expect(positions(state)).toEqual([10, 7, 13]);
  });

  it('writes the texts', () => {
    expect(describeCard(card(GUARD))).toBe('For 5 rounds: anyone who lands on your tile is knocked back, as if they lost a face-off.');
    expect(describeCard(card(FORWARD))).toBe('Next time you lose a face-off, move forward instead of back.');
  });
});
