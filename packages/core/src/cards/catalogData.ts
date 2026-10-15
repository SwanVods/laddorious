import type { MatchConfigInput } from '../engine/config';
import { fillCard, statusOf, type CardCatalog, type CatalogCard } from './catalogFile';
import { describeCard } from './describe';
import type { CardDef } from './types';
import data from './cards.json';

// The card file (2026-10-15): the user edits it in the card editor (`pnpm cards`); everything plays it.

export const CARD_CATALOG = data as CardCatalog;

/** A match config's card part: the file's cards and its odds. */
export function catalogConfig(catalog: CardCatalog = CARD_CATALOG): Pick<MatchConfigInput, 'cards' | 'mystery' | 'board'> {
  return {
    cards: catalog.cards,
    mystery: { typeWeights: catalog.odds.typeWeights, maxRerolls: catalog.odds.maxRerolls },
    board: { mysteryRarityWeights: catalog.odds.rarityWeights },
  };
}

/** Every card that isn't a draft, each value at its lowest: for the bots' card sense and the HUD's fallback. */
export function catalogCards(catalog: CardCatalog = CARD_CATALOG): CardDef[] {
  return catalog.cards.filter((c) => statusOf(c) !== 'draft').map((c) => {
    const values = Object.fromEntries(Object.entries(c.values ?? {}).map(([k, r]) => [k, r.min]));
    return { ...fillCard(c, values), text: describeCard(c) };
  });
}

const CARD_KEYS: Array<keyof CatalogCard> = ['id', 'name', 'rarity', 'type', 'status', 'weight', 'icon', 'note', 'plan', 'text', 'target', 'values', 'effects'];

/** The card file's text: two-space JSON, each card's keys in one order, so git diffs stay small. */
export function formatCatalog(catalog: CardCatalog): string {
  const cards = catalog.cards.map((c) => Object.fromEntries(CARD_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])));
  return `${JSON.stringify({ version: catalog.version, odds: catalog.odds, cards }, null, 2)}\n`;
}
