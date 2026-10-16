import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, describeCard, resolveConfig, stepKindOf, type CatalogCard, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { resolveGroup } from '../src/engine/resolve';
import { setup } from './support/fixtures';

// An effect on the caster (the user, 2026-10-16): a card that hits someone else can also put an effect on the one
// who played it. Switcheroo swaps with the furthest player ahead, then its caster skips their next roll(s).

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const AHEAD: TargetRule = { condition: 'ahead-of-caster', pick: 'furthest', tieBreak: 'random' };
const OTHERS: TargetRule = { condition: 'other', pick: 'all', tieBreak: 'lowest-seat' };
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ id, name: id, type: 'movement', rarity, weight: 1, target: SELF, effects: [{ op: 'moveRelative', amount: 1 }] });
const swapThenSkip: CatalogCard = {
  id: 'swap-skip', name: 'Swap Skip', type: 'attack', rarity: 'common', weight: 1, target: AHEAD,
  effects: [{ op: 'swap' }, { op: 'addEffect', template: { params: { hook: 'skipRoll' }, lifetime: { charges: 2 } }, onCaster: true }],
};
const cards = [swapThenSkip, fill('r', 'rare'), fill('e', 'epic')];
function play(s: MatchState, caster: string, cardId: string): GameEvent[] {
  const ev: GameEvent[] = [];
  resolveGroup(s, ev, [{ caster, cardId, target: null }]);
  return ev;
}

describe('an effect on the caster (2026-10-16)', () => {
  it('lands on the one who played the card, not on its target', () => {
    const s = setup({ players: 3, positions: [10, 40, 20], config: { cards } });
    play(s, 'p1', 'swap-skip');
    expect(s.players.map((p) => p.position)).toEqual([40, 10, 20]);
    expect(s.effects).toMatchObject([{ owner: 'p1', sourcePlayer: 'p1', params: { hook: 'skipRoll' }, lifetime: { charges: 2 } }]);
  });

  it('says so in the card text', () => {
    expect(describeCard(swapThenSkip)).toBe('Swap places with the furthest player ahead. Then skip your next 2 rolls.');
  });

  it("can't go on a card that hits several players: the caster would take it once for each", () => {
    const bad: CatalogCard = { ...swapThenSkip, id: 'bad', target: OTHERS, effects: [{ op: 'moveRelative', amount: -1 }, swapThenSkip.effects[1]!] };
    expect(() => resolveConfig({ seed: 's', cards: [...cards, bad] })).toThrow(/A card that hits several players can't put an effect on you/);
  });

  it('has its own editor step, which never claims a skip on the target', () => {
    expect(stepKindOf(swapThenSkip.effects[1]!).id).toBe('skipRollSelf');
    expect(stepKindOf({ op: 'addEffect', template: { params: { hook: 'skipRoll' }, lifetime: { charges: 1 } } }).id).toBe('skipRoll');
  });

  it('is on Switcheroo: after the swap, you skip your next roll(s)', () => {
    const switcheroo = CARD_CATALOG.cards.find((c) => c.id === 'switcheroo')!;
    expect(switcheroo.effects.at(-1)).toMatchObject({ op: 'addEffect', template: { params: { hook: 'skipRoll' } }, onCaster: true });
    expect(describeCard(switcheroo)).toMatch(/^Swap places with the furthest player ahead\. Then skip your next /);
  });
});
