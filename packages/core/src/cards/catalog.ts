import type { Board, Rarity } from '../board/types';
import { pickWeighted, type RngStream } from '../rng/stream';
import { CARD_TYPES, type CardDef, type CardType, type EffectOp } from './types';

export function cardById(cards: readonly CardDef[], id: string): CardDef {
  const c = cards.find((card) => card.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}

/** The fixed tiles a card's steps send players to ("move to tile N"), a gamble's outcomes included. */
function fixedTiles(ops: readonly EffectOp[]): number[] {
  return ops.flatMap((op) => (op.op === 'moveTo' && op.rule === 'tile' && op.tile !== undefined ? [op.tile] : op.op === 'gamble' ? op.outcomes.flatMap((o) => fixedTiles(o.ops)) : []));
}

/**
 * The cards that are out on this board (the user, 2026-10-16): a card that sends players to a fixed tile, while a
 * rocket or whirlpool starts on that tile. Everyone would land there and ride it, so it isn't dealt, and fizzles if
 * played.
 */
export function blockedByBoard(cards: readonly CardDef[], board: Pick<Board, 'jumps'>): string[] {
  const starts = new Set(board.jumps.map((j) => j.from));
  return cards.filter((c) => fixedTiles(c.effects).some((t) => starts.has(t))).map((c) => c.id);
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
