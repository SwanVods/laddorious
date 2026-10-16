import { describe, expect, it } from 'vitest';
import { describeCard, resolveConfig, type CatalogCard, type EffectTemplate, type MatchState, type TargetRule } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { makeBoard, play, positions, roll, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const after = (condition: 'landedOnSnakeHead' | 'climbedLadder', amount: number, lifetime: EffectTemplate['lifetime'], others = false): EffectTemplate => ({
  params: { hook: 'afterMove', cause: 'dice', condition, amount, ...(others ? { who: 'others' as const } : {}) },
  lifetime,
});
const put = (s: MatchState, owner: string, t: EffectTemplate) => addEffect(s, [], owner, t, 'test', owner);
const card = (effects: CatalogCard['effects'], values?: CatalogCard['values'], id = 'x'): CatalogCard => ({ id, name: id, type: 'risky', rarity: 'common', weight: 1, target: SELF, effects, ...(values ? { values } : {}) });

describe('"when" effects (2026-10-16)', () => {
  it('moves you on after you ride a rocket, then is spent', () => {
    const s = setup({ players: 2, board: makeBoard(100, [[12, 40]]), positions: [9, 0], dice: [[3], [1]] });
    put(s, 'p1', after('climbedLadder', 5, { charges: 1 }));
    const { state } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([45, 1]);
    expect(state.effects).toEqual([]);
  });

  it('waits through rolls that climb nothing, and so does Snake Bait', () => {
    const s = setup({ players: 2, board: makeBoard(100, [[12, 40], [30, 5]]), positions: [9, 0], dice: [[2], [1]] });
    put(s, 'p1', after('climbedLadder', 5, { charges: 1 }));
    put(s, 'p1', after('landedOnSnakeHead', 8, { charges: 1 }));
    const { state } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([11, 1]);
    expect(state.effects).toHaveLength(2);
  });

  it("doesn't fire when a shield stops the snake", () => {
    const s = setup({ players: 2, board: makeBoard(100, [[30, 5]]), positions: [27, 0], dice: [[3], [1]] });
    put(s, 'p1', { params: { hook: 'beforeSnake' }, lifetime: { charges: 1 } });
    put(s, 'p1', after('landedOnSnakeHead', 8, { charges: 1 }));
    const { state } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([30, 1]);
    expect(state.effects.map((e) => e.params.hook)).toEqual(['afterMove']);
  });

  it('moves each opponent when you hit a whirlpool, every time while it lasts', () => {
    const s = setup({ players: 3, board: makeBoard(100, [[30, 5]]), positions: [27, 50, 60], dice: [[3], [1], [1]] });
    put(s, 'p1', after('landedOnSnakeHead', -2, { rounds: 3 }, true));
    const { state } = play(s, [roll('p1'), roll('p2'), roll('p3')]);
    expect(positions(state)).toEqual([5, 49, 59]);
    expect(state.effects).toHaveLength(1);
  });

  it('lets two players with it each move the others once, after every slide', () => {
    const s = setup({ players: 3, board: makeBoard(100, [[30, 25], [48, 44]]), positions: [27, 46, 60], dice: [[3], [2], [1]] });
    put(s, 'p1', after('landedOnSnakeHead', -2, { rounds: 3 }, true));
    put(s, 'p2', after('landedOnSnakeHead', -2, { rounds: 3 }, true));
    const { state } = play(s, [roll('p1'), roll('p2'), roll('p3')]);
    expect(positions(state)).toEqual([23, 42, 57]);
  });

  it('moves each opponent only on your dice moves', () => {
    const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ ...card([{ op: 'moveRelative', amount: 1 }], undefined, id), rarity });
    const bad = card([{ op: 'conditional', trigger: { cause: 'effect', condition: 'landedOnSnakeHead' }, who: 'others', amount: -2, lifetime: { rounds: 3, charges: 1 } }], undefined, 'bad');
    expect(() => resolveConfig({ seed: 's', cards: [fill('c', 'common'), fill('r', 'rare'), fill('e', 'epic'), bad] })).toThrow(/moves each opponent only after your dice moves/);
  });

  it('writes the texts', () => {
    expect(describeCard(card([{ op: 'conditional', trigger: { cause: 'dice', condition: 'climbedLadder' }, amount: { value: 'n' }, lifetime: { charges: 1 } }], { n: { min: 3, max: 8 } }))).toBe(
      'Next time you ride a rocket, move forward 3–8 more.',
    );
    expect(describeCard(card([{ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, who: 'others', amount: -2, lifetime: { rounds: 3 } }]))).toBe(
      'For 3 rounds: if you hit a whirlpool, each opponent moves back 2.',
    );
    expect(describeCard(card([{ op: 'conditional', trigger: { cause: 'dice', condition: 'climbedLadder' }, who: 'others', amount: 2, lifetime: { rounds: 3 } }]))).toBe(
      'For 3 rounds: if you ride a rocket, each opponent moves forward 2.',
    );
    expect(describeCard(card([{ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, amount: { value: 'n' }, lifetime: { charges: 1 } }], { n: { min: 3, max: 8 } }))).toBe(
      'Next time you land in a whirlpool, move forward 3–8 after sliding.',
    );
  });
});
