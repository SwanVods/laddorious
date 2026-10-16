import type { InputError, PlayerId } from '@laddorious/core';
import type { FromWorker, HostWorker, ToHost } from '../worker/protocol';
import type { OfflineStats } from './stats';

/** On leave, how long the session waits for the worker's last stats report before stopping it (2026-10-17). */
export const STATS_WAIT_MS = 1000;
import { Channel } from './channel';
import type { MatchFailure, MatchSession, MatchUpdate, PlayerAction, SeatInfo } from './matchService';

/** The main-thread side of a local match: a MatchSession that talks to the host worker (spec #2 §4.4). */
export class WorkerMatchSession implements MatchSession {
  readonly me: PlayerId;
  private windowId = 0;
  private left = false;
  private reported = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly updates = new Channel<MatchUpdate>();
  private readonly rejections = new Channel<InputError>();
  private readonly failures = new Channel<MatchFailure>();
  private readonly presence = new Channel<PlayerId[]>();

  /** Starts the match. The seeds go to the worker and are not kept here: the rng seed must stay secret (§4.2). */
  constructor(
    private readonly worker: HostWorker,
    readonly seats: SeatInfo[],
    seeds: { seed: string; rngSeed: string },
    /** e2e builds: the host plays every seat itself, fast (spec #2 §9.3). */
    fast = false,
    /** Match stats (2026-10-17): the worker reports the match as it ends, and this passes it on. */
    private readonly stats?: OfflineStats,
  ) {
    this.me = seats.find((s) => !s.bot)!.playerId;
    worker.onmessage = (e) => this.receive(e.data);
    // The worker script itself failed (it could not load, or threw outside the host's guard).
    worker.onerror = (e) => this.failures.emit({ message: e.message || 'the match worker stopped' });
    worker.postMessage({ type: 'create', seats, seed: seeds.seed, rngSeed: seeds.rngSeed, fast, ...(stats ? { stats: { playerKey: stats.playerKey, version: stats.version } } : {}) });
  }

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    return this.updates.on(cb);
  }

  onRejected(cb: (e: InputError) => void): () => void {
    return this.rejections.on(cb);
  }

  onFailed(cb: (e: MatchFailure) => void): () => void {
    return this.failures.on(cb);
  }

  /** Nobody is ever away in a local match: this channel never speaks. */
  onPresence(cb: (away: PlayerId[]) => void): () => void {
    return this.presence.on(cb);
  }

  send(action: PlayerAction): void {
    this.post({ type: 'action', action, windowId: this.windowId });
  }

  playbackDone(windowId: number): void {
    this.post({ type: 'playbackDone', windowId });
  }

  pause(): void {
    this.post({ type: 'pause' });
  }

  resume(): void {
    this.post({ type: 'resume' });
  }

  leave(): void {
    this.post({ type: 'leave' });
    this.left = true;
    // The worker reports an unfinished match as it stops: wait for that, but not for long.
    if (this.stats && !this.reported) this.stopTimer = setTimeout(() => this.worker.terminate(), STATS_WAIT_MS);
    else this.worker.terminate();
  }

  private post(msg: ToHost): void {
    if (!this.left) this.worker.postMessage(msg);
  }

  private receive(msg: FromWorker): void {
    if (msg.type === 'stats') {
      this.reported = true;
      this.stats?.report(msg.stats);
      if (this.left) {
        if (this.stopTimer !== null) clearTimeout(this.stopTimer);
        this.worker.terminate();
      }
      return;
    }
    if (this.left) return;
    switch (msg.type) {
      case 'update':
        this.windowId = msg.update.view.awaiting.windowId;
        this.updates.emit(msg.update);
        return;
      case 'rejected':
        this.rejections.emit(msg.error);
        return;
      case 'failed':
        this.failures.emit({ message: msg.message });
        return;
    }
  }
}
