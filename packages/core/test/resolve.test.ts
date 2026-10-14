import { describe, expect, it } from 'vitest';
import { STARTER_CARDS, type CardDef, type GameEvent, type MatchState, type PendingCard } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { groupPendingCards, resolveGroup } from '../src/engine/resolve';
import { makeBoard, ofType, positions, setup } from './support/fixtures';

function resolve(s: MatchState, group: PendingCard[]): GameEvent[] {
  const ev: GameEvent[] = [];
  resolveGroup(s, ev, group);
  return ev;
}
const card = (caster: string, cardId: string, target: string | null = null): PendingCard => ({ caster, cardId, target });

describe('groupPendingCards', () => {
  it('resolves one card at a time, from the last-placed caster to the leader (2026-10-14)', () => {
    const s = setup({ players: 3, positions: [40, 12, 77] });
    const groups = groupPendingCards(s.players, [card('p1', 'shove'), card('p2', 'sprint'), card('p3', 'cleanse')]);
    expect(groups.map((g) => g.map((c) => c.caster))).toEqual([['p2'], ['p1'], ['p3']]);
  });

  it('breaks a tie on one tile by seat', () => {
    const s = setup({ players: 3, positions: [20, 20, 5] });
    const groups = groupPendingCards(s.players, [card('p2', 'shove'), card('p1', 'sprint'), card('p3', 'cleanse')]);
    expect(groups.map((g) => g.map((c) => c.caster))).toEqual([['p3'], ['p1'], ['p2']]);
  });

  it('lets two swaps aimed at one player both happen, one after the other, with no clash', () => {
    const s = setup({ players: 3, positions: [10, 30, 12] });
    const ev: GameEvent[] = [];
    for (const group of groupPendingCards(s.players, [card('p1', 'switcheroo', 'p2'), card('p3', 'switcheroo', 'p2')])) resolveGroup(s, ev, group);
    expect(ofType(ev, 'Clash')).toEqual([]);
    expect(ofType(ev, 'CardResolved').map((e) => [e.caster, e.result])).toEqual([['p1', 'hit'], ['p3', 'hit']]);
    expect(positions(s)).not.toEqual([10, 30, 12]);
  });
});

