import { describe, expect, it } from 'vitest';
import { STARTER_CARDS, cardById, createMatch, createStream, viewFor, type MatchState, type PlayerView } from '@laddorious/core';
import { HeuristicBot, RandomBot, makeBots, scoreCard } from '../src/index';

const seats = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];

describe('bots', () => {
  it('only see their own view and roll in the dice phase', () => {
    const s = createMatch({ seed: 'b' }, seats);
    expect(new HeuristicBot(createStream('h'), STARTER_CARDS).decide(viewFor(s, 'p1'))).toEqual({ type: 'roll', player: 'p1', windowId: 1 });
    expect(new RandomBot(createStream('r')).decide(viewFor(s, 'p2'))).toEqual({ type: 'roll', player: 'p2', windowId: 1 });
  });

  it('both policies roll when awaited and idle once they have rolled', () => {
    const s: MatchState = createMatch({ seed: 'b' }, seats);
    if (s.phase.kind === 'dice') s.phase.seqs['p1'] = { faces: [6], status: 'done' };
    for (const bot of [new RandomBot(createStream('r')), new HeuristicBot(createStream('h'), STARTER_CARDS)]) {
      expect(bot.decide(viewFor(s, 'p1'))).toBe('idle');
      expect(bot.decide(viewFor(s, 'p2'))).toEqual({ type: 'roll', player: 'p2', windowId: 1 });
    }
  });

  it('scoreCard values cards in rough tiles', () => {
    const view = viewFor(createMatch({ seed: 'b' }, seats), 'p1');
    expect(scoreCard(cardById(STARTER_CARDS, 'sprint'), view)).toBe(3);
    expect(scoreCard(cardById(STARTER_CARDS, 'coin-flip'), view)).toBe(0);
    expect(scoreCard(cardById(STARTER_CARDS, 'jackpot'), view)).toBeCloseTo(1.2, 10);
  });

  it('picks a card at random, never rerolling, so every kind of card gets played (the user, 2026-10-15)', () => {
    const base = viewFor(createMatch({ seed: 'b' }, seats), 'p1');
    // Sprint scores high, Coin Flip low: the old heuristic always took Sprint and rerolled Coin Flip.
    const offer = { cards: ['sprint', 'coin-flip', 'jackpot'], picked: null, rerollsUsed: 0, rerolled: [false, false, false] };
    const view = { ...base, phase: { kind: 'mysterySelect' }, myOffer: offer } as unknown as PlayerView;
    const picks = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const input = new HeuristicBot(createStream(`pick-${i}`), STARTER_CARDS).decide(view);
      expect(input).toMatchObject({ type: 'pickCard', player: 'p1' });
      if (input !== 'idle' && input.type === 'pickCard') picks.add(input.slot);
    }
    expect([...picks].sort()).toEqual([0, 1, 2]);
  });

  it('an AFK random bot idles for whole windows', () => {
    const bot = new RandomBot(createStream('afk'), 100);
    expect(bot.decide(viewFor(createMatch({ seed: 'b' }, seats), 'p1'))).toBe('idle');
  });

  it('makeBots builds one reproducible bot per seat', () => {
    const bots = makeBots(seats, 'random', 'x', 0);
    expect(Object.keys(bots)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(bots['p1']).toBeInstanceOf(RandomBot);
    expect(makeBots(seats, 'heuristic', 'x', 0)['p2']).toBeInstanceOf(HeuristicBot);
  });
});
