import type { InputError, PlayerId } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, Profile, Seat } from './types';

// The messages between the game and the multiplayer server (spec #4 §6): JSON text frames,
// one object with a `type` each.

/** Bumped whenever these messages change. The game and the server are built from the same commit. 3 since private rooms (2026-10-16). */
export const PROTOCOL_VERSION = 3;

/** Why the server ended a lobby or match connection. */
export type FailReason = 'version' | 'bad-token' | 'seat-lost' | 'server-error';

/** Game → server on /lobby. `hello` comes first. */
export type LobbyIn =
  /** `playerKey`: a random id kept on the device, only for match stats (2026-10-17); never sent to other players. */
  | { type: 'hello'; version: number; profile: Profile; playerKey?: string }
  | { type: 'find' }
  | { type: 'cancel' }
  | { type: 'playWithBots' }
  // Private rooms (2026-10-16): open one, join one by its code, and its host starts it.
  | { type: 'createRoom' }
  | { type: 'joinRoom'; code: string }
  | { type: 'startRoom' }
  | { type: 'ping'; t: number };

/** A private room's code, and whether you host it (you can start it). */
export interface RoomInfo {
  code: string;
  host: boolean;
}

/** Why a room code didn't seat you. */
export type RoomErrorReason = 'no-room' | 'full';

/** Server → game on /lobby. `seats` are in table order; `you` is your own seat's index in it. */
export type LobbyOut =
  | { type: 'matchmaking'; state: 'searching' | 'filling'; seats: Array<Seat | null>; you: number; elapsedMs: number; room?: RoomInfo }
  | { type: 'roomError'; reason: RoomErrorReason; message: string }
  | { type: 'found'; matchId: string; me: PlayerId; seats: Seat[]; token: string }
  | { type: 'pong'; t: number; serverTime: number }
  | { type: 'failed'; reason: FailReason; message: string };

/** Game → server on /match/:id. `join` comes first. Actions name no player: the server uses the joined seat (spec #4 §7). */
export type MatchIn =
  | { type: 'join'; token: string }
  | { type: 'action'; action: PlayerAction; windowId: number }
  | { type: 'playbackDone'; windowId: number }
  | { type: 'leave' }
  | { type: 'ping'; t: number };

/** Server → game on /match/:id. */
export type MatchOut =
  | { type: 'welcome'; me: PlayerId; seats: Seat[]; serverTime: number }
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'presence'; away: PlayerId[] }
  | { type: 'pong'; t: number; serverTime: number }
  | { type: 'failed'; reason: FailReason; message: string };