describe('resolveGroup', () => {
  it('Shove hits the nearest player ahead', () => {
    const s = setup({ players: 3, positions: [10, 20, 30] });
    const ev = resolve(s, [card('p1', 'shove')]);
    expect(positions(s)).toEqual([10, 17, 30]);
    expect(ofType(ev, 'CardResolved')).toMatchObject([{ caster: 'p1', target: 'p2', result: 'hit' }]);
  });

  it('adds relative moves on the same player from one group', () => {
    const s = setup({ players: 3, positions: [10, 20, 15] });
    resolve(s, [card('p1', 'shove', 'p2'), card('p3', 'shove', 'p2')]);
    expect(positions(s)).toEqual([10, 14, 15]);
  });

  it('cancels conflicting absolute placements with a public Clash (D11)', () => {
    const s = setup({ players: 3, positions: [10, 30, 12] });
    const ev = resolve(s, [card('p1', 'switcheroo', 'p2'), card('p3', 'switcheroo', 'p2')]);
    expect(positions(s)).toEqual([10, 30, 12]);
    expect(ofType(ev, 'Clash')).toMatchObject([{ cardIds: ['switcheroo', 'switcheroo'], players: ['p1', 'p2', 'p3'] }]);
    expect(ofType(ev, 'CardResolved').map((e) => [e.result, e.reason])).toEqual([['fizzled', 'clash'], ['fizzled', 'clash']]);
  });

  it('swaps caster and target when there is no clash', () => {
    const s = setup({ players: 2, positions: [10, 30] });
    resolve(s, [card('p1', 'switcheroo', 'p2')]);
    expect(positions(s)).toEqual([30, 10]);
  });

  it('retargets when the locked target no longer meets the condition', () => {
    const s = setup({ players: 3, positions: [10, 20, 5] });
    const ev = resolve(s, [card('p1', 'shove', 'p3')]);
    expect(ofType(ev, 'CardResolved')[0]).toMatchObject({ target: 'p2', result: 'hit' });
    expect(positions(s)).toEqual([10, 17, 5]);
  });

  it('fizzles when no target qualifies', () => {
    const s = setup({ players: 2, positions: [50, 10] });
    const ev = resolve(s, [card('p1', 'shove')]);
    expect(ofType(ev, 'CardResolved')[0]).toMatchObject({ target: null, result: 'fizzled', reason: 'no-target' });
    expect(positions(s)).toEqual([50, 10]);
  });

  it('a shield blocks an attack and spends its charge', () => {
    const s = setup({ players: 2, positions: [10, 20] });
    addEffect(s, [], 'p2', { params: { hook: 'beforeAttack' }, lifetime: { rounds: 3, charges: 1 } }, 'shield', 'p2');
    const ev = resolve(s, [card('p1', 'shove')]);
    expect(ofType(ev, 'CardResolved')[0]).toMatchObject({ result: 'blocked' });
    expect(positions(s)).toEqual([10, 20]);
    expect(s.effects).toHaveLength(0);
  });

  it('Heavy Boots attaches a dice modifier to the leader', () => {
    const s = setup({ players: 3, positions: [10, 40, 20] });
    resolve(s, [card('p1', 'heavy-boots')]);
    expect(s.effects).toMatchObject([{ owner: 'p2', sourcePlayer: 'p1', params: { hook: 'diceTotal', op: 'add', value: -3 } }]);
  });

  it('removeEffects only sees effects that existed before the group (snapshot)', () => {
    const curse: CardDef = {
      id: 'curse', name: 'Curse', text: 'The leader: next dice total −1.', type: 'misc', rarity: 'common', weight: 1,
      target: { condition: 'other', pick: 'leader', tieBreak: 'lowest-seat' },
      effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: -1 }, lifetime: { charges: 1 } } }],
    };
    const s = setup({ players: 2, positions: [30, 10], config: { cards: [...STARTER_CARDS, curse] } });
    addEffect(s, [], 'p1', { params: { hook: 'diceTotal', op: 'add', value: -3 }, lifetime: { charges: 1 } }, 'heavy-boots', 'p2');
    resolve(s, [card('p1', 'cleanse'), card('p2', 'curse')]);
    expect(s.effects.map((e) => [e.owner, e.sourceCard])).toEqual([['p1', 'curse']]);
  });

  it('gambles with integer weights from the misc stream', () => {
    const win = setup({ players: 2, positions: [10, 0], misc: [0] });
    resolve(win, [card('p1', 'coin-flip')]);
    expect(positions(win)).toEqual([14, 0]);
    const lose = setup({ players: 2, positions: [10, 0], misc: [99] });
    resolve(lose, [card('p1', 'coin-flip')]);
    expect(positions(lose)).toEqual([6, 0]);
  });

  it('bounces card movement off the final tile', () => {
    const s = setup({ players: 2, positions: [98, 0] });
    const ev = resolve(s, [card('p1', 'sprint')]);
    expect(positions(s)).toEqual([99, 0]);
    expect(ofType(ev, 'Moved')[0]).toMatchObject({ from: 98, to: 99, cause: 'card', bounced: true });
  });

  it('Snake Pit creates a snake ahead of the leader that only fires on landing (D9)', () => {
    const s = setup({ players: 2, board: makeBoard(100, [], { 22: 'common' }), positions: [5, 20] });
    const ev = resolve(s, [card('p1', 'snake-pit')]);
    expect(s.board.jumps).toEqual([{ id: expect.stringMatching(/^x/), from: 23, to: 15 }]);
    expect(ofType(ev, 'BoardEdited')[0]!.edit).toMatchObject({ sourceCard: 'snake-pit', lifetime: { rounds: 3 }, createdRound: 1 });
    expect(positions(s)).toEqual([5, 20]);
  });

  it('a board edit with no valid placement fizzles', () => {
    const s = setup({ players: 2, positions: [97, 5] });
    const ev = resolve(s, [card('p1', 'ladder-drop')]);
    expect(ofType(ev, 'CardResolved')[0]).toMatchObject({ result: 'fizzled', reason: 'no-placement' });
    expect(s.board.jumps).toEqual([]);
  });
});
