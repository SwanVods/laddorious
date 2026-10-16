import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, catalogConfig, catalogProblems, createMatch, formatCatalog, resolveConfig, statusOf } from '../src/index';

describe('the card file (2026-10-15)', () => {
  it('has no problems', () => {
    expect(catalogProblems(CARD_CATALOG)).toEqual([]);
  });

  it("holds the user's 66 cards and the two kept off: 53 on, 13 drafts", () => {
    const by = (s: string) => CARD_CATALOG.cards.filter((c) => statusOf(c) === s).length;
    expect(CARD_CATALOG.cards).toHaveLength(68);
    expect([by('on'), by('draft'), by('off')]).toEqual([53, 13, 2]);
    expect(CARD_CATALOG.cards.filter((c) => statusOf(c) === 'draft').every((c) => (c.plan ?? '').length > 0)).toBe(true);
  });

  it("configures a match with the file's cards and odds", () => {
    const cfg = resolveConfig({ seed: 's', ...catalogConfig() });
    expect(cfg.cards).toHaveLength(53);
    expect(cfg.mystery.maxRerolls).toBe(CARD_CATALOG.odds.maxRerolls);
    expect(cfg.board.mysteryRarityWeights).toEqual(CARD_CATALOG.odds.rarityWeights);
    expect(cfg.cards.every((c) => c.text.length > 0 && !c.text.includes('undefined'))).toBe(true);
    expect(() => createMatch({ seed: 's', ...catalogConfig() }, [{ id: 'a' }, { id: 'b' }])).not.toThrow();
  });

  it('writes the file back exactly as it reads', () => {
    const text = formatCatalog(CARD_CATALOG);
    expect(JSON.parse(text)).toEqual(CARD_CATALOG);
    expect(formatCatalog(JSON.parse(text))).toBe(text);
    expect(text.endsWith('\n')).toBe(true);
  });
});
