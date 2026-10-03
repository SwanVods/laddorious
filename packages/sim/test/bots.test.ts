import { describe, expect, it } from 'vitest';
import { STARTER_CARDS, cardById, createMatch, createStream, viewFor, type MatchState } from '@laddorious/core';
import { HeuristicBot, RandomBot, makeBots, scoreCard } from '../src/bots';

const seats = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];

describe('bots', () => {
  it('only see their own view and roll in the dice phase', () => {
    const s = createMatch({ seed: 'b' }, seats);
    expect(new HeuristicBot(createStream('h'), STARTER_CARDS).decide(viewFor(s, 'p1'))).toEqual({ type: 'roll', player: 'p1' });
    expect(new RandomBot(createStream('r')).decide(viewFor(s, 'p2'))).toEqual({ type: 'roll', player: 'p2' });
  });

  it('heuristic declines a bonus roll that could overshoot', () => {
    const s: MatchState = createMatch({ seed: 'b' }, seats);
    if (s.phase.kind === 'dice') s.phase.seqs['p1'] = { faces: [6], status: 'bonusPending' };
    const bot = () => new HeuristicBot(createStream('h'), STARTER_CARDS);
    s.players[0]!.position = 90;
    expect(bot().decide(viewFor(s, 'p1'))).toEqual({ type: 'bonusChoice', player: 'p1', rollAgain: false });
    s.players[0]!.position = 50;
    expect(bot().decide(viewFor(s, 'p1'))).toEqual({ type: 'bonusChoice', player: 'p1', rollAgain: true });
  });

  it('scoreCard values cards in rough tiles', () => {
    const view = viewFor(createMatch({ seed: 'b' }, seats), 'p1');
    expect(scoreCard(cardById(STARTER_CARDS, 'sprint'), view)).toBe(3);
    expect(scoreCard(cardById(STARTER_CARDS, 'coin-flip'), view)).toBe(0);
    expect(scoreCard(cardById(STARTER_CARDS, 'jackpot'), view)).toBeCloseTo(1.2, 10);
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
