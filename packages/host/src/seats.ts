import { PIECES, type Profile, type Seat } from './types';

/** The bots' names, in the order they take seats (spec #2 §4.4). */
export const BOT_NAMES = ['Mochi', 'Pip', 'Juno'] as const;
/** Every match has four seats. */
export const TABLE_SIZE = 4;

/**
 * A table's seats (spec #4 §4): the humans first, in join order, then bots in the empty seats.
 * Bots take the pieces no human chose, in picker order. Names and pieces may repeat (M10).
 * Four seats always leave at least as many free pieces as bots.
 */
export function buildSeats(humans: readonly Profile[], botNames: readonly string[] = BOT_NAMES): Seat[] {
  const taken = new Set(humans.map((h) => h.piece));
  const free = PIECES.filter((p) => !taken.has(p));
  const seats: Seat[] = humans.map((h, i) => ({ playerId: `p${i}`, nickname: h.nickname, piece: h.piece, bot: false }));
  for (let b = 0; seats.length < TABLE_SIZE; b++) {
    seats.push({ playerId: `p${seats.length}`, nickname: botNames[b]!, piece: free[b]!, bot: true });
  }
  return seats;
}

/** Random bits as hex (128 by default) from the platform's secure generator: seeds and rejoin tokens. */
export function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}
