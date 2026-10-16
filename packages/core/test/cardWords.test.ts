import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, catalogCards } from '../src/cards/catalogData';

// The board shows rockets and whirlpools, so the cards say so too (the user, 2026-10-16).

describe('card words', () => {
  it('names no snakes or ladders in any card a player can see', () => {
    const said = catalogCards(CARD_CATALOG).filter((c) => /snake|ladder|mongoose/i.test(`${c.name} ${c.text}`));
    expect(said.map((c) => `${c.name}: ${c.text}`)).toEqual([]);
  });
});
