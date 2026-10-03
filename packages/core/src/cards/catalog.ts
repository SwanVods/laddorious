import type { Rarity } from '../board/types';
import { pickWeighted, type RngStream } from '../rng/stream';
import { CARD_TYPES, type CardDef, type CardType } from './types';

export function cardById(cards: readonly CardDef[], id: string): CardDef {
  const c = cards.find((card) => card.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}

/**
 * Draw one card of `rarity` (spec §5.2): first a type by `typeWeights`, then a
 * card of that (type, rarity) bucket by card weight. `excludeId` is never drawn.
 */
export function drawCard(
  cards: readonly CardDef[],
  rarity: Rarity,
  typeWeights: Record<CardType, number>,
  stream: RngStream,
  excludeId?: string,
): string {
  const buckets = CARD_TYPES.map((type) =>
    cards.filter((c) => c.type === type && c.rarity === rarity && c.id !== excludeId),
  );
  const weights = CARD_TYPES.map((type, i) => (buckets[i]!.length > 0 ? typeWeights[type] : 0));
  const bucket = buckets[pickWeighted(stream, weights)]!;
  return bucket[pickWeighted(stream, bucket.map((c) => c.weight))]!.id;
}
