import type { ChallengeChoice, GameEvent, InputErrorCode, PlayerId, PlayerView } from '@laddorious/core';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService
// implements it with a Web Worker; the online service (Spec #3) will implement it over the network.

export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

/** Piece picker order. Bots take the pieces you didn't choose, in this order (§4.4). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon'];

export interface Profile {
  nickname: string;
  piece: PieceId;
}

export interface SeatInfo {
  playerId: PlayerId;
  nickname: string;
  piece: PieceId;
  color: string;
  bot: boolean;
}

export type MatchmakingState =
  | { kind: 'searching'; elapsedMs: number; seats: Array<SeatInfo | null> } // index 0 = you
  | { kind: 'filling'; seats: Array<SeatInfo | null> } // bots taking empty seats
  | { kind: 'found'; session: MatchSession }
  | { kind: 'cancelled' };

/** Dev builds only: a board seed to reproduce a board (spec #2 §4.4). The online service ignores it. */
export interface FindOptions {
  seed?: string;
}

export interface MatchService {
  findMatch(profile: Profile, opts?: FindOptions): Matchmaking;
}

export interface Matchmaking {
  onState(cb: (s: MatchmakingState) => void): () => void;
  cancel(): void; // ignored once filling has started
  playWithBots(): void; // ignored unless searching; idempotent
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

export interface MatchSession {
  me: PlayerId;
  seats: SeatInfo[];
  onUpdate(cb: (u: MatchUpdate) => void): () => void;
  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void;
  onFailed(cb: (e: { message: string }) => void): () => void;
  send(action: PlayerAction): void; // the session stamps the current windowId
  playbackDone(windowId: number): void;
  pause(): void; // local only; the online service ignores it
  resume(): void;
  leave(): void;
}
