import type { FromHost, MatchStats } from '@laddorious/host';
import type { PlayerAction, SeatInfo } from '../service/matchService';

/** Main thread → host worker (spec #2 §4.4). Plain objects, so they survive structured cloning. */
export type ToHost =
  | {
      type: 'create';
      seats: SeatInfo[];
      seed: string;
      rngSeed: string;
      /** e2e builds: every seat plays itself, fast (spec #2 §9.3). */
      fast?: boolean;
      /** Match stats (2026-10-17): this device's key and the game's version; the worker reports the match as it ends. */
      stats?: { playerKey: string; version: string };
    }
  | { type: 'action'; action: PlayerAction; windowId: number }
  | { type: 'playbackDone'; windowId: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'leave' };

/** Host worker → main thread: only what a remote player would receive (spec #2 §4.2). */
export type { FromHost } from '@laddorious/host';

/** Everything the worker sends: the host's messages, and the match's stats as it ends (2026-10-17). */
export type FromWorker = FromHost | { type: 'stats'; stats: MatchStats };

/** The part of a Worker that the session uses, so tests can stand in for one. */
export interface HostWorker {
  postMessage(msg: ToHost): void;
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  terminate(): void;
}
