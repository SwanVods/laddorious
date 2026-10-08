import type { Rarity } from '../board/types';
import { pickWeighted, type RngStream } from '../rng/stream';
import { CARD_TYPES, type CardDef, type CardType } from './types';

export function cardById(cards: readonly CardDef[], id: string): CardDef {
  const c = cards.find((card) => card.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}

/**
 * Draw one card of `rarity` (spec §5.2, polish spec §3.2): first a type by `typeWeights`, then a
 * card of that (type, rarity) bucket by card weight. Cards on `exclude` are never drawn. If the
 * weighted types have nothing left, every type with a card left counts equally. Returns null,
 * without using the stream, when the rarity has no card outside `exclude`.
 */
export function drawCard(
  cards: readonly CardDef[],
  rarity: Rarity,
  typeWeights: Record<CardType, number>,
  stream: RngStream,
  exclude: readonly string[] = [],
): string | null {
  const buckets = CARD_TYPES.map((type) =>
    cards.filter((c) => c.type === type && c.rarity === rarity && !exclude.includes(c.id)),
  );
  if (buckets.every((b) => b.length === 0)) return null;
  let weights = CARD_TYPES.map((type, i) => (buckets[i]!.length > 0 ? typeWeights[type] : 0));
  if (weights.every((w) => w === 0)) weights = buckets.map((b) => (b.length > 0 ? 1 : 0));
  const bucket = buckets[pickWeighted(stream, weights)]!;
  return bucket[pickWeighted(stream, bucket.map((c) => c.weight))]!.id;
}
