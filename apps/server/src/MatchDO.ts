import { DurableObject } from 'cloudflare:workers';
import type { PlayerId } from '@laddorious/core';
import { randomHex, type MatchIn, type MatchOut, type Seat } from '@laddorious/host';
import type { Env } from './env';
import { MatchRoom } from './room';
import { acceptSocket } from './socket';
import { parseMatchMessage } from './validate';

/**
 * One match (spec #4 §3.2), around MatchRoom. It lives in memory only (M9): if the object
 * restarts, the match is gone and its players see the error screen.
 */
export class MatchDO extends DurableObject<Env> {
  private room: MatchRoom | null = null;

  /** Called by the lobby over RPC: starts the match with secret random seeds; returns the rejoin tokens. */
  start(seats: Seat[]): Record<PlayerId, string> {
    this.room = new MatchRoom({ fast: this.env.FAST === '1' });
    return this.room.start(seats, randomHex(), randomHex());
  }

  override fetch(request: Request): Response {
    return acceptSocket<MatchIn, MatchOut>(request, {
      parse: parseMatchMessage,
      open: (conn) => {
        if (this.room) {
          this.room.open(conn);
          return;
        }
        conn.send({ type: 'failed', reason: 'server-error', message: 'This match is no longer running' });
        conn.close();
      },
      receive: (conn, msg) => this.room?.receive(conn, msg),
      drop: (conn) => this.room?.drop(conn),
    });
  }
}
