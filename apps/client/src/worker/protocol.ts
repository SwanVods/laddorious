import type { InputError } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, SeatInfo } from '../service/matchService';

/** Main thread → host worker (spec #2 §4.4). Plain objects, so they survive structured cloning. */
export type ToHost =
  | { type: 'create'; seats: SeatInfo[]; seed: string; rngSeed: string; /** e2e builds: every seat plays itself, fast (spec #2 §9.3). */ fast?: boolean }
  | { type: 'action'; action: PlayerAction; windowId: number }
  | { type: 'playbackDone'; windowId: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'leave' };

/** Host worker → main thread: only what a remote player would receive (§4.2). */
export type FromHost =
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'failed'; message: string };

/** The part of a Worker that the session uses, so tests can stand in for one. */
export interface HostWorker {
  postMessage(msg: ToHost): void;
  onmessage: ((e: MessageEvent<FromHost>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  terminate(): void;
}
