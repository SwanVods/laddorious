import { describe, expect, it } from 'vitest';
import { createMatch, viewFor } from '@laddorious/core';
import * as bots from '../src/index';

describe('@laddorious/bots entry point', () => {
  it('exposes both policies, the factory and the card scorer', () => {
    expect(Object.keys(bots).sort()).toEqual(['HeuristicBot', 'RandomBot', 'makeBots', 'scoreCard']);
  });

  it('makes one bot per seat that acts on a real player view', () => {
    const seats = [{ id: 'p1' }, { id: 'p2' }];
    const made = bots.makeBots(seats, 'heuristic', 'seed', 0);
    expect(Object.keys(made)).toEqual(['p1', 'p2']);
    const s = createMatch({ seed: 'b' }, seats);
    expect(made['p1']!.decide(viewFor(s, 'p1'))).toEqual({ type: 'roll', player: 'p1', windowId: 1 });
  });
});
