import { describe, expect, it } from 'vitest';
import { describeCard, step, type CatalogCard, type EffectTemplate, type MatchState, type TargetRule } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { makeBoard, ofType, play, positions, reroll, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const ENCORE: EffectTemplate = { params: { hook: 'extraRoll' }, lifetime: { charges: 1 } };
const MORE: EffectTemplate = { params: { hook: 'moreRerolls' }, lifetime: { charges: 1 } };
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'test', owner);
const card = (t: EffectTemplate): CatalogCard => ({ id: 'x', name: 'x', type: 'movement', rarity: 'common', weight: 1, target: SELF, effects: [{ op: 'addEffect', template: t }] });

describe('Encore: roll again this round (2026-10-16)', () => {
  it('gives its owner a dice window of their own once the round has played out', () => {
    const s = setup({ players: 2, positions: [10, 0], dice: [[3, 4], [1]] });
    put(s, 'p1', ENCORE);
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([13, 1]);
    expect(state.round).toBe(1);
    expect(ofType(events, 'ExtraRoll')).toMatchObject([{ players: ['p1'] }]);
    expect(ofType(events, 'WindowOpened').at(-1)).toMatchObject({ window: 'dice', players: ['p1'] });
    expect(state.phase).toMatchObject({ kind: 'dice', seqs: { p1: { status: 'ready' }, p2: { status: 'out' } } });
    expect(state.effects).toEqual([]);
    const after = play(state, [roll('p1')]).state;
    expect(positions(after)).toEqual([17, 1]);
    expect(after.round).toBe(2);
  });

  it('lets two players roll again in one window', () => {
    const s = setup({ players: 2, dice: [[1, 1], [2, 2]] });
    put(s, 'p1', ENCORE);
    put(s, 'p2', ENCORE);
    const { events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'WindowOpened').at(-1)).toMatchObject({ players: ['p1', 'p2'] });
  });

  it('only lets the players rolling again find a card', () => {
    const s = setup({ players: 2, positions: [10, 0], dice: [[3, 4], [1]] });
    put(s, 'p1', ENCORE);
    const { state } = play(s, [roll('p1'), roll('p2')]);
    expect(state.movedThisRound).toEqual([]);
  });

  it('is a roll like any other: a skip waiting on it skips it', () => {
    const s = setup({ players: 2, dice: [[3], [1]] });
    put(s, 'p1', ENCORE);
    put(s, 'p1', { params: { hook: 'skipRoll' }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'RollSkipped')).toMatchObject([{ player: 'p1' }]);
    expect(state.round).toBe(2);
  });
});

describe('Second Thoughts: more rerolls in the next hand (2026-10-16)', () => {
  it('allows two rerolls on each card and five in all, for one hand', () => {
    const s = setup({ players: 2, board: makeBoard(100, [], { 3: 'common' }), dice: [[3], [1]] });
    put(s, 'p1', MORE);
    const dealt = play(s, [roll('p1'), roll('p2')]).state;
    expect(dealt.phase).toMatchObject({ kind: 'mysterySelect', offers: { p1: { perSlot: 2, maxRerolls: 5 } } });
    expect(dealt.effects).toEqual([]);
    const twice = play(dealt, [reroll('p1', 0), reroll('p1', 0)]).state;
    const third = step(twice, reroll('p1', 0)(twice));
    expect(third).toMatchObject({ ok: false, error: { code: 'SLOT_ALREADY_REROLLED' } });
  });

  it('writes the texts', () => {
    expect(describeCard(card(ENCORE))).toBe('Roll again this round.');
    expect(describeCard(card(MORE))).toBe('Your next card hand: one more reroll on each card.');
  });
});
