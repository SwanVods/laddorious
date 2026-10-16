import type { InputErrorCode, PlayerId } from '@laddorious/core';
import type { FailReason, MatchUpdate, PlayerAction, Profile, RoomInfo, Seat } from '@laddorious/host';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService implements it
// with a Web Worker, and OnlineMatchService over the network (spec #4). The match types are
// shared with the host (packages/host).

export { PIECES, type MatchUpdate, type PieceId, type PlayerAction, type Profile } from '@laddorious/host';

/** A seat as the screens show it: the shared seat plus its colour (spec #4 M10). */
export interface SeatInfo extends Seat {
  color: string;
}

export type { RoomInfo } from '@laddorious/host';

export type MatchmakingState =
  | { kind: 'searching'; elapsedMs: number; seats: Array<SeatInfo | null>; room?: RoomInfo } // index 0 = you; room: a private room's code
  | { kind: 'filling'; seats: Array<SeatInfo | null>; room?: RoomInfo } // bots taking empty seats
  | { kind: 'roomError'; message: string } // a room code that seated nobody (2026-10-16)
  | { kind: 'found'; session: MatchSession }
  | { kind: 'cancelled' }
  | { kind: 'unreachable'; message: string }; // the server can't be reached, or runs another version (spec #4 §3.3)

/** Dev builds only: a board seed to reproduce a board (spec #2 §4.4). The online service ignores it. */
export interface FindOptions {
  seed?: string;
}

export interface MatchService {
  findMatch(profile: Profile, opts?: FindOptions): Matchmaking;
  /** Online only: a private room for friends, with a code to share (2026-10-16). */
  createRoom?(profile: Profile): Matchmaking;
  /** Online only: a friend's room, by its code. */
  joinRoom?(profile: Profile, code: string): Matchmaking;
  /** Online only: after a reload, the saved seat's match, or null (spec #4 §3.3). */
  rejoin?(): MatchSession | null;
}

export interface Matchmaking {
  onState(cb: (s: MatchmakingState) => void): () => void;
  cancel(): void; // ignored once filling has started
  playWithBots(): void; // ignored unless searching; idempotent
  /** A private room's host starts it: bots take the empty seats. Ignored for anyone else. */
  startRoom?(): void;
}

/** Why a match ended early (spec #2 §8). Online, the server also says why (spec #4 §6). */
export interface MatchFailure {
  message: string;
  reason?: FailReason;
}

export interface MatchSession {
  me: PlayerId;
  seats: SeatInfo[];
  onUpdate(cb: (u: MatchUpdate) => void): () => void;
  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void;
  onFailed(cb: (e: MatchFailure) => void): () => void;
  /** Who is away (spec #4 §3.3): the server's list, plus me while my connection is down. The local session never reports anyone. */
  onPresence(cb: (away: PlayerId[]) => void): () => void;
  send(action: PlayerAction): void; // the session stamps the current windowId
  playbackDone(windowId: number): void;
  pause(): void; // local only; the online service ignores it
  resume(): void;
  leave(): void;
}
