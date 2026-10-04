import type { InputError, PlayerId } from '@laddorious/core';
import type { FromHost, HostWorker, ToHost } from '../worker/protocol';
import type { MatchSession, MatchUpdate, PlayerAction, SeatInfo } from './matchService';

/** Fans values out to listeners. Values that arrive before the first listener are held for it. */
class Channel<T> {
  private readonly listeners = new Set<(value: T) => void>();
  private held: T[] | null = [];

  emit(value: T): void {
    if (this.held) this.held.push(value);
    else for (const cb of this.listeners) cb(value);
  }

  on(cb: (value: T) => void): () => void {
    this.listeners.add(cb);
    const held = this.held ?? [];
    this.held = null;
    for (const value of held) cb(value);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

/** The main-thread side of a local match: a MatchSession that talks to the host worker (spec #2 §4.4). */
export class WorkerMatchSession implements MatchSession {
  readonly me: PlayerId;
  private windowId = 0;
  private left = false;
  private readonly updates = new Channel<MatchUpdate>();
  private readonly rejections = new Channel<InputError>();
  private readonly failures = new Channel<{ message: string }>();

  /** Starts the match. The seeds go to the worker and are not kept here: the rng seed must stay secret (§4.2). */
  constructor(
    private readonly worker: HostWorker,
    readonly seats: SeatInfo[],
    seeds: { seed: string; rngSeed: string },
  ) {
    this.me = seats.find((s) => !s.bot)!.playerId;
    worker.onmessage = (e) => this.receive(e.data);
    // The worker script itself failed (it could not load, or threw outside the host's guard).
    worker.onerror = (e) => this.failures.emit({ message: e.message || 'the match worker stopped' });
    worker.postMessage({ type: 'create', seats, seed: seeds.seed, rngSeed: seeds.rngSeed });
  }

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    return this.updates.on(cb);
  }

  onRejected(cb: (e: InputError) => void): () => void {
    return this.rejections.on(cb);
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    return this.failures.on(cb);
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
    this.worker.terminate();
  }

  private post(msg: ToHost): void {
    if (!this.left) this.worker.postMessage(msg);
  }

  private receive(msg: FromHost): void {
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
