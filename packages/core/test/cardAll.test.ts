import { describe, expect, it } from 'vitest';
import { describeCard, resolveConfig, type CatalogCard, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { resolveGroup } from '../src/engine/resolve';
import { positions, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const OTHERS: TargetRule = { condition: 'other', pick: 'all', tieBreak: 'lowest-seat' };
const EVERYONE: TargetRule = { condition: 'everyone', pick: 'all', tieBreak: 'lowest-seat' };
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ id, name: id, type: 'movement', rarity, weight: 1, target: SELF, effects: [{ op: 'moveRelative', amount: 1 }] });
const quake: CatalogCard = { id: 'quake', name: 'Earthquake', type: 'attack', rarity: 'common', weight: 1, target: OTHERS, effects: [{ op: 'moveRelative', amount: -3 }] };
const retreat: CatalogCard = {
  id: 'retreat', name: 'Retreat!', type: 'misc', rarity: 'common', weight: 1, target: EVERYONE,
  values: { n: { min: 2, max: 2 } }, effects: [{ op: 'moveRelative', amount: { value: 'n', negate: true } }],
};
const cards = [quake, retreat, fill('r', 'rare'), fill('e', 'epic')];

const match = (at: number[]): MatchState => setup({ players: 4, positions: at, config: { cards } });
const resolved = (ev: GameEvent[]) => ev.find((e) => e.type === 'CardResolved') as Extract<GameEvent, { type: 'CardResolved' }>;
const shield = (s: MatchState, owner: string) => addEffect(s, [], owner, { params: { hook: 'beforeAttack' }, lifetime: { charges: 1 } }, 'test', owner);
function play(s: MatchState, cardId: string): GameEvent[] {
  const ev: GameEvent[] = [];
  resolveGroup(s, ev, [{ caster: 'p1', cardId, target: null }]);
  return ev;
}

describe('cards that hit several players (2026-10-15)', () => {
  it('moves each opponent back; the caster stays', () => {
    const s = match([10, 20, 30, 40]);
    const ev = play(s, 'quake');
    expect(positions(s)).toEqual([10, 17, 27, 37]);
    expect(resolved(ev)).toMatchObject({ result: 'hit', target: null, targets: ['p2', 'p3', 'p4'], blocked: [] });
  });

  it('lets each shield block it for its owner alone', () => {
    const s = match([10, 20, 30, 40]);
    shield(s, 'p3');
    const ev = play(s, 'quake');
    expect(positions(s)).toEqual([10, 17, 30, 37]);
    expect(resolved(ev)).toMatchObject({ result: 'hit', targets: ['p2', 'p4'], blocked: ['p3'] });
    expect(s.effects).toEqual([]);
  });

  it('is blocked when every shield holds, each spent once', () => {
    const s = match([10, 20, 30, 40]);
    for (const p of ['p2', 'p3', 'p4']) shield(s, p);
    const ev = play(s, 'quake');
    expect(positions(s)).toEqual([10, 20, 30, 40]);
    expect(resolved(ev)).toMatchObject({ result: 'blocked', targets: [], blocked: ['p2', 'p3', 'p4'] });
    expect(s.effects).toEqual([]);
  });

  it('moves everyone, the caster too, never below tile 0', () => {
    const s = match([1, 2, 30, 40]);
    const ev = play(s, 'retreat');
    expect(positions(s)).toEqual([0, 0, 28, 38]);
    expect(resolved(ev).targets).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it("can't change the board", () => {
    const bad: CatalogCard = { ...quake, id: 'bad', effects: [{ op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 1, maxAhead: 6, length: 8, lifetime: { rounds: 3 } }] };
    expect(() => resolveConfig({ seed: 's', cards: [...cards, bad] })).toThrow(/A card that hits several players can't change the board yet/);
  });

  it("can't swap places: it would clash with itself and always fizzle (2026-10-16)", () => {
    const swap: CatalogCard = { ...quake, id: 'swap-all', effects: [{ op: 'swap' }] };
    const gambleSwap: CatalogCard = { ...quake, id: 'swap-maybe', effects: [{ op: 'gamble', outcomes: [{ weight: 1, ops: [{ op: 'swap' }] }, { weight: 1, ops: [{ op: 'moveRelative', amount: 1 }] }] }] };
    expect(() => resolveConfig({ seed: 's', cards: [...cards, swap] })).toThrow(/A card that hits several players can't swap places/);
    expect(() => resolveConfig({ seed: 's', cards: [...cards, gambleSwap] })).toThrow(/A card that hits several players can't swap places/);
  });

  it('says "each opponent" and "everyone"', () => {
    expect(describeCard(quake)).toBe('Each opponent moves back 3.');
    expect(describeCard(retreat, { n: 2 })).toBe('EVERYONE moves back 2.');
  });
});
