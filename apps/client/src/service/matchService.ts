import type { InputErrorCode, PlayerId } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, Profile, Seat } from '@laddorious/host';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService implements it
// with a Web Worker, and OnlineMatchService over the network (spec #4). The match types are
// shared with the host (packages/host).

export { PIECES, type MatchUpdate, type PieceId, type PlayerAction, type Profile } from '@laddorious/host';

/** A seat as the screens show it: the shared seat plus its colour (spec #4 M10). */
export interface SeatInfo extends Seat {
  color: string;
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
