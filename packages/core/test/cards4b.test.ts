import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, describeCard, statusOf } from '../src/index';

const TEXTS: Record<string, string> = {
  'red-light': 'The leader skips their next roll.',
  tripwire: 'The player just ahead of you skips their next roll.',
  'time-freeze': 'Each opponent skips their next roll.',
  'reverse-gear': "The leader's next roll moves them back.",
  'wrong-way': 'The next roll of the player just ahead of you moves them back.',
  'topsy-turvy': "Each opponent's next roll moves them back.",
  'double-or-nothing': '50%: your next roll is doubled. 50%: your next roll moves you back.',
  'lucky-charm': 'Block the next whirlpool or attack, whichever comes first (2 rounds).',
  aegis: 'Block the next 3 whirlpools or attacks, any time this match.',
  'calm-waters': 'Rockets and whirlpools do nothing for 1 round.',
  'still-waters': 'Rockets and whirlpools do nothing for 2 rounds.',
};

describe('batch 4b cards (2026-10-16)', () => {
  it('switches the 11 cards on, with the texts from the catalogue', () => {
    for (const [id, text] of Object.entries(TEXTS)) {
      const card = CARD_CATALOG.cards.find((c) => c.id === id)!;
      expect(statusOf(card), id).toBe('on');
      expect(card.plan, id).toBeUndefined();
      expect(describeCard(card), id).toBe(text);
    }
  });
});
