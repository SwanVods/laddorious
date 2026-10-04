import { describe, expect, it } from 'vitest';
import { InvariantError, awaiting, step, type EffectTemplate, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { choose, makeBoard, ofType, play, positions, roll, setup, timeout } from './support/fixtures';

function withEffect(s: MatchState, owner: string, template: EffectTemplate): MatchState {
  addEffect(s, [], owner, template, 'test', owner);
  return s;
}

describe('snakes and ladders', () => {
  it('ladders lift and snakes drop players after movement', () => {
    const board = makeBoard(100, [[3, 22], [5, 1]]);
    const { state, events } = play(setup({ board, dice: [[3], [5]] }), [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([22, 1]);
    expect(ofType(events, 'Moved').map((e) => e.cause)).toEqual(['dice', 'dice', 'ladder', 'snake']);
  });

  it('follows chains created by card edits', () => {
    const board = makeBoard(100, [[3, 22], [22, 40]]);
    expect(positions(play(setup({ board, dice: [[3], [1]] }), [roll('p1'), roll('p2')]).state)).toEqual([40, 1]);
  });

  it('a snake shield cancels the snake and spends its charge', () => {
    const board = makeBoard(100, [[5, 1]]);
    const s = withEffect(setup({ board, dice: [[5], [2]] }), 'p1', { params: { hook: 'beforeSnake' }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([5, 2]);
    expect(ofType(events, 'SnakeBlocked')).toMatchObject([{ player: 'p1', tile: 5 }]);
    expect(state.effects).toHaveLength(0);
  });

  it('afterMove conditionals fire after the slide (Snake Bait)', () => {
    const board = makeBoard(100, [[5, 1]]);
    const s = withEffect(setup({ board, dice: [[5], [2]] }), 'p1', {
      params: { hook: 'afterMove', cause: 'dice', condition: 'landedOnSnakeHead', amount: 8 },
      lifetime: { charges: 1 },
    });
    const { state } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([9, 2]); // 5 → snake to 1 → +8
    expect(state.effects).toHaveLength(0);
  });
});

describe('runaway protection (review I3)', () => {
  it('a self-retriggering afterMove chain throws InvariantError instead of looping', () => {
    // 45 → 50 (snake → 40) → +10 → 50 (snake → 40) → +10 … driven by an 'effect'-keyed conditional.
    const board = makeBoard(100, [[50, 40]]);
    let s = setup({ board, positions: [45, 0], dice: [[5], [1]] });
    s = withEffect(s, 'p1', { params: { hook: 'afterMove', cause: 'dice', condition: 'landedOnSnakeHead', amount: 10 }, lifetime: { charges: 1 } });
    s = withEffect(s, 'p1', { params: { hook: 'afterMove', cause: 'effect', condition: 'landedOnSnakeHead', amount: 10 }, lifetime: { charges: 100_000 } });
    expect(() => play(s, [roll('p1'), roll('p2')])).toThrow(InvariantError);
  });
});

describe('collisions', () => {
  it('two players on one tile play RPS; the loser moves back 3', () => {
    const s = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2')]).state;
    expect(awaiting(s)).toMatchObject({ window: 'challenge', players: ['p1', 'p2'], durationMs: 8_000 });
    const { state, events } = play(s, [choose('p1', 'rock'), choose('p2', 'scissors')]);
    expect(positions(state)).toEqual([5, 2]);
    expect(ofType(events, 'ChallengeResolved')).toMatchObject([{ winner: 'p1', losers: ['p2'], outcome: 'win', picks: { p1: 'rock', p2: 'scissors' } }]);
    expect(state.round).toBe(2);
  });

  it('a tie replays in a fresh window', () => {
    const s = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2'), choose('p1', 'rock'), choose('p2', 'rock')]).state;
    expect(s.phase.kind).toBe('settle');
    const first = s.windowId;
    expect(awaiting(s).players).toEqual(['p1', 'p2']);
    const { state } = play(s, [choose('p1', 'paper'), choose('p2', 'rock')]);
    expect(state.windowId).toBeGreaterThan(first);
    expect(positions(state)).toEqual([5, 2]);
  });

  it('a player who does not pick before the window closes loses', () => {
    const { state } = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2'), choose('p2', 'rock'), timeout]);
    expect(positions(state)).toEqual([2, 5]);
  });

  it('three players on one tile play Minority', () => {
    const s = play(setup({ players: 3, dice: [[4], [4], [4]], misc: [1] }), [roll('p1'), roll('p2'), roll('p3')]).state;
    expect(s.phase.kind === 'settle' && s.phase.ctx.challenges[0]).toMatchObject({ kind: 'minority', theme: ['Sun', 'Moon'] });
    const { state } = play(s, [choose('p1', 'A'), choose('p2', 'B'), choose('p3', 'A')]);
    expect(positions(state)).toEqual([1, 4, 1]);
  });

  it('knockback applies snakes and can start a chain reaction (second wave)', () => {
    // p1 and p2 collide on 10. Loser goes back to 7, a snake head to 4 where p3 stands.
    const board = makeBoard(100, [[7, 4]]);
    const s = setup({ players: 3, board, positions: [5, 6, 0], dice: [[5], [4], [4]] });
    const afterDice = play(s, [roll('p1'), roll('p2'), roll('p3')]).state;
    expect(positions(afterDice)).toEqual([10, 10, 4]);
    const wave2 = play(afterDice, [choose('p1', 'rock'), choose('p2', 'scissors')]).state;
    expect(positions(wave2)).toEqual([10, 4, 4]);
    expect(wave2.phase.kind === 'settle' && wave2.phase.ctx.wave).toBe(2);
    const { state } = play(wave2, [choose('p2', 'paper'), choose('p3', 'rock')]);
    expect(positions(state)).toEqual([10, 4, 1]);
  });

  it('nobody collides on tile 0', () => {
    const board = makeBoard(100);
    const { state } = play(setup({ players: 3, board, positions: [2, 0, 0], dice: [[1], [3], [5]] }), [roll('p1'), roll('p2'), roll('p3')]);
    expect(positions(state)).toEqual([3, 3, 5]);
    expect(state.phase.kind).toBe('settle'); // p1 and p2 share tile 3
    const end = play(state, [choose('p1', 'rock'), choose('p2', 'paper')]).state;
    expect(positions(end)).toEqual([0, 3, 5]);
    expect(end.phase.kind).toBe('dice');
  });

  it('the safety cap steps arrivals back to the nearest free tile after maxWaves', () => {
    // maxWaves 1: the first wave's loser lands on an occupied tile, which is not fought.
    const s = setup({ players: 3, positions: [5, 6, 1], dice: [[5], [4], [6]], config: { collision: { maxWaves: 1 } } });
    const afterDice = play(s, [roll('p1'), roll('p2'), roll('p3')]).state;
    expect(positions(afterDice)).toEqual([10, 10, 7]);
    const { state, events } = play(afterDice, [choose('p1', 'rock'), choose('p2', 'scissors')]);
    expect(ofType(events, 'SafetyCapApplied')).toMatchObject([{ tile: 7, steppedBack: ['p2'] }]);
    expect(positions(state)).toEqual([10, 6, 7]);
  });

  it('two players reaching N fight a final-tile showdown (D5)', () => {
    const s = play(setup({ positions: [96, 97], dice: [[4], [3]] }), [roll('p1'), roll('p2')]).state;
    expect(positions(s)).toEqual([100, 100]);
    const { state } = play(s, [choose('p1', 'scissors'), choose('p2', 'rock')]);
    expect(positions(state)).toEqual([97, 100]);
    expect(state.phase).toMatchObject({ kind: 'finished', winner: 'p2' });
  });

  it('rejects picks for unknown challenges and invalid choices', () => {
    const s = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2')]).state;
    expect(step(s, { type: 'challengePick', player: 'p1', challengeId: 'nope', choice: 'rock', windowId: s.windowId })).toMatchObject({ ok: false, error: { code: 'UNKNOWN_CHALLENGE' } });
    expect(step(s, choose('p1', 'A')(s))).toMatchObject({ ok: false, error: { code: 'INVALID_CHOICE' } });
  });
});
