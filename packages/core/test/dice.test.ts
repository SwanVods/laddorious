import { describe, expect, it } from 'vitest';
import { awaiting, step, type EffectTemplate, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { again, ofType, play, positions, roll, setup, stop, timeout } from './support/fixtures';

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

  it('makes the bonus roll after a 6 optional', () => {
    const stopped = play(setup({ dice: [[6], [1]] }), [roll('p1'), stop('p1'), roll('p2')]);
    expect(positions(stopped.state)).toEqual([6, 1]);
    const rolled = play(setup({ dice: [[6, 2], [1]] }), [roll('p1'), again('p1'), roll('p2')]);
    expect(positions(rolled.state)).toEqual([8, 1]);
  });

  it('ends the sequence after a second consecutive 6', () => {
    const s = play(setup({ dice: [[6, 6], [1]] }), [roll('p1'), again('p1')]).state;
    expect(s.phase.kind === 'dice' && s.phase.seqs['p1']!.status).toBe('done');
    expect(positions(play(s, [roll('p2')]).state)).toEqual([12, 1]);
  });

  it('rejects rolls and bonus choices that are not awaited', () => {
    const s = play(setup({ dice: [[2], [1]] }), [roll('p1')]).state;
    expect(step(s, roll('p1'))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
    expect(step(s, again('p2'))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
  });

  it('auto-rolls on timeout, then gives auto-rolled 6s a grace window that ends in Stop', () => {
    const s = setup({ dice: [[2], [6]] });
    const afterTimeout = play(s, [roll('p1'), timeout]);
    expect(ofType(afterTimeout.events, 'DieRolled').at(-1)).toMatchObject({ player: 'p2', face: 6, auto: true });
    expect(awaiting(afterTimeout.state)).toMatchObject({ window: 'bonusGrace', players: ['p2'], durationMs: 5_000 });
    const { state, events } = play(afterTimeout.state, [timeout]);
    expect(ofType(events, 'BonusChosen')).toMatchObject([{ player: 'p2', rollAgain: false, auto: true }]);
    expect(positions(state)).toEqual([2, 6]);
  });

  it('lets a player still deciding at expiry use the grace window to roll again', () => {
    const s = play(setup({ dice: [[6, 3], [4]] }), [roll('p1'), timeout]).state;
    expect(awaiting(s)).toMatchObject({ window: 'bonusGrace', players: ['p1'] });
    expect(positions(play(s, [again('p1')]).state)).toEqual([9, 4]);
  });

  it('bounces off the final tile', () => {
    const { state, events } = play(setup({ positions: [98, 10], dice: [[5], [1]] }), [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([97, 11]);
    expect(ofType(events, 'Moved')[0]).toMatchObject({ player: 'p1', from: 98, to: 97, bounced: true });
  });

  it('applies FACE effects before the 6-check (a forced 6 earns the bonus roll)', () => {
    const s = withEffect(setup({ dice: [[2, 3], [1]] }), 'p1', { params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1')]);
    expect(ofType(events, 'DieRolled')[0]).toMatchObject({ natural: 2, face: 6, forced: true });
    expect(state.phase.kind === 'dice' && state.phase.seqs['p1']!.status).toBe('bonusPending');
    expect(state.effects).toHaveLength(0); // its single charge was spent
    expect(positions(play(state, [again('p1'), roll('p2')]).state)).toEqual([9, 1]);
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
