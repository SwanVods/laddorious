import type { InputError, PlayerId } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, Profile, Seat } from './types';

// The messages between the game and the multiplayer server (spec #4 §6): JSON text frames,
// one object with a `type` each.

/** Bumped whenever these messages change. The game and the server are built from the same commit. */
export const PROTOCOL_VERSION = 1;

/** Why the server ended a lobby or match connection. */
export type FailReason = 'version' | 'bad-token' | 'seat-lost' | 'server-error';

/** Game → server on /lobby. `hello` comes first. */
export type LobbyIn =
  | { type: 'hello'; version: number; profile: Profile }
  | { type: 'find' }
  | { type: 'cancel' }
  | { type: 'playWithBots' }
  | { type: 'ping'; t: number };

/** Server → game on /lobby. `seats` are in table order; `you` is your own seat's index in it. */
export type LobbyOut =
  | { type: 'matchmaking'; state: 'searching' | 'filling'; seats: Array<Seat | null>; you: number; elapsedMs: number }
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
