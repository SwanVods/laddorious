import type { PlayerId } from '@laddorious/core';
import { BOT_NAMES, buildSeats, PROTOCOL_VERSION, TABLE_SIZE, type LobbyIn, type LobbyOut, type Profile, type RoomErrorReason, type Seat } from '@laddorious/host';

/** How often a forming table hears the time (spec #4 §4 step 3). */
export const LOBBY_TICK_MS = 1000;
/** A player may start with bots once they have waited this long themselves (spec #2 C7). */
export const BOTS_OFFER_MS = 15_000;
/** The pause between bots taking seats (spec #2 §4.4). */
export const BOT_SEAT_MS = 420;
export const VERSION_MESSAGE = 'Please reload, the game was updated.';
/** A room's code: four letters, none that read like a digit or another letter (I, O). */
export const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
const ROOM_ERRORS: Record<RoomErrorReason, string> = {
  'no-room': 'No room with that code. Check it, or the game may have started already.',
  full: 'That room is full.',
};

/** A fresh random room code. */
export function randomRoomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_LETTERS[Math.floor(Math.random() * ROOM_LETTERS.length)]).join('');
}

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
  /** A private room's code (2026-10-16): only that code seats anyone, and its first member starts it. */
  code?: string;
}

/**
 * Quick-match matchmaking for every game (spec #4 §4), and private rooms by code (2026-10-16): one table forms at a time, each player
 * may call in bots after their own 15 s, bots fill the empty seats, and the match starts.
 * Plain TypeScript: the lobby's Durable Object feeds it sockets and checked messages.
 */
export class LobbyCore {
  private readonly members = new Map<LobbyConn, Member>();
  /** Quick-match tables still taking players, oldest first. */
  private readonly forming: Table[] = [];
  /** Private rooms still taking players, by code. */
  private readonly rooms = new Map<string, Table>();

  constructor(
    private readonly startMatch: (seats: Seat[]) => Promise<StartedMatch>,
    private readonly makeCode: () => string = randomRoomCode,
  ) {}

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
      case 'createRoom':
        this.createRoom(member);
        return;
      case 'joinRoom':
        this.joinRoom(member, msg.code);
        return;
      case 'startRoom':
        this.startRoom(member);
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

  private openTable(code?: string): Table {
    const table: Table = { members: [], locked: false, ticker: null, code };
    table.ticker = setInterval(() => this.tell(table, 'searching'), LOBBY_TICK_MS);
    if (code === undefined) this.forming.push(table);
    else this.rooms.set(code, table);
    return table;
  }

  /** A private room with a fresh code; its creator hosts it (2026-10-16). */
  private createRoom(member: Member): void {
    if (member.table) return;
    let code = this.makeCode();
    while (this.rooms.has(code)) code = this.makeCode();
    this.sit(member, this.openTable(code));
  }

  /** Seats the player in the room with this code, in any case; four seats at most, and nobody joins once it starts. */
  private joinRoom(member: Member, typed: string): void {
    if (member.table) return;
    const table = this.rooms.get(typed.trim().toUpperCase());
    const reason: RoomErrorReason | null = !table || table.locked ? 'no-room' : table.members.length >= TABLE_SIZE ? 'full' : null;
    if (reason) member.conn.send({ type: 'roomError', reason, message: ROOM_ERRORS[reason] });
    else this.sit(member, table!);
  }

  /** The room's host starts it whenever they like: bots fill the empty seats. */
  private startRoom(member: Member): void {
    const table = member.table;
    if (!table || table.code === undefined || table.locked || table.members[0] !== member) return;
    this.fillWithBots(table);
  }

  private sit(member: Member, table: Table): void {
    member.table = table;
    member.joinedAt = Date.now();
    table.members.push(member);
    this.tell(table, 'searching');
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
    // A room starts only when its host says so (startRoom).
    if (!table || table.code !== undefined || table.locked || Date.now() - member.joinedAt < BOTS_OFFER_MS) return;
    this.fillWithBots(table);
  }

  /** Bots take the empty seats one by one, then the match starts. */
  private fillWithBots(table: Table): void {
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
    if (table.code !== undefined) this.rooms.delete(table.code);
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
    table.members.forEach((m, you) =>
      m.conn.send({ type: 'matchmaking', state, seats, you, elapsedMs: now - m.joinedAt, ...(table.code !== undefined ? { room: { code: table.code, host: you === 0 } } : {}) }),
    );
  }
}
