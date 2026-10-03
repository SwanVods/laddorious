import { describe, expect, it } from 'vitest';
import { awaiting, step } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { ofType, play, roll, setup } from './support/fixtures';

describe('victory', () => {
  it('a player exactly on N at round end wins; others are ranked by position', () => {
    const { state, events } = play(setup({ players: 3, positions: [96, 50, 0], dice: [[4], [2], [1]] }), [roll('p1'), roll('p2'), roll('p3')]);
    expect(state.phase).toEqual({
      kind: 'finished',
      winner: 'p1',
      rankings: [
        { player: 'p1', rank: 1, position: 100 },
        { player: 'p2', rank: 2, position: 52 },
        { player: 'p3', rank: 3, position: 1 },
      ],
    });
    expect(ofType(events, 'MatchWon')).toHaveLength(1);
    expect(awaiting(state)).toMatchObject({ window: 'none', players: [] });
    expect(step(state, roll('p2'))).toMatchObject({ ok: false, error: { code: 'MATCH_FINISHED' } });
  });
});

describe('round end', () => {
  it('keeps a rounds: n effect through the next n full rounds, then expires it', () => {
    const s = setup({ dice: [[1, 1], [2, 2]] });
    addEffect(s, [], 'p1', { params: { hook: 'beforeAttack' }, lifetime: { rounds: 1 } }, 'test', 'p1');
    const r1 = play(s, [roll('p1'), roll('p2')]);
    expect(r1.state.effects).toHaveLength(1);
    const r2 = play(r1.state, [roll('p1'), roll('p2')]);
    expect(ofType(r2.events, 'EffectExpired')).toMatchObject([{ owner: 'p1' }]);
    expect(r2.state.effects).toEqual([]);
  });
});
