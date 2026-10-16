import { describe, expect, it } from 'vitest';
import { describeCard, resolveConfig, type CatalogCard, type EffectTemplate, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { startDicePhase } from '../src/engine/dice';
import { addEffect } from '../src/engine/effects';
import { advance } from '../src/engine/step';
import { ofType, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'random' };
const AHEAD: TargetRule = { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' };
const OTHERS: TargetRule = { condition: 'other', pick: 'all', tieBreak: 'lowest-seat' };
const SKIP: EffectTemplate = { params: { hook: 'skipRoll' }, lifetime: { charges: 1 } };
const BACK: EffectTemplate = { params: { hook: 'reverseRoll' }, lifetime: { charges: 1 } };
const card = (effects: CatalogCard['effects'], target = SELF, id = 'x'): CatalogCard => ({ id, name: id, type: 'attack', rarity: 'common', weight: 1, target, effects });
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ ...card([{ op: 'moveRelative', amount: 1 }], SELF, id), rarity });
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'test', 'p2');
/** The dice phase again, as the next round opens it, with the effects now on the players. */
function reopen(s: MatchState): GameEvent[] {
  const ev: GameEvent[] = [];
  startDicePhase(s, ev);
  return ev;
}

describe('skipping a roll (2026-10-16)', () => {
  it("leaves the player out of the dice window and spends the skip", () => {
    const s = setup({ players: 2, dice: [[3], [4]] });
    put(s, 'p1', SKIP);
    const ev = reopen(s);
    expect(ofType(ev, 'RollSkipped')).toMatchObject([{ player: 'p1' }]);
    expect(ofType(ev, 'WindowOpened').at(-1)).toMatchObject({ window: 'dice', players: ['p2'] });
    expect(s.phase).toMatchObject({ kind: 'dice', seqs: { p1: { status: 'skipped', faces: [] } } });
    expect(s.effects).toEqual([]);
    const { state, events } = play(s, [roll('p2')]);
    expect(positions(state)).toEqual([0, 4]);
    expect(ofType(events, 'DieRolled').map((e) => e.player)).toEqual(['p2']);
    expect(ofType(events, 'DiceTotaled').map((e) => e.player)).toEqual(['p2']);
  });

  it('moves the round on when everyone skips', () => {
    const s = setup({ players: 2 });
    put(s, 'p1', SKIP);
    put(s, 'p2', SKIP);
    const ev = reopen(s);
    advance(s, ev);
    expect(positions(s)).toEqual([0, 0]);
    expect(s.round).toBe(2);
  });

  it('keeps next-roll bonuses for the next real roll', () => {
    const s = setup({ players: 2, dice: [[3, 2], [4, 1]] });
    put(s, 'p1', SKIP);
    put(s, 'p1', { params: { hook: 'diceTotal', op: 'add', value: 5 }, lifetime: { charges: 1 } });
    reopen(s);
    const first = play(s, [roll('p2')]).state;
    expect(first.effects).toMatchObject([{ params: { hook: 'diceTotal', value: 5 } }]);
    const { state } = play(first, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([8, 5]);
  });
});

describe('a roll that moves you back (2026-10-16)', () => {
  it('moves the player back by the total', () => {
    const s = setup({ players: 2, positions: [20, 10], dice: [[4], [1]] });
    put(s, 'p1', BACK);
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([16, 11]);
    expect(ofType(events, 'DiceTotaled')[0]).toMatchObject({ player: 'p1', total: -4 });
    expect(state.effects).toEqual([]);
  });

  it('never goes below tile 0', () => {
    const s = setup({ players: 2, positions: [2, 10], dice: [[5], [1]] });
    put(s, 'p1', BACK);
    expect(positions(play(s, [roll('p1'), roll('p2')]).state)).toEqual([0, 11]);
  });

  it('applies the other modifiers first, then turns the total around', () => {
    const s = setup({ players: 2, positions: [20, 10], dice: [[3], [1]] });
    put(s, 'p1', BACK);
    put(s, 'p1', { params: { hook: 'diceTotal', op: 'multiply', value: 2 }, lifetime: { charges: 1 } });
    expect(positions(play(s, [roll('p1'), roll('p2')]).state)).toEqual([14, 11]);
  });
});

describe('skip and back on cards (2026-10-16)', () => {
  const others = [fill('r', 'rare'), fill('e', 'epic'), fill('c', 'common')];
  it('needs uses', () => {
    const bad = card([{ op: 'addEffect', template: { params: { hook: 'skipRoll' }, lifetime: { rounds: 2 } } }], LEADER, 'bad');
    expect(() => resolveConfig({ seed: 's', cards: [...others, bad] })).toThrow(/needs uses/);
  });

  it('writes the texts', () => {
    expect(describeCard(card([{ op: 'addEffect', template: SKIP }], LEADER))).toBe('The leader skips their next roll.');
    expect(describeCard(card([{ op: 'addEffect', template: SKIP }], AHEAD))).toBe('The player just ahead of you skips their next roll.');
    expect(describeCard(card([{ op: 'addEffect', template: SKIP }], OTHERS))).toBe('Each opponent skips their next roll.');
    expect(describeCard(card([{ op: 'addEffect', template: BACK }], LEADER))).toBe("The leader's next roll moves them back.");
    expect(describeCard(card([{ op: 'addEffect', template: BACK }], AHEAD))).toBe('The next roll of the player just ahead of you moves them back.');
    expect(describeCard(card([{ op: 'addEffect', template: BACK }], OTHERS))).toBe("Each opponent's next roll moves them back.");
    const gamble = card([{ op: 'gamble', outcomes: [
      { weight: 50, ops: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'multiply', value: 2 }, lifetime: { charges: 1 } } }] },
      { weight: 50, ops: [{ op: 'addEffect', template: BACK }] },
    ] }]);
    expect(describeCard(gamble)).toBe('50%: your next roll is doubled. 50%: your next roll moves you back.');
  });
});
