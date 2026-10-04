import { createMatch, viewFor } from '@laddorious/core';
import type { MatchUpdate, SeatInfo } from '../../src/service/matchService';
import { LocalHost } from '../../src/worker/localHost';
import type { FromHost, HostWorker, ToHost } from '../../src/worker/protocol';

/** The table a "Play with bots" match makes when you chose the knight. */
export const SEATS: SeatInfo[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', color: '#ff5470', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', color: '#3b82f6', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', color: '#a3e635', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
];

/** Round 1's opening update for SEATS, as the host sends it before playback is done. */
export function openingUpdate(): MatchUpdate {
  const state = createMatch({ seed: 'fixture' }, SEATS.map((s) => ({ id: s.playerId })));
  return { view: viewFor(state, 'p0'), events: [], timer: null };
}

/** Records what the session posts; `reply` and `crash` play the worker's side. */
export class FakeWorker implements HostWorker {
  posted: ToHost[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<FromHost>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  postMessage(msg: ToHost): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(msg: FromHost): void {
    this.onmessage?.({ data: msg } as MessageEvent<FromHost>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

/** A real LocalHost in this thread. Messages are cloned and delivered on a later tick, like postMessage. */
export function loopbackWorker(): HostWorker & { fromHost: FromHost[] } {
  let terminated = false;
  const worker = {
    fromHost: [] as FromHost[],
    onmessage: null as ((e: MessageEvent<FromHost>) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
    postMessage(msg: ToHost): void {
      const copy = structuredClone(msg);
      setTimeout(() => {
        if (!terminated) host.handle(copy);
      }, 0);
    },
    terminate(): void {
      terminated = true;
    },
  };
  const host = new LocalHost((msg) => {
    const copy = structuredClone(msg);
    worker.fromHost.push(copy);
    setTimeout(() => worker.onmessage?.({ data: copy } as MessageEvent<FromHost>), 0);
  });
  return worker;
}
