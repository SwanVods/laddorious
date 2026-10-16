import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, describeCard, resolveConfig, type CatalogCard, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { resolveGroup } from '../src/engine/resolve';
import { setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'random' };
const AHEAD: TargetRule = { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' };
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ id, name: id, type: 'movement', rarity, weight: 1, target: SELF, effects: [{ op: 'moveRelative', amount: 1 }] });
const longShot: CatalogCard = { id: 'long-shot', name: 'Long Shot', type: 'attack', rarity: 'common', weight: 1, target: LEADER, effects: [{ op: 'moveRelative', amount: { die: true, negate: true } }] };
const tumble: CatalogCard = { ...longShot, id: 'tumble', name: 'Tumble', target: AHEAD };
const windUp: CatalogCard = {
  id: 'wind-up', name: 'Wind Up', type: 'movement', rarity: 'common', weight: 1, target: SELF,
  effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: { die: true } }, lifetime: { charges: 1 } } }],
};
const blizzard: CatalogCard = {
  id: 'blizzard', name: 'Blizzard', type: 'attack', rarity: 'common', weight: 1, target: LEADER,
  effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: { die: true, negate: true } }, lifetime: { rounds: 3 } } }],
};
const cards = [longShot, tumble, windUp, blizzard, fill('r', 'rare'), fill('e', 'epic')];

/** Three players; the card's die is scripted to roll a 4. */
const match = (positions: number[]): MatchState => setup({ players: 3, positions, misc: [3], config: { cards } });
const resolved = (ev: GameEvent[]) => ev.find((e) => e.type === 'CardResolved') as Extract<GameEvent, { type: 'CardResolved' }>;
function play(s: MatchState, caster: string, cardId: string): GameEvent[] {
  const ev: GameEvent[] = [];
  resolveGroup(s, ev, [{ caster, cardId, target: null }]);
  return ev;
}

describe("a card's own die (2026-10-15)", () => {
  it('rolls once, moves the target that many, and reports the roll', () => {
    const s = match([10, 40, 20]);
    const ev = play(s, 'p1', 'long-shot');
    expect(resolved(ev)).toMatchObject({ target: 'p2', result: 'hit', roll: 4 });
    expect(s.players[1]!.position).toBe(36);
  });

  it('puts the roll into an effect as a plain number', () => {
    const s = match([10, 40, 20]);
    play(s, 'p1', 'wind-up');
    expect(s.effects[0]!.params).toEqual({ hook: 'diceTotal', op: 'add', value: 4 });
  });

  it('fizzles without rolling when there is nobody to hit', () => {
    const s = match([50, 40, 20]);
    const ev = play(s, 'p1', 'tumble');
    expect(resolved(ev)).toMatchObject({ result: 'fizzled', reason: 'no-target' });
    expect(resolved(ev).roll).toBeUndefined();
    expect(s.rng.misc).toMatchObject({ index: 0 });
  });

  it('keeps a "rolls are lower" effect for its rounds', () => {
    const s = match([10, 40, 20]);
    play(s, 'p1', 'blizzard');
    expect(s.effects[0]).toMatchObject({ owner: 'p2', lifetime: { rounds: 3 }, params: { value: -4 } });
  });

  it('allows the die only in a move and a next-roll add', () => {
    const face: CatalogCard = { ...windUp, id: 'face', effects: [{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: { die: true } as never }, lifetime: { charges: 1 } } }] };
    expect(() => resolveConfig({ seed: 's', cards: [...cards, face] })).toThrow(/the card's die can only be used to move or to add to a roll/);
    const times: CatalogCard = { ...windUp, id: 'times', effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'multiply', value: { die: true } }, lifetime: { charges: 1 } } }] };
    expect(() => resolveConfig({ seed: 's', cards: [...cards, times] })).toThrow(/the card's die can only be used to move or to add to a roll/);
  });

  it('writes "Roll a die:" texts', () => {
    expect(describeCard(longShot)).toBe('Roll a die: the leader moves back that many.');
    expect(describeCard(tumble)).toBe('Roll a die: the player just ahead of you moves back that many.');
    expect(describeCard(windUp)).toBe('Roll a die: add it to your next roll.');
    const sand: CatalogCard = { ...blizzard, target: AHEAD, effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: { die: true, negate: true } }, lifetime: { charges: 1 } } }] };
    expect(describeCard(sand)).toBe('Roll a die: the next roll of the player just ahead of you is lower by that much.');
    expect(describeCard(blizzard)).toBe("Roll a die: the leader's rolls are lower by that much (3 rounds).");
  });
});

describe('Encore (the user, 2026-10-16): its own die moves you on at once', () => {
  it("moves its caster forward by the card's roll, and keeps its text", () => {
    const encore = CARD_CATALOG.cards.find((c) => c.id === 'encore')!;
    const s = setup({ players: 3, positions: [10, 40, 20], misc: [3], config: { cards: [encore, ...cards] } });
    const ev = play(s, 'p1', 'encore');
    expect(resolved(ev)).toMatchObject({ target: 'p1', result: 'hit', roll: 4 });
    expect(s.players[0]!.position).toBe(14);
    expect(s.effects).toEqual([]);
    expect(describeCard(encore)).toBe('Roll again this round.');
  });
});
