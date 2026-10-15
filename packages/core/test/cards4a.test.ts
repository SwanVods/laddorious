import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, STEP_KINDS, TARGETS, describeCard, statusOf, stepKindOf } from '../src/index';

const TEXTS: Record<string, string> = {
  'long-shot': 'Roll a die: the leader moves back that many.',
  tumble: 'Roll a die: the player just ahead of you moves back that many.',
  'lead-weight': "Roll a die: the leader's next roll is lower by that much.",
  'sand-in-the-shoe': 'Roll a die: the next roll of the player just ahead of you is lower by that much.',
  earthquake: 'Roll a die: everyone else moves back that many.',
  retreat: 'Everyone moves back 1–3.',
  forward: 'Everyone moves forward 1–3.',
  'mud-season': "Roll a die: everyone else's next roll is lower by that much.",
  blizzard: "Roll a die: everyone else's rolls are lower by that much (3 rounds).",
  'wind-up': 'Roll a die: add it to your next roll.',
};

describe('batch 4a cards (2026-10-15)', () => {
  it('switches the 10 cards on, with the texts from the catalogue', () => {
    for (const [id, text] of Object.entries(TEXTS)) {
      const card = CARD_CATALOG.cards.find((c) => c.id === id)!;
      expect(statusOf(card), id).toBe('on');
      expect(card.plan, id).toBeUndefined();
      expect(describeCard(card), id).toBe(text);
    }
  });

  it("offers the card's die on Move and Next roll + / −, and both new targets", () => {
    const field = (kind: string, key: string) => STEP_KINDS.find((k) => k.id === kind)!.fields.find((f) => f.key === key)!;
    expect(field('move', 'amount').die).toBe(true);
    expect(field('rollPlus', 'value').die).toBe(true);
    expect(field('rollTimes', 'value').die).toBeUndefined();
    expect(stepKindOf({ op: 'moveRelative', amount: { die: true, negate: true } }).id).toBe('move');
    expect(TARGETS.map(([, label]) => label)).toEqual(expect.arrayContaining(['Everyone else', 'Everyone']));
  });
});
