import { DurableObject } from 'cloudflare:workers';
import type { PlayerId } from '@laddorious/core';
import { randomHex, type MatchIn, type MatchOut, type MatchStats, type Seat } from '@laddorious/host';
import pkg from '../package.json';
import type { Env } from './env';
import type { MatchInfo } from './lobby';
import { MatchRoom } from './room';
import { acceptSocket } from './socket';
import { writeStats } from './stats';
import { parseMatchMessage } from './validate';

/**
 * One match (spec #4 §3.2), around MatchRoom. It lives in memory only (M9): if the object
 * restarts, the match is gone and its players see the error screen.
 */
export class MatchDO extends DurableObject<Env> {
  private room: MatchRoom | null = null;

  /** Called by the lobby over RPC: starts the match with secret random seeds; returns the rejoin tokens. */
  start(seats: Seat[], info: MatchInfo): Record<PlayerId, string> {
    const fast = this.env.FAST === '1';
    // Match stats (2026-10-17), written after the response so the match never waits on the database. Fast e2e matches don't count.
    const stats = fast ? undefined : { mode: info.mode, version: pkg.version, keys: info.keys, onStats: (s: MatchStats) => this.ctx.waitUntil(writeStats(this.env.STATS, s)) };
    this.room = new MatchRoom({ fast, ...(stats ? { stats } : {}) });
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
