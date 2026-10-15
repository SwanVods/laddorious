import type { OpenSocket, SocketLike, TabChannel, TabMessage } from '../../src/service/onlineSocket';
import type { SeatStore } from '../../src/service/savedSeat';

/** A WebSocket whose server side the test plays: what the game sent, and open, reply and drop. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  reply(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent);
  }

  /** The connection drops, or never opens. */
  drop(): void {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }
}

/** Opens FakeSockets and keeps them in order. */
export function fakeSockets() {
  const made: FakeSocket[] = [];
  const open: OpenSocket = (url) => {
    const socket = new FakeSocket(url);
    made.push(socket);
    return socket;
  };
  return { made, open, last: () => made.at(-1)! };
}

/** A sessionStorage in memory. */
export function memoryStore(): SeatStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** BroadcastChannels between tabs, in memory: each tab's channel hears the others', a moment later, never its own. */
export function memoryTabs() {
  const open: Array<{ listeners: Array<(m: TabMessage) => void>; closed: boolean }> = [];
  return (): TabChannel => {
    const me = { listeners: [] as Array<(m: TabMessage) => void>, closed: false };
    open.push(me);
    return {
      post: (m) => {
        for (const other of open) if (other !== me && !other.closed) setTimeout(() => other.listeners.forEach((cb) => cb(m)), 0);
      },
      onMessage: (cb) => void me.listeners.push(cb),
      close: () => void (me.closed = true),
    };
  };
}
