import { describe, expect, it } from 'vitest';
import { ConfigError, createMatch, drawCard, createStream, resolveConfig, viewFor, type CatalogCard } from '../src/index';

const SELF = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' } as const;
const move = (id: string, rarity: CatalogCard['rarity'], type: CatalogCard['type'] = 'movement', over: Partial<CatalogCard> = {}): CatalogCard => ({ id, name: id, type, rarity, weight: 1, target: SELF, effects: [{ op: 'moveRelative', amount: 3 }], ...over });
const lucky: CatalogCard = { ...move('lucky', 'common'), values: { n: { min: 1, max: 6 } }, effects: [{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: { value: 'n' } }, lifetime: { charges: 1 } } }] };
const cards = [lucky, move('r', 'rare'), move('e', 'epic'), move('off', 'common', 'attack', { status: 'off' }), { ...move('later', 'rare'), status: 'draft' as const, plan: 'Something new', effects: [] }];

describe('match config with catalogue cards (2026-10-15)', () => {
  it('plays only the cards switched on, values filled and text written, the same for the same seed', () => {
    const a = resolveConfig({ seed: 's', cards });
    const b = resolveConfig({ seed: 's', cards });
    expect(a.cards.map((c) => c.id)).toEqual(['lucky', 'r', 'e']);
    expect(a.cardValues).toEqual(b.cardValues);
    const n = a.cardValues.lucky!.n!;
    expect(a.cards[0]!.effects).toEqual([{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: n }, lifetime: { charges: 1 } } }]);
    expect(a.cards[0]!.text).toBe(`Your next die shows ${n}.`);
  });

  it('refuses a broken card list with the problem in plain words', () => {
    expect(() => resolveConfig({ seed: 's', cards: [{ ...lucky, values: { n: { min: 9, max: 1 } } }, move('r', 'rare'), move('e', 'epic')] })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', cards: [{ ...lucky, values: { n: { min: 9, max: 1 } } }, move('r', 'rare'), move('e', 'epic')] })).toThrow('card lucky: Value n: the lowest (9) is above the highest (1).');
  });

  it('deals three cards even when a whole type is switched off in a rarity', () => {
    const cfg = resolveConfig({ seed: 's', cards: [move('a', 'common'), move('b', 'common', 'defense'), move('c', 'common', 'risky'), move('r', 'rare'), move('e', 'epic')] });
    const stream = createStream('deal');
    const dealt: string[] = [];
    for (let i = 0; i < 3; i++) dealt.push(drawCard(cfg.cards, 'common', cfg.mystery.typeWeights, stream, dealt)!);
    expect([...dealt].sort()).toEqual(['a', 'b', 'c']);
  });

  it("shows every player the match's picked values", () => {
    const s = createMatch({ seed: 's', cards }, [{ id: 'p1' }, { id: 'p2' }]);
    expect(viewFor(s, 'p2').cardValues).toEqual(s.config.cardValues);
  });
});
