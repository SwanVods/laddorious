import { describe, expect, it } from 'vitest';
import { awaiting, step, type EffectTemplate, type Input, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { ofType, play, positions, roll, setup, timeout } from './support/fixtures';

function withEffect(s: MatchState, owner: string, template: EffectTemplate): MatchState {
  addEffect(s, [], owner, template, 'test', owner);
  return s;
}

describe('dice phase', () => {
  it('moves everyone simultaneously by their totals once all have rolled', () => {
    const s = setup({ dice: [[3], [4]] });
    const first = play(s, [roll('p1')]);
    expect(positions(first.state)).toEqual([0, 0]); // waits for p2
    const { state, events } = play(first.state, [roll('p2')]);
    expect(positions(state)).toEqual([3, 4]);
    expect(ofType(events, 'DiceTotaled').map((e) => [e.player, e.total])).toEqual([['p1', 3], ['p2', 4]]);
    expect(state.round).toBe(2);
  });

  it('ends a roll after one die, even when it shows 6 (no bonus roll)', () => {
    const s = play(setup({ dice: [[6], [1]] }), [roll('p1')]).state;
    expect(s.phase.kind === 'dice' && s.phase.seqs['p1']).toEqual({ faces: [6], status: 'done' });
    expect(awaiting(s)).toMatchObject({ window: 'dice', players: ['p2'] });
    const { state, events } = play(s, [roll('p2')]);
    expect(positions(state)).toEqual([6, 1]);
    expect(ofType(events, 'DiceTotaled')[0]).toMatchObject({ player: 'p1', faces: [6], total: 6 });
  });

  it('rejects a second roll from a player who already rolled', () => {
    const s = play(setup({ dice: [[2], [1]] }), [roll('p1')]).state;
    expect(step(s, roll('p1')(s))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
  });

  it('rejects the removed bonusChoice input as an unknown input type', () => {
    const s = play(setup({ dice: [[6], [1]] }), [roll('p1')]).state;
    const legacy = { type: 'bonusChoice', player: 'p1', rollAgain: true, windowId: s.windowId } as unknown as Input;
    expect(step(s, legacy)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT', message: 'unknown input type' } });
  });

  it('auto-rolls anyone who has not rolled when the window expires, then ends the phase', () => {
    const { state, events } = play(setup({ dice: [[2], [6]] }), [roll('p1'), timeout]);
    expect(ofType(events, 'DieRolled').at(-1)).toMatchObject({ player: 'p2', face: 6, auto: true });
    expect(positions(state)).toEqual([2, 6]);
    expect(ofType(events, 'WindowOpened').map((e) => e.window)).toEqual(['dice']); // only round 2's dice window
    expect(state.round).toBe(2);
  });

  it('bounces off the final tile', () => {
    const { state, events } = play(setup({ positions: [98, 10], dice: [[5], [1]] }), [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([97, 11]);
    expect(ofType(events, 'Moved')[0]).toMatchObject({ player: 'p1', from: 98, to: 97, bounced: true });
  });

  it('applies FACE effects to the die as it is rolled (a forced 6 also ends the roll)', () => {
    const s = withEffect(setup({ dice: [[2], [1]] }), 'p1', { params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1')]);
    expect(ofType(events, 'DieRolled')[0]).toMatchObject({ natural: 2, face: 6, forced: true });
    expect(state.phase.kind === 'dice' && state.phase.seqs['p1']!.status).toBe('done');
    expect(state.effects).toHaveLength(0); // its single charge was spent
    expect(positions(play(state, [roll('p2')]).state)).toEqual([6, 1]);
  });

  it('applies TOTAL effects in order Replace (newest) → Multiply → Add', () => {
    let s = setup({ dice: [[1], [1]] });
    for (const params of [
      { hook: 'diceTotal', op: 'replace', value: 4 },
      { hook: 'diceTotal', op: 'replace', value: 5 },
      { hook: 'diceTotal', op: 'multiply', value: 2 },
      { hook: 'diceTotal', op: 'add', value: -3 },
    ] as const) {
      s = withEffect(s, 'p1', { params, lifetime: { charges: 1 } });
    }
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'DiceTotaled')[0]).toMatchObject({ player: 'p1', faces: [1], total: 7 }); // (5 × 2) − 3
    expect(positions(state)).toEqual([7, 1]);
    expect(state.effects).toHaveLength(0);
  });

  it('floors dice movement at 0', () => {
    const s = withEffect(setup({ positions: [20, 0], dice: [[2], [1]] }), 'p1', {
      params: { hook: 'diceTotal', op: 'add', value: -10 },
      lifetime: { charges: 1 },
    });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'DiceTotaled')[0]!.total).toBe(0);
    expect(positions(state)).toEqual([20, 1]);
  });
});
