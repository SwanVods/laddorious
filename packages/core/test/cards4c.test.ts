import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, describeCard, statusOf } from '../src/index';

const TEXTS: Record<string, string> = {
  afterburner: 'Next time you ride a rocket, move forward 3–8 more.',
  'misery-loves-company': 'For 3 rounds: if you hit a whirlpool, everyone else moves back 2.',
  'rising-tide': 'For 3 rounds: if you ride a rocket, everyone else moves forward 2.',
  'high-roller': 'If your next roll is over 3, go to the nearest rocket. If not, stay put.',
  'odd-luck': 'If your next roll is odd, it is doubled.',
  'odd-fortune': 'If your next roll is odd, it is tripled.',
  'even-keel': 'If your next roll is even, block the next whirlpool or attack (2 rounds).',
  'even-stevens': 'If your next roll is even, block the next 2 whirlpools or attacks (3 rounds).',
  'even-fortress': 'If your next roll is even, block the next 3 whirlpools or attacks (5 rounds).',
};

describe('batch 4c cards (2026-10-16)', () => {
  it('switches the 9 cards on, with the texts from the catalogue', () => {
    for (const [id, text] of Object.entries(TEXTS)) {
      const card = CARD_CATALOG.cards.find((c) => c.id === id)!;
      expect(statusOf(card), id).toBe('on');
      expect(card.plan, id).toBeUndefined();
      expect(describeCard(card), id).toBe(text);
    }
  });
});
