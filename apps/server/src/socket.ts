import { RateLimit, type Parsed } from './validate';

/** A socket as the plain classes see it: JSON out, and close. Both do nothing once it's closed. */
export interface Conn<Out> {
  send(msg: Out): void;
  close(): void;
}

export interface SocketHandlers<In, Out> {
  parse(raw: unknown): Parsed<In>;
  open?(conn: Conn<Out>): void;
  receive(conn: Conn<Out>, msg: In): void;
  drop(conn: Conn<Out>): void;
}

/**
 * Accepts a WebSocket upgrade (standard API, spec #4 M8) and wires its frames through the
 * checks (spec #4 §7): over 30 a second or malformed closes the socket, unknown types are
 * ignored, and the rest reach the handlers. `drop` runs once, however the socket ends.
 */
export function acceptSocket<In, Out>(request: Request, handlers: SocketHandlers<In, Out>): Response {
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  const conn: Conn<Out> = {
    send: (msg) => {
      try {
        server.send(JSON.stringify(msg));
      } catch {
        // already closed
      }
    },
    close: () => {
      try {
        server.close(1000, 'bye');
      } catch {
        // already closed
      }
    },
  };
  const limit = new RateLimit();
  let dropped = false;
  const drop = () => {
    if (dropped) return;
    dropped = true;
    handlers.drop(conn);
  };
  handlers.open?.(conn);
  server.addEventListener('message', (event) => {
    if (dropped) return;
    const parsed: Parsed<In> = limit.hit(Date.now()) ? handlers.parse(event.data) : { kind: 'close', reason: 'too many messages' };
    if (parsed.kind === 'ok') {
      handlers.receive(conn, parsed.msg);
    } else if (parsed.kind === 'close') {
      conn.close();
      drop();
    }
  });
  server.addEventListener('close', () => {
    conn.close(); // answer the game's close
    drop();
  });
  server.addEventListener('error', drop);
  return new Response(null, { status: 101, webSocket: client });
}
