import type { PlayerId } from '@laddorious/core';
import { MatchHost, randomHex, type FromHost, type MatchIn, type MatchOut, type Seat } from '@laddorious/host';

/** A human who hasn't joined this long after the start counts as away (spec #4 §5.1). */
export const JOIN_DEADLINE_MS = 15_000;
/** A socket silent this long (not even a ping) counts as gone (spec #4 §5.2). */
export const SILENCE_MS = 10_000;
/** An away seat can come back for this long. */
export const REJOIN_MS = 60_000;
/** After the win, sockets stay open this long so the end screens can settle. */
export const END_LINGER_MS = 10_000;
/** With nobody connected, the match ends after this long. */
export const EMPTY_MS = 60_000;
/** How often the room looks for silent sockets. */
const SWEEP_MS = 1000;
export const SEAT_LOST_MESSAGE = 'The match carried on without you';

/** One game's match socket, as the room sees it. */
export interface RoomConn {
  send(msg: MatchOut): void;
  close(): void;
}

interface Human {
  seat: Seat;
  /** The socket holding this seat, or null while away. */
  conn: RoomConn | null;
  joined: boolean;
  rejoin: Timer | null;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * One online match (spec #4 §5): a MatchHost, the seats' sockets and rejoin tokens, presence,
 * the rejoin windows, and the end. Plain TypeScript: the match's Durable Object feeds it sockets
 * and checked messages. Actions name no player; each socket acts for the seat it joined (spec #4 §7).
 */
export class MatchRoom {
  private readonly host: MatchHost;
  private seats: Seat[] = [];
  private readonly humans = new Map<PlayerId, Human>();
  /** Live rejoin tokens, and the ones cancelled after 60 s away or a leave. */
  private readonly tokens = new Map<string, PlayerId>();
  private readonly lost = new Set<string>();
  private readonly away = new Set<PlayerId>();
  private readonly conns = new Map<RoomConn, { player: PlayerId | null; heardAt: number }>();
  private readonly timers = new Set<Timer>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private empty: Timer | null = null;
  private won = false;
  private closed = false;

  constructor(opts: { fast?: boolean } = {}) {
    this.host = new MatchHost({ send: (to, msg) => this.fromHost(to, msg), fast: opts.fast, onEnd: (outcome) => this.ended(outcome) });
  }

  /** Starts the match and returns one rejoin token per human seat. */
  start(seats: Seat[], seed: string, rngSeed: string): Record<PlayerId, string> {
    this.seats = seats;
    const tokens: Record<PlayerId, string> = {};
    for (const seat of seats) {
      if (seat.bot) continue;
      const token = randomHex();
      tokens[seat.playerId] = token;
      this.tokens.set(token, seat.playerId);
      this.humans.set(seat.playerId, { seat, conn: null, joined: false, rejoin: null });
    }
    this.sweeper = setInterval(() => this.sweep(), SWEEP_MS);
    this.later(JOIN_DEADLINE_MS, () => {
      for (const [id, human] of this.humans) if (!human.joined) this.goAway(id);
    });
    this.host.create(seats, seed, rngSeed);
    this.checkEmpty(); // nobody has joined yet: the match waits for the first player
    return tokens;
  }

  /** A new socket. Its first message must be join (spec #4 §5.1). */
  open(conn: RoomConn): void {
    if (this.closed) {
      conn.send({ type: 'failed', reason: 'server-error', message: 'This match is no longer running' });
      conn.close();
      return;
    }
    this.conns.set(conn, { player: null, heardAt: Date.now() });
  }

  receive(conn: RoomConn, msg: MatchIn): void {
    const entry = this.conns.get(conn);
    if (!entry) return;
    entry.heardAt = Date.now();
    if (entry.player === null) {
      if (msg.type === 'join') this.join(conn, msg.token);
      else this.kick(conn);
      return;
    }
    switch (msg.type) {
      case 'action':
        this.host.action(entry.player, msg.action, msg.windowId);
        return;
      case 'playbackDone':
        this.host.playbackDone(entry.player, msg.windowId);
        return;
      case 'leave':
        this.goAway(entry.player, true);
        return;
      case 'ping':
        conn.send({ type: 'pong', t: msg.t, serverTime: Date.now() });
        return;
      case 'join':
        return; // already joined
    }
  }

  /** The socket closed. If it still held a seat, that seat is away (spec #4 §5.2). */
  drop(conn: RoomConn): void {
    const entry = this.conns.get(conn);
    if (!entry) return;
    this.conns.delete(conn);
    const human = entry.player === null ? undefined : this.humans.get(entry.player);
    if (human?.conn === conn) {
      human.conn = null;
      this.goAway(human.seat.playerId);
    }
  }

  private join(conn: RoomConn, token: string): void {
    const id = this.tokens.get(token);
    const human = id === undefined ? undefined : this.humans.get(id);
    if (id === undefined || !human) {
      const lost = this.lost.has(token);
      conn.send({ type: 'failed', reason: lost ? 'seat-lost' : 'bad-token', message: lost ? SEAT_LOST_MESSAGE : 'That seat is not at this match' });
      this.kick(conn);
      return;
    }
    if (human.conn) this.kick(human.conn); // a reload's new socket takes the seat over
    human.conn = conn;
    human.joined = true;
    this.conns.get(conn)!.player = id;
    this.cancel(human.rejoin);
    human.rejoin = null;
    conn.send({ type: 'welcome', me: id, seats: this.seats, serverTime: Date.now() });
    if (this.away.delete(id)) this.host.setAway(id, false);
    this.checkEmpty();
    this.host.resync(id);
    this.presence();
  }

  /** The seat is away: no bot plays it, and its windows run on timeouts (spec #4 M2, M3). */
  private goAway(id: PlayerId, forGood = false): void {
    const human = this.humans.get(id);
    if (!human) return;
    if (human.conn) {
      this.kick(human.conn);
      human.conn = null;
    }
    if (!this.away.has(id)) {
      this.away.add(id);
      this.host.setAway(id, true);
      this.presence();
    }
    if (forGood) this.loseSeat(id);
    else if (human.rejoin === null && [...this.tokens.values()].includes(id)) human.rejoin = this.later(REJOIN_MS, () => this.loseSeat(id));
    this.checkEmpty();
  }

  /** The seat's token stops working; a later join hears "seat-lost". */
  private loseSeat(id: PlayerId): void {
    const human = this.humans.get(id)!;
    this.cancel(human.rejoin);
    human.rejoin = null;
    for (const [token, owner] of this.tokens) {
      if (owner !== id) continue;
      this.tokens.delete(token);
      this.lost.add(token);
    }
  }

  /** With no human connected the match pauses, and ends if nobody comes back within 60 s (spec #4 §5.2). */
  private checkEmpty(): void {
    if (this.closed) return;
    const anyone = [...this.humans.values()].some((h) => h.conn !== null);
    if (!anyone && this.empty === null) {
      this.host.pause();
      this.empty = this.later(EMPTY_MS, () => this.close());
    } else if (anyone && this.empty !== null) {
      this.cancel(this.empty);
      this.empty = null;
      this.host.resume();
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [conn, entry] of this.conns) {
      if (now - entry.heardAt < SILENCE_MS) continue;
      conn.close();
      this.drop(conn);
    }
  }

  /** Everyone connected hears who is away. Not after the win: end screens don't need it. */
  private presence(): void {
    if (this.won) return;
    const away = [...this.away];
    for (const human of this.humans.values()) human.conn?.send({ type: 'presence', away });
  }

  private fromHost(to: PlayerId, msg: FromHost): void {
    const conn = this.humans.get(to)?.conn;
    if (!conn) return;
    conn.send(msg.type === 'failed' ? { type: 'failed', reason: 'server-error', message: msg.message } : msg);
  }

  private ended(outcome: 'won' | 'failed'): void {
    if (outcome === 'failed') {
      this.close(); // the host has told everyone
      return;
    }
    this.won = true;
    this.later(END_LINGER_MS, () => this.close());
  }

  /** The room is over: timers stop and every socket closes. Later sockets hear it is no longer running. */
  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.host.stop();
    if (this.sweeper !== null) clearInterval(this.sweeper);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const human of this.humans.values()) human.conn = null;
    for (const conn of [...this.conns.keys()]) conn.close();
    this.conns.clear();
  }

  private kick(conn: RoomConn): void {
    this.conns.delete(conn);
    conn.close();
  }

  private later(ms: number, fn: () => void): Timer {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  private cancel(timer: Timer | null): void {
    if (timer === null) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }
}
