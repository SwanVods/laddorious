import type { PlayerId } from '@laddorious/core';
import { BOT_NAMES, buildSeats, PROTOCOL_VERSION, TABLE_SIZE, type LobbyIn, type LobbyOut, type Profile, type Seat } from '@laddorious/host';

/** How often a forming table hears the time (spec #4 §4 step 3). */
export const LOBBY_TICK_MS = 1000;
/** A player may start with bots once they have waited this long themselves (spec #2 C7). */
export const BOTS_OFFER_MS = 15_000;
/** The pause between bots taking seats (spec #2 §4.4). */
export const BOT_SEAT_MS = 420;
export const VERSION_MESSAGE = 'Please reload, the game was updated.';

/** One game's lobby socket, as the lobby sees it. */
export interface LobbyConn {
  send(msg: LobbyOut): void;
  close(): void;
}

/** A started match: its id, and one rejoin token per human seat. */
export interface StartedMatch {
  matchId: string;
  tokens: Record<PlayerId, string>;
}

interface Member {
  conn: LobbyConn;
  profile: Profile;
  table: Table | null;
  /** When this player sat down: their own waiting time counts from here. */
  joinedAt: number;
}

interface Table {
  /** Humans in join order: seat 0 sat down first. */
  members: Member[];
  /** Bots are taking seats or the match is starting: nobody joins or leaves any more. */
  locked: boolean;
  ticker: ReturnType<typeof setInterval> | null;
}

/**
 * Quick-match matchmaking for every game (spec #4 §4): one table forms at a time, each player
 * may call in bots after their own 15 s, bots fill the empty seats, and the match starts.
 * Plain TypeScript: the lobby's Durable Object feeds it sockets and checked messages.
 */
export class LobbyCore {
  private readonly members = new Map<LobbyConn, Member>();
  /** Tables still taking players, oldest first. */
  private readonly forming: Table[] = [];

  constructor(private readonly startMatch: (seats: Seat[]) => Promise<StartedMatch>) {}

  receive(conn: LobbyConn, msg: LobbyIn): void {
    const member = this.members.get(conn);
    if (!member) {
      this.hello(conn, msg);
      return;
    }
    switch (msg.type) {
      case 'find':
        this.find(member);
        return;
      case 'cancel':
        this.leaveTable(member);
        return;
      case 'playWithBots':
        this.playWithBots(member);
        return;
      case 'ping':
        conn.send({ type: 'pong', t: msg.t, serverTime: Date.now() });
        return;
      case 'hello':
        return; // only the first one counts
    }
  }

  /** The socket closed. A seat at a forming table is freed, as if cancelled (spec #4 §4 step 7). */
  drop(conn: LobbyConn): void {
    const member = this.members.get(conn);
    if (!member) return;
    this.leaveTable(member);
    this.members.delete(conn);
  }

  /** The first message must be hello with this build's protocol version. */
  private hello(conn: LobbyConn, msg: LobbyIn): void {
    if (msg.type !== 'hello') {
      conn.close();
      return;
    }
    if (msg.version !== PROTOCOL_VERSION) {
      conn.send({ type: 'failed', reason: 'version', message: VERSION_MESSAGE });
      conn.close();
      return;
    }
    this.members.set(conn, { conn, profile: msg.profile, table: null, joinedAt: 0 });
  }

  /** Sits the player at the oldest forming table, or opens one; four humans start at once. */
  private find(member: Member): void {
    if (member.table) return;
    const table = this.forming[0] ?? this.openTable();
    member.table = table;
    member.joinedAt = Date.now();
    table.members.push(member);
    if (table.members.length === TABLE_SIZE) this.start(table, this.seatsOf(table));
    else this.tell(table, 'searching');
  }

  private openTable(): Table {
    const table: Table = { members: [], locked: false, ticker: null };
    table.ticker = setInterval(() => this.tell(table, 'searching'), LOBBY_TICK_MS);
    this.forming.push(table);
    return table;
  }

  private leaveTable(member: Member): void {
    const table = member.table;
    if (!table || table.locked) return; // ignored once bots are taking seats
    table.members.splice(table.members.indexOf(member), 1);
    member.table = null;
    if (table.members.length === 0) this.lock(table);
    else this.tell(table, 'searching');
  }

  /** The first press from a player who has waited 15 s fills the table for everyone. */
  private playWithBots(member: Member): void {
    const table = member.table;
    if (!table || table.locked || Date.now() - member.joinedAt < BOTS_OFFER_MS) return;
    this.lock(table);
    const seats = this.seatsOf(table);
    const seat = (shown: number): void => {
      this.tell(table, 'filling', seats.slice(0, shown));
      if (shown < TABLE_SIZE) setTimeout(() => seat(shown + 1), BOT_SEAT_MS);
      else this.start(table, seats);
    };
    seat(table.members.length);
  }

  /** No more joining or leaving: the table stops ticking and is no longer forming. */
  private lock(table: Table): void {
    table.locked = true;
    if (table.ticker !== null) clearInterval(table.ticker);
    table.ticker = null;
    const i = this.forming.indexOf(table);
    if (i >= 0) this.forming.splice(i, 1);
  }

  /** Asks for a match with these seats and sends each human `found` with their seat and token. */
  private start(table: Table, seats: Seat[]): void {
    this.lock(table);
    const members = [...table.members];
    for (const m of members) m.table = null;
    this.startMatch(seats).then(
      ({ matchId, tokens }) => {
        members.forEach((m, i) => {
          const me = seats[i]!.playerId;
          m.conn.send({ type: 'found', matchId, me, seats, token: tokens[me]! });
        });
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        for (const m of members) m.conn.send({ type: 'failed', reason: 'server-error', message });
      },
    );
  }

  /** The table's final seats: its humans, then bots (spec #4 §4 step 6). */
  private seatsOf(table: Table): Seat[] {
    return buildSeats(
      table.members.map((m) => m.profile),
      BOT_NAMES,
    );
  }

  /**
   * Each member hears the table in seat order (`shown` seats, the rest open), which seat is
   * theirs, and their own waiting time.
   */
  private tell(table: Table, state: 'searching' | 'filling', shown: Seat[] = this.seatsOf(table).slice(0, table.members.length)): void {
    const seats = [...shown, ...Array<null>(TABLE_SIZE - shown.length).fill(null)];
    const now = Date.now();
    table.members.forEach((m, you) => m.conn.send({ type: 'matchmaking', state, seats, you, elapsedMs: now - m.joinedAt }));
  }
}
