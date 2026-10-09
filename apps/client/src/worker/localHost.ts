import type { PlayerId } from '@laddorious/core';
import { MatchHost } from '@laddorious/host';
import type { FromHost, ToHost } from './protocol';

/**
 * The offline match (spec #2 §4.4): the worker's messages for its one human seat, passed to the
 * shared MatchHost (spec #4 §3.1). A plain class so tests can drive it; host.worker.ts runs it.
 */
export class LocalHost {
  private host: MatchHost | null = null;
  private me: PlayerId = '';

  constructor(private readonly post: (msg: FromHost) => void) {}

  handle(msg: ToHost): void {
    if (msg.type === 'create') {
      const human = msg.seats.find((s) => !s.bot);
      if (!human) {
        this.post({ type: 'failed', message: 'a local match needs a human seat' });
        return;
      }
      this.me = human.playerId;
      this.host = new MatchHost({ send: (_to, out) => this.post(out), fast: msg.fast ?? false });
      this.host.create(msg.seats, msg.seed, msg.rngSeed);
      return;
    }
    const host = this.host;
    if (!host) return;
    switch (msg.type) {
      case 'action':
        host.action(this.me, msg.action, msg.windowId);
        return;
      case 'playbackDone':
        host.playbackDone(this.me, msg.windowId);
        return;
      case 'pause':
        host.pause();
        return;
      case 'resume':
        host.resume();
        return;
      case 'leave':
        host.stop();
        return;
    }
  }
}
