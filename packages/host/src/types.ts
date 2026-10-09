import type { ChallengeChoice, GameEvent, InputError, PlayerId, PlayerView } from '@laddorious/core';

// What a match host and its human seats exchange (spec #4 §3.1). The offline Web Worker and
// the multiplayer server both use these.

export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

/** Piece picker order. Bots take the pieces no human chose, in this order (spec #2 §4.4). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon'];

export interface Profile {
  nickname: string;
  piece: PieceId;
}

/** A seat at the table. Seat colours belong to the client (spec #4 M10). */
export interface Seat {
  playerId: PlayerId;
  nickname: string;
  piece: PieceId;
  bot: boolean;
}

export type PlayerAction =
  | { type: 'roll' }
  | { type: 'challengePick'; challengeId: string; choice: ChallengeChoice }
  | { type: 'reroll'; slot: number }
  | { type: 'pickCard'; slot: number };

export interface MatchUpdate {
  view: PlayerView; // viewFor(state, me) after this step
  events: GameEvent[]; // eventsFor(events, me) produced by this step
  timer: { windowId: number; endsAt: number } | null; // null while waiting for playback or when no window is open
}

/** Host → one human seat: only what that seat may see (spec #2 §4.2). */
export type FromHost =
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'failed'; message: string };
