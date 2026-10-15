// The browser side of the multiplayer server's sockets (spec #4 §3.3, §6).

/** The part of a WebSocket the online service uses, so tests can stand in for one. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onclose: ((e: CloseEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
}

export type OpenSocket = (url: string) => SocketLike;

/** WebSocket.OPEN. */
export const OPEN = 1;
/** How often a match socket pings the server: the clock offset, and proof it's alive (spec #4 §5.3). */
export const PING_MS = 5000;
export const VERSION_MESSAGE = 'Please reload, the game was updated.';

export const browserSocket: OpenSocket = (url) => new WebSocket(url);

/** What tabs say about a seat (2026-10-15): a reloaded or duplicated tab asks before taking it, and the tab playing it answers. */
export type TabMessage = { type: 'claim' | 'taken'; token: string; from: string };

/** A line to this browser's other tabs (a BroadcastChannel). */
export interface TabChannel {
  post(msg: TabMessage): void;
  onMessage(cb: (msg: TabMessage) => void): void;
  close(): void;
}

/** This browser's tabs, or null where BroadcastChannel isn't there (a test, an old browser). */
export const browserTabs = (): TabChannel | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel('laddorious.seat');
  return {
    post: (msg) => channel.postMessage(msg),
    onMessage: (cb) => {
      channel.onmessage = (e: MessageEvent<TabMessage>) => cb(e.data);
    },
    close: () => channel.close(),
  };
};

/** Sends one message as JSON if the socket is open; otherwise it's dropped. */
export function sendJson(ws: SocketLike | null, msg: unknown): void {
  if (ws?.readyState === OPEN) ws.send(JSON.stringify(msg));
}

/** A text frame's JSON, or null. */
export function readJson<T>(data: unknown): T | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/** Closes a socket without hearing from it again. */
export function quietClose(ws: SocketLike): void {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
  try {
    ws.close();
  } catch {
    // already closed
  }
}
