import { describe, expect, it } from 'vitest';
import { cardProblems, catalogProblems, createStream, fillCard, pickCardValues, statusOf, type CatalogCard, type CardCatalog } from '../src/index';

const SELF = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' } as const;
const card = (over: Partial<CatalogCard> = {}): CatalogCard => ({
  id: 'lucky', name: 'Lucky', type: 'movement', rarity: 'common', weight: 1, target: SELF,
  values: { n: { min: 1, max: 6 } },
  effects: [{ op: 'gamble', outcomes: [{ weight: 1, ops: [{ op: 'moveRelative', amount: { value: 'n' } }] }, { weight: 1, ops: [{ op: 'moveRelative', amount: { value: 'n', negate: true } }] }] }],
  ...over,
});
const each = (rarity: 'common' | 'rare' | 'epic', id: string): CatalogCard => card({ id, rarity, values: undefined, effects: [{ op: 'moveRelative', amount: 3 }] });
const base = [each('common', 'a'), each('rare', 'b'), each('epic', 'c')];

describe('the card catalogue (2026-10-15)', () => {
  it('treats a card without a status as on', () => {
    expect(statusOf(card())).toBe('on');
    expect(statusOf(card({ status: 'draft' }))).toBe('draft');
  });

  it("picks each on card's values once, in range, the same for the same seed", () => {
    const cards = [card(), card({ id: 'off', status: 'off' })];
    const a = pickCardValues(cards, createStream('seed|cardValues'));
    const b = pickCardValues(cards, createStream('seed|cardValues'));
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(['lucky']);
    expect(a.lucky!.n).toBeGreaterThanOrEqual(1);
    expect(a.lucky!.n).toBeLessThanOrEqual(6);
  });

  it('fills a card with its values, negated where asked', () => {
    const filled = fillCard(card(), { n: 4 });
    expect(filled.effects).toEqual([{ op: 'gamble', outcomes: [{ weight: 1, ops: [{ op: 'moveRelative', amount: 4 }] }, { weight: 1, ops: [{ op: 'moveRelative', amount: -4 }] }] }]);
  });

  it('finds no problem in a sound list', () => {
    expect(cardProblems([...base, card()])).toEqual([]);
  });

  it('names the card and says what is wrong, in plain words', () => {
    const problems = cardProblems([
      ...base,
      card({ id: 'x1', values: { n: { min: 5, max: 2 } } }),
      card({ id: 'x2', values: {} }),
      card({ id: 'x3', effects: [] }),
      card({ id: 'x4', status: 'draft', effects: [], plan: '' }),
      card({ id: 'a' }),
      card({ id: 'Bad Id' }),
    ]);
    expect(problems).toEqual([
      { cardId: 'x1', message: 'Value n: the lowest (5) is above the highest (2).' },
      { cardId: 'x2', message: 'It uses a value named n, but the card has no value with that name.' },
      { cardId: 'x3', message: 'It has no steps. Add a step, or make it a draft.' },
      { cardId: 'x4', message: 'A draft needs a plan: say in plain words what it should do.' },
      { cardId: 'a', message: 'Another card already uses the id "a".' },
      { cardId: 'Bad Id', message: 'Its id may only use lowercase letters, digits and dashes.' },
    ]);
  });

  it("reports a step the engine would refuse, checked at a range's lowest and highest", () => {
    const problems = cardProblems([...base, card({ id: 'face', values: { n: { min: 1, max: 9 } }, effects: [{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: { value: 'n' } }, lifetime: { charges: 1 } } }] })]);
    expect(problems).toEqual([{ cardId: 'face', message: 'card face.effects[0]: diceFace.set must be 1..6 (with n = 9)' }]);
  });

  it('needs at least one card switched on in every rarity', () => {
    expect(cardProblems([each('common', 'a'), { ...each('rare', 'b'), status: 'off' }, each('epic', 'c')])).toEqual([
      { cardId: null, message: 'No rare card is switched on. Every rarity needs at least one.' },
    ]);
  });

  it('checks the odds too', () => {
    const catalog: CardCatalog = { version: 1, odds: { rarityWeights: { common: 0, rare: 0, epic: 0 }, typeWeights: { movement: 1, defense: 1, attack: 1, risky: 1, misc: 1 }, maxRerolls: 5 }, cards: base };
    expect(catalogProblems(catalog)).toEqual([
      { cardId: null, message: 'The "?" square odds must be whole numbers, 0 or more, and not all 0.' },
      { cardId: null, message: 'Rerolls per hand must be 0 to 3.' },
    ]);
  });
});
