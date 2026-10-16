import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, describeCard, statusOf } from '../src/index';

const TEXTS: Record<string, string> = {
  pitfall: 'The leader drops into the nearest whirlpool.',
  crossroads: '50%: back to the rocket behind you. 50%: on to the next whirlpool.',
  'catch-up': 'Move to the tile of the player just ahead of you.',
  overtake: 'Move to 1 tile ahead of the player just ahead of you.',
  'fresh-start': 'EVERYONE moves to tile 30.',
  'fair-and-square': 'EVERYONE moves to tile 50.',
  'final-battle': 'EVERYONE moves to tile 90.',
  'no-trespassing': 'For 5 rounds: anyone who lands on your tile is knocked back, as if they lost a face-off.',
  'sore-loser': 'Next time you lose a face-off, move forward instead of back.',
  'booby-trap': 'A new whirlpool, 8 tiles long, appears 1–6 tiles behind you (3 rounds).',
  'upside-down': 'Every whirlpool becomes a rocket, and every rocket a whirlpool, for the rest of the match.',
  encore: 'Roll again this round.',
  'second-thoughts': 'Your next card hand: one more reroll on each card.',
};

describe('batch 4d cards (2026-10-16)', () => {
  it('switches the last 13 cards on: every card from the list is playable', () => {
    for (const [id, text] of Object.entries(TEXTS)) {
      const card = CARD_CATALOG.cards.find((c) => c.id === id)!;
      expect(statusOf(card), id).toBe('on');
      expect(card.plan, id).toBeUndefined();
      expect(describeCard(card), id).toBe(text);
    }
    expect(CARD_CATALOG.cards.filter((c) => statusOf(c) === 'draft')).toEqual([]);
  });
});
