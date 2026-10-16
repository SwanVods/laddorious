import { describe, expect, it } from 'vitest';
import { describeCard, jumpsAreOff, resolveConfig, type CatalogCard, type EffectTemplate, type MatchState, type TargetRule } from '../src/index';
import { addEffect, useAttackShield, useSnakeShield } from '../src/engine/effects';
import { makeBoard, ofType, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'random' };
const EITHER: EffectTemplate = { params: { hook: 'beforeSnakeOrAttack' }, lifetime: { charges: 1 } };
const OFF: EffectTemplate = { params: { hook: 'jumpsOff' }, lifetime: { rounds: 1 } };
const card = (effects: CatalogCard['effects'], target = SELF, id = 'x'): CatalogCard => ({ id, name: id, type: 'misc', rarity: 'common', weight: 1, target, effects });
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ ...card([{ op: 'moveRelative', amount: 1 }], SELF, id), rarity });
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'test', owner);

describe('a shield against a snake or an attack (2026-10-16)', () => {
  it('blocks an attack, then is gone', () => {
    const s = setup({ players: 2 });
    const e = put(s, 'p1', EITHER);
    expect(useAttackShield(s, [], 'p1')).toBe(e.id);
    expect(useSnakeShield(s, [], 'p1')).toBeNull();
  });

  it('blocks a snake', () => {
    const s = setup({ players: 2, board: makeBoard(100, [[30, 5]]), positions: [27, 0], dice: [[3], [1]] });
    put(s, 'p1', EITHER);
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)[0]).toBe(30);
    expect(ofType(events, 'SnakeBlocked')).toHaveLength(1);
  });

  it('is kept for last behind a plain shield', () => {
    const s = setup({ players: 2 });
    const plain = put(s, 'p1', { params: { hook: 'beforeAttack' }, lifetime: { charges: 1 } });
    const either = put(s, 'p1', { params: { hook: 'beforeSnakeOrAttack' }, lifetime: { charges: 2 } });
    expect(useAttackShield(s, [], 'p1')).toBe(plain.id);
    expect(s.effects).toMatchObject([{ id: either.id, lifetime: { charges: 2 } }]);
  });
});

describe('snakes and ladders off (2026-10-16)', () => {
  it('stops every snake and ladder, for everyone, without using a snake shield', () => {
    const s = setup({ players: 2, board: makeBoard(100, [[30, 5], [12, 40]]), positions: [27, 9], dice: [[3], [3]] });
    put(s, 'p2', OFF);
    put(s, 'p1', { params: { hook: 'beforeSnake' }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([30, 12]);
    expect(ofType(events, 'SnakeBlocked')).toEqual([]);
    expect(state.effects.map((e) => e.params.hook)).toEqual(['jumpsOff', 'beforeSnake']);
  });

  it('works again once it runs out', () => {
    // Made in round 1 for 1 round: it covers rounds 1 and 2 and runs out as round 2 ends (expireEffects).
    const s = setup({ players: 2, board: makeBoard(100, [[12, 40]]), positions: [9, 0], dice: [[1, 1, 1], [1, 1, 1]] });
    put(s, 'p2', OFF);
    const round2 = play(s, [roll('p1'), roll('p2'), roll('p1'), roll('p2')]).state;
    expect(positions(round2)[0]).toBe(11);
    expect(jumpsAreOff(round2.effects)).toBe(false);
    const round3 = play(round2, [roll('p1'), roll('p2')]).state;
    expect(positions(round3)[0]).toBe(40);
  });

  it('must target you, with rounds and no uses', () => {
    const others = [fill('r', 'rare'), fill('e', 'epic'), fill('c', 'common')];
    const onLeader = card([{ op: 'addEffect', template: OFF }], LEADER, 'a');
    const withUses = card([{ op: 'addEffect', template: { params: { hook: 'jumpsOff' }, lifetime: { rounds: 1, charges: 1 } } }], SELF, 'b');
    expect(() => resolveConfig({ seed: 's', cards: [...others, onLeader] })).toThrow(/snakes and ladders off is for everyone: its card targets you/);
    expect(() => resolveConfig({ seed: 's', cards: [...others, withUses] })).toThrow(/jumpsOff needs rounds and no uses/);
  });

  it('writes the texts', () => {
    expect(describeCard(card([{ op: 'addEffect', template: OFF }]))).toBe('Rockets and whirlpools do nothing for 1 round.');
    expect(describeCard(card([{ op: 'addEffect', template: { params: { hook: 'jumpsOff' }, lifetime: { rounds: 2 } } }]))).toBe('Rockets and whirlpools do nothing for 2 rounds.');
    expect(describeCard(card([{ op: 'addEffect', template: { params: { hook: 'beforeSnakeOrAttack' }, lifetime: { charges: 1, rounds: 2 } } }]))).toBe('Block the next whirlpool or attack, whichever comes first (2 rounds).');
    expect(describeCard(card([{ op: 'addEffect', template: { params: { hook: 'beforeSnakeOrAttack' }, lifetime: { charges: 2 } } }]))).toBe('Block the next 2 whirlpools or attacks, any time this match.');
  });
});
