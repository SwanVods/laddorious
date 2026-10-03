import { describe, expect, it } from 'vitest';
import { awaiting, step, type EffectTemplate, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { again, drawValues, makeBoard, ofType, offerValues, pick, play, positions, reroll, roll, setup, stop, timeout } from './support/fixtures';

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
    let s = setup({ board, positions: [4, 0], dice: [[2], [6]], cards: [[], offerValues('sprint', 'sprint', 'sprint')] });
    s = withEffect(s, 'p1', { params: { hook: 'diceTotal', op: 'replace', value: 0 }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1'), roll('p2'), stop('p2')]);
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
        cards: [[...offerValues('sprint', 'shove', 'coin-flip'), ...drawValues('cleanse', 'shove'), ...drawValues('sprint', 'coin-flip')]],
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

  it('are refused after the player picked, and for players without an encounter', () => {
    const s = start();
    expect(step(s, reroll('p2', 0)(s))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
  });
});

describe('selection and reveal', () => {
  const twoEncounters = () =>
    play(
      setup({ board, dice: [[4], [6]], cards: [offerValues('sprint', 'sprint', 'sprint'), [...offerValues('cleanse', 'cleanse', 'cleanse'), 2]] }),
      [roll('p1'), roll('p2'), stop('p2')],
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
      setup({ board, dice: [[6, 3], [1]], cards: [offerValues('ladder-warp', 'ladder-warp', 'ladder-warp')] }),
      [roll('p1'), again('p1'), roll('p2')],
    ).state;
    expect(positions(s)).toEqual([9, 1]);
    const { state } = play(s, [pick('p1', 0)]);
    expect(positions(state)).toEqual([50, 1]);
  });
});

describe('cards across the round', () => {
  it('a player knocked off N by an Attack card before round end does not win', () => {
    const s = setup({ board: makeBoard(100, [], { 3: 'common' }), positions: [96, 0], dice: [[4], [3]], cards: [[], offerValues('shove', 'shove', 'shove')] });
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
      cards: [offerValues('ladder-drop', 'ladder-drop', 'ladder-drop')],
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
