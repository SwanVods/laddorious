import { describe, expect, it } from 'vitest';
import { InvariantError, awaiting, step, type EffectTemplate, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { assertInvariants } from '../src/engine/invariants';
import { drawValues, makeBoard, ofType, offerValues, pick, play, positions, reroll, roll, setup, timeout } from './support/fixtures';

function withEffect(s: MatchState, owner: string, template: EffectTemplate): MatchState {
  addEffect(s, [], owner, template, 'test', owner);
  return s;
}

const board = makeBoard(100, [[20, 50]], { 4: 'common', 6: 'common', 9: 'epic' });

describe('Mystery detection and offers', () => {
  it('offers 3 private cards of the tile rarity to a player who landed on a Mystery tile', () => {
    const s = setup({ board, dice: [[4], [1]], cards: [offerValues('sprint', 'shove', 'coin-flip')] });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'MysteryOffered')).toEqual([
      { type: 'MysteryOffered', player: 'p1', tile: 4, rarity: 'common', cards: ['sprint', 'shove', 'coin-flip'], visibility: { private: 'p1' } },
    ]);
    expect(awaiting(state)).toMatchObject({ window: 'mystery', players: ['p1'], durationMs: 15_000 });
  });

  it('does not re-trigger a Mystery tile for a player who did not move this round (D20)', () => {
    let s = setup({ board, positions: [4, 0], dice: [[2], [6]], cards: [[], offerValues('sprint', 'shove', 'coin-flip')] });
    s = withEffect(s, 'p1', { params: { hook: 'diceTotal', op: 'replace', value: 0 }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([4, 6]);
    expect(ofType(events, 'MysteryOffered').map((e) => e.player)).toEqual(['p2']);
  });
});

describe('rerolls', () => {
  const start = () =>
    play(
      setup({
        board,
        dice: [[4], [1]],
        cards: [
          [
            ...offerValues('sprint', 'shove', 'coin-flip'),
            ...drawValues('cleanse', ['sprint', 'shove', 'coin-flip']),
            ...drawValues('steady-hand', ['sprint', 'cleanse', 'coin-flip', 'shove']),
          ],
        ],
      }),
      [roll('p1'), roll('p2')],
    ).state;

  it('replace exactly one card each, privately', () => {
    const { state, events } = play(start(), [reroll('p1', 1)]);
    expect(ofType(events, 'CardRerolled')).toEqual([
      { type: 'CardRerolled', player: 'p1', slot: 1, from: 'shove', to: 'cleanse', visibility: { private: 'p1' } },
    ]);
    expect(state.phase.kind === 'mysterySelect' && state.phase.offers['p1']!.cards).toEqual(['sprint', 'cleanse', 'coin-flip']);
  });

  it('allow each slot once and at most 2 in total', () => {
    const s = play(start(), [reroll('p1', 1)]).state;
    expect(step(s, reroll('p1', 1)(s))).toMatchObject({ ok: false, error: { code: 'SLOT_ALREADY_REROLLED' } });
    const s2 = play(s, [reroll('p1', 2)]).state;
    expect(step(s2, reroll('p1', 0)(s2))).toMatchObject({ ok: false, error: { code: 'REROLL_LIMIT' } });
    expect(step(s, reroll('p1', 3)(s))).toMatchObject({ ok: false, error: { code: 'INVALID_SLOT' } });
  });

  it('never bring back a card in the hand or one already seen in it (polish spec 3.2)', () => {
    const s = play(start(), [reroll('p1', 1), reroll('p1', 2)]).state;
    const offer = s.phase.kind === 'mysterySelect' ? s.phase.offers['p1']! : null;
    expect(offer?.cards).toEqual(['sprint', 'cleanse', 'steady-hand']);
    expect(offer?.seen).toEqual(['sprint', 'shove', 'coin-flip', 'cleanse', 'steady-hand']);
  });

  it('deal three different cards, and each reroll brings a card not seen before while one is left', () => {
    for (let i = 0; i < 60; i++) {
      let s = play(setup({ board, config: { rngSeed: `deal-${i}` }, dice: [[4], [1]] }), [roll('p1'), roll('p2')]).state;
      const hand = () => (s.phase.kind === 'mysterySelect' ? s.phase.offers['p1']! : null)!;
      expect(new Set(hand().cards).size).toBe(3);
      for (const slot of [0, 1]) {
        const seenBefore = [...hand().seen];
        s = play(s, [reroll('p1', slot)]).state;
        expect(new Set(hand().cards).size).toBe(3);
        expect(seenBefore).not.toContain(hand().cards[slot]);
      }
    }
  });

  it('fall back to a card seen earlier when the rarity has run out, never to a duplicate', () => {
    // 5 Rare cards: a hand of 3 and 2 rerolls show them all, so the third reroll must reuse one.
    const rare = makeBoard(100, [[20, 50]], { 4: 'rare' });
    for (let i = 0; i < 20; i++) {
      let s = play(setup({ board: rare, config: { rngSeed: `fallback-${i}`, mystery: { maxRerolls: 3 } }, dice: [[4], [1]] }), [roll('p1'), roll('p2')]).state;
      const hand = () => (s.phase.kind === 'mysterySelect' ? s.phase.offers['p1']! : null)!;
      s = play(s, [reroll('p1', 0), reroll('p1', 1)]).state;
      expect(new Set(hand().seen).size).toBe(5);
      const rerolledAway = hand().seen.filter((id) => !hand().cards.includes(id));
      s = play(s, [reroll('p1', 2)]).state;
      expect(new Set(hand().cards).size).toBe(3);
      expect(rerolledAway).toContain(hand().cards[2]);
    }
  });

  it('a hand holding the same card twice breaks an invariant', () => {
    const s = start();
    const offer = s.phase.kind === 'mysterySelect' ? s.phase.offers['p1']! : null;
    offer!.cards[1] = offer!.cards[0];
    expect(() => assertInvariants(s)).toThrow(InvariantError);
  });

  it('are refused after the player picked, and for players without an encounter', () => {
    const s = start();
    expect(step(s, reroll('p2', 0)(s))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
  });
});

describe('selection and reveal', () => {
  const twoEncounters = () =>
    play(
      setup({ board, dice: [[4], [6]], cards: [offerValues('sprint', 'shove', 'coin-flip'), [...offerValues('snake-charm', 'steady-hand', 'cleanse'), 2]] }),
      [roll('p1'), roll('p2')],
    ).state;

  it('reveals all picks together once everyone has picked (D21)', () => {
    const s = twoEncounters();
    const first = play(s, [pick('p1', 0)]);
    expect(ofType(first.events, 'CardSelected')).toEqual([]);
    expect(step(first.state, pick('p1', 1)(first.state))).toMatchObject({ ok: false, error: { code: 'ALREADY_PICKED' } });
    const second = play(first.state, [pick('p2', 2)]);
    expect(ofType(second.events, 'CardSelected').map((e) => [e.player, e.cardId, e.auto])).toEqual([
      ['p1', 'sprint', false],
      ['p2', 'cleanse', false],
    ]);
    expect(positions(second.state)).toEqual([7, 6]); // Sprint +3
  });

  it('a timeout picks a random displayed card', () => {
    const s = twoEncounters();
    const { events } = play(s, [pick('p1', 0), timeout]);
    expect(ofType(events, 'CardSelected')[1]).toMatchObject({ player: 'p2', cardId: 'cleanse', auto: true, visibility: 'public' });
  });

  it('resolves an epic Ladder Warp: move to the ladder foot, then climb', () => {
    const s = play(
      setup({ board, positions: [3, 0], dice: [[6], [1]], cards: [offerValues('ladder-warp', 'overdrive', 'aegis')] }),
      [roll('p1'), roll('p2')],
    ).state;
    expect(positions(s)).toEqual([9, 1]);
    const { state } = play(s, [pick('p1', 0)]);
    expect(positions(state)).toEqual([50, 1]);
  });
});

describe('cards across the round', () => {
  it('a player knocked off N by an Attack card before round end does not win', () => {
    const s = setup({ board: makeBoard(100, [], { 3: 'common' }), positions: [96, 0], dice: [[4], [3]], cards: [[], offerValues('shove', 'sprint', 'coin-flip')] });
    const { state } = play(s, [roll('p1'), roll('p2'), pick('p2', 0)]);
    expect(positions(state)).toEqual([97, 3]);
    expect(state.phase.kind).toBe('dice');
    expect(state.round).toBe(2);
  });

  it('a temporary board edit is reverted when its lifetime ends', () => {
    const s = setup({
      board: makeBoard(100, [], { 3: 'epic' }),
      positions: [0, 50],
      dice: [[3, 1, 1], [1, 1, 1]],
      cards: [offerValues('ladder-drop', 'overdrive', 'aegis')],
    });
    const r1 = play(s, [roll('p1'), roll('p2'), pick('p1', 0)]);
    expect(r1.state.board.jumps).toEqual([{ id: expect.any(String), from: 5, to: 20 }]);
    const r2 = play(r1.state, [roll('p1'), roll('p2')]);
    expect(r2.state.board.jumps).toHaveLength(1); // created in round 1 with rounds: 2 → removed at the end of round 3
    const r3 = play(r2.state, [roll('p1'), roll('p2')]);
    expect(ofType(r3.events, 'BoardEditExpired')).toHaveLength(1);
    expect(r3.state.board.jumps).toEqual([]);
  });
});
