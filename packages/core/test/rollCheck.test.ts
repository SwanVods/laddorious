import { describe, expect, it } from 'vitest';
import { describeCard, type CatalogCard, type EffectTemplate, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { startDicePhase } from '../src/engine/dice';
import { addEffect } from '../src/engine/effects';
import { makeBoard, ofType, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
type Check = Extract<EffectTemplate['params'], { hook: 'rollCheck' }>;
const check = (params: Omit<Check, 'hook'>): EffectTemplate => ({ params: { hook: 'rollCheck', ...params }, lifetime: { charges: 1 } });
const ODD_X2 = check({ when: 'odd', then: { multiply: 2 } });
const EVEN_SHIELD = check({ when: 'even', then: { shield: { charges: 1, rounds: 2 } } });
const HIGH = check({ when: 'over3', then: { toLadder: true }, otherwise: 'stay' });
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'odd-luck', owner);
const card = (t: EffectTemplate): CatalogCard => ({ id: 'x', name: 'x', type: 'risky', rarity: 'common', weight: 1, target: SELF, effects: [{ op: 'addEffect', template: t }] });
const rollBoth = (s: MatchState) => play(s, [roll('p1'), roll('p2')]);

describe('"if your next roll is…" (2026-10-16)', () => {
  it('doubles an odd roll, and is spent either way', () => {
    const odd = setup({ players: 2, positions: [10, 0], dice: [[3], [1]] });
    put(odd, 'p1', ODD_X2);
    const a = rollBoth(odd);
    expect(positions(a.state)[0]).toBe(16);
    expect(ofType(a.events, 'RollChecked')).toMatchObject([{ player: 'p1', met: true }]);
    expect(a.state.effects).toEqual([]);
    const even = setup({ players: 2, positions: [10, 0], dice: [[4], [1]] });
    put(even, 'p1', ODD_X2);
    const b = rollBoth(even);
    expect(positions(b.state)[0]).toBe(14);
    expect(ofType(b.events, 'RollChecked')).toMatchObject([{ player: 'p1', met: false }]);
    expect(b.state.effects).toEqual([]);
  });

  it('gives a snake-or-attack shield on an even roll', () => {
    const s = setup({ players: 2, positions: [10, 0], dice: [[4], [1]] });
    put(s, 'p1', EVEN_SHIELD);
    const { state } = rollBoth(s);
    expect(state.effects).toMatchObject([{ owner: 'p1', sourceCard: 'odd-luck', params: { hook: 'beforeSnakeOrAttack' }, lifetime: { charges: 1, rounds: 2 } }]);
    const odd = setup({ players: 2, positions: [10, 0], dice: [[3], [1]] });
    put(odd, 'p1', EVEN_SHIELD);
    expect(rollBoth(odd).state.effects).toEqual([]);
  });

  it('goes to the nearest ladder over 3, and stays put otherwise', () => {
    const board = makeBoard(100, [[20, 50]]);
    const high = setup({ players: 2, board, positions: [10, 0], dice: [[5], [1]] });
    put(high, 'p1', HIGH);
    expect(positions(rollBoth(high).state)[0]).toBe(50);
    const low = setup({ players: 2, board, positions: [10, 0], dice: [[2], [1]] });
    put(low, 'p1', HIGH);
    expect(positions(rollBoth(low).state)[0]).toBe(10);
    const none = setup({ players: 2, board: makeBoard(100, [[5, 30]]), positions: [10, 0], dice: [[5], [1]] });
    put(none, 'p1', HIGH);
    expect(positions(rollBoth(none).state)[0]).toBe(10);
  });

  it('checks the face a card forced', () => {
    const s = setup({ players: 2, positions: [10, 0], dice: [[4], [1]] });
    put(s, 'p1', { params: { hook: 'diceFace', die: 'first', set: 3 }, lifetime: { charges: 1 } });
    put(s, 'p1', ODD_X2);
    expect(positions(rollBoth(s).state)[0]).toBe(16);
  });

  it('waits through a skipped roll', () => {
    const s = setup({ players: 2 });
    put(s, 'p1', { params: { hook: 'skipRoll' }, lifetime: { charges: 1 } });
    put(s, 'p1', ODD_X2);
    const ev: GameEvent[] = [];
    startDicePhase(s, ev);
    const { state, events } = play(s, [roll('p2')]);
    expect(ofType(events, 'RollChecked')).toEqual([]);
    expect(state.effects.map((e) => e.params.hook)).toEqual(['rollCheck']);
  });

  it('writes the texts', () => {
    expect(describeCard(card(ODD_X2))).toBe('If your next roll is odd, it is doubled.');
    expect(describeCard(card(check({ when: 'odd', then: { multiply: 3 } })))).toBe('If your next roll is odd, it is tripled.');
    expect(describeCard(card(EVEN_SHIELD))).toBe('If your next roll is even, block the next snake or attack (2 rounds).');
    expect(describeCard(card(check({ when: 'even', then: { shield: { charges: 3, rounds: 5 } } })))).toBe('If your next roll is even, block the next 3 snakes or attacks (5 rounds).');
    expect(describeCard(card(HIGH))).toBe('If your next roll is over 3, go to the nearest ladder. If not, stay put.');
  });
});
