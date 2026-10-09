import { PROTOCOL_VERSION, type LobbyOut, type PieceId, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_SEAT_MS, BOTS_OFFER_MS, LOBBY_TICK_MS, LobbyCore, type LobbyConn } from '../src/lobby';

/** A game's lobby socket: what it was sent, and whether it was closed. */
class FakeConn implements LobbyConn {
  sent: LobbyOut[] = [];
  closed = false;

  send(msg: LobbyOut): void {
    this.sent.push(structuredClone(msg));
  }

  close(): void {
    this.closed = true;
  }

  last(): LobbyOut {
    return this.sent.at(-1)!;
  }

  /** The last matchmaking update: its state, the nicknames in seat order (null = open), my seat and my time. */
  table() {
    const m = this.sent.findLast((x) => x.type === 'matchmaking');
    if (m?.type !== 'matchmaking') throw new Error('no matchmaking update yet');
    return { state: m.state, names: m.seats.map((s) => s?.nickname ?? null), you: m.you, elapsedMs: m.elapsedMs };
  }
}

/** A lobby whose matches start at once (or fail to), with each started table recorded. */
function setup(fail = false) {
  const started: Seat[][] = [];
  const lobby = new LobbyCore(async (seats) => {
    started.push(seats);
    if (fail) throw new Error('no match objects left');
    return { matchId: `match-${started.length}`, tokens: Object.fromEntries(seats.filter((s) => !s.bot).map((s) => [s.playerId, `token-${s.playerId}`])) };
  });
  const join = (nickname: string, piece: PieceId = 'knight') => {
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'hello', version: PROTOCOL_VERSION, profile: { nickname, piece } });
    lobby.receive(conn, { type: 'find' });
    return conn;
  };
  return { lobby, started, join };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LobbyCore seating (spec #4 §4)', () => {
  it('seats the first player at a new table and tells them their waiting time every second', () => {
    const { join } = setup();
    const ari = join('Ari');
    expect(ari.table()).toEqual({ state: 'searching', names: ['Ari', null, null, null], you: 0, elapsedMs: 0 });
    vi.advanceTimersByTime(LOBBY_TICK_MS);
    expect(ari.table().elapsedMs).toBe(1000);
  });

  it('seats the next player at the same table; each hears their own seat and time', () => {
    const { join } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(3000);
    const bo = join('Bo', 'pawn');
    expect(ari.table()).toEqual({ state: 'searching', names: ['Ari', 'Bo', null, null], you: 0, elapsedMs: 3000 });
    expect(bo.table()).toEqual({ state: 'searching', names: ['Ari', 'Bo', null, null], you: 1, elapsedMs: 0 });
    vi.advanceTimersByTime(LOBBY_TICK_MS);
    expect(ari.table().elapsedMs).toBe(4000);
    expect(bo.table().elapsedMs).toBe(1000);
  });

  it('starts at once with four players and no bots, sending each their own seat and token', async () => {
    const { join, started } = setup();
    const conns = ['Ari', 'Bo', 'Cy', 'Di'].map((n) => join(n));
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(1);
    expect(started[0]!.map((s) => [s.nickname, s.bot])).toEqual([['Ari', false], ['Bo', false], ['Cy', false], ['Di', false]]);
    conns.forEach((conn, i) => expect(conn.last()).toEqual({ type: 'found', matchId: 'match-1', me: `p${i}`, seats: started[0], token: `token-p${i}` }));
  });

  it('opens a new table for the fifth player', () => {
    const { join } = setup();
    for (const n of ['Ari', 'Bo', 'Cy', 'Di']) join(n);
    expect(join('Eve').table()).toMatchObject({ names: ['Eve', null, null, null], you: 0 });
  });
});

describe('LobbyCore bots (spec #4 §4 step 5)', () => {
  it('offers bots to each player only after their own 15 s', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(BOTS_OFFER_MS - 5000);
    const bo = join('Bo');
    vi.advanceTimersByTime(5000);
    lobby.receive(bo, { type: 'playWithBots' });
    expect(ari.table().state).toBe('searching');
    lobby.receive(ari, { type: 'playWithBots' });
    expect(ari.table()).toMatchObject({ state: 'filling', names: ['Ari', 'Bo', null, null] });
    expect(bo.table()).toMatchObject({ state: 'filling', you: 1 });
  });

  it('fills the empty seats with bots 420 ms apart, then starts the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari', 'meeple');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    expect(ari.table().names).toEqual(['Ari', null, null, null]);
    await vi.advanceTimersByTimeAsync(BOT_SEAT_MS);
    expect(ari.table().names).toEqual(['Ari', 'Mochi', null, null]);
    await vi.advanceTimersByTimeAsync(2 * BOT_SEAT_MS);
    expect(started[0]!.map((s) => [s.nickname, s.piece, s.bot])).toEqual([
      ['Ari', 'meeple', false],
      ['Mochi', 'knight', true],
      ['Pip', 'pawn', true],
      ['Juno', 'dragon', true],
    ]);
    expect(ari.last()).toMatchObject({ type: 'found', me: 'p0', token: 'token-p0' });
    vi.advanceTimersByTime(10_000);
    expect(ari.last().type).toBe('found'); // no more ticks
  });

  it('ignores cancel once bots are taking seats, and still starts the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    lobby.receive(ari, { type: 'cancel' });
    await vi.advanceTimersByTimeAsync(3 * BOT_SEAT_MS);
    expect(started).toHaveLength(1);
    expect(ari.last().type).toBe('found');
  });

  it('keeps the seat of a player who drops while bots take seats: they will be away in the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    lobby.drop(bo);
    await vi.advanceTimersByTimeAsync(2 * BOT_SEAT_MS);
    expect(started[0]!.map((s) => [s.nickname, s.bot])).toEqual([['Ari', false], ['Bo', false], ['Mochi', true], ['Pip', true]]);
    expect(ari.last()).toMatchObject({ type: 'found', me: 'p0' });
  });
});

describe('LobbyCore leaving (spec #4 §4 step 7)', () => {
  it('frees a cancelled seat and shifts the later players up', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    const cy = join('Cy');
    lobby.receive(bo, { type: 'cancel' });
    expect(ari.table().names).toEqual(['Ari', 'Cy', null, null]);
    expect(cy.table().you).toBe(1);
  });

  it('treats a dropped socket as cancel', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    lobby.drop(bo);
    expect(ari.table().names).toEqual(['Ari', null, null, null]);
  });

  it('closes an empty table: its ticks stop, and the next player opens a new one', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    lobby.receive(ari, { type: 'cancel' });
    const count = ari.sent.length;
    vi.advanceTimersByTime(5 * LOBBY_TICK_MS);
    expect(ari.sent).toHaveLength(count);
    expect(join('Bo').table()).toMatchObject({ names: ['Bo', null, null, null], you: 0 });
  });
});

describe('LobbyCore protocol (spec #4 §6)', () => {
  it('closes a socket whose first message is not hello', () => {
    const { lobby } = setup();
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'find' });
    expect(conn.closed).toBe(true);
  });

  it('refuses another protocol version with a reload message', () => {
    const { lobby } = setup();
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'hello', version: PROTOCOL_VERSION + 1, profile: { nickname: 'Ari', piece: 'pawn' } });
    expect(conn.sent).toEqual([{ type: 'failed', reason: 'version', message: 'Please reload, the game was updated.' }]);
    expect(conn.closed).toBe(true);
  });

  it('answers ping with the server time', () => {
    const { lobby, join } = setup();
    vi.setSystemTime(5000);
    const ari = join('Ari');
    lobby.receive(ari, { type: 'ping', t: 4990 });
    expect(ari.last()).toEqual({ type: 'pong', t: 4990, serverTime: 5000 });
  });

  it('tells everyone at the table when the match cannot start', async () => {
    const { join } = setup(true);
    const conns = ['Ari', 'Bo', 'Cy', 'Di'].map((n) => join(n));
    await vi.advanceTimersByTimeAsync(0);
    for (const conn of conns) expect(conn.last()).toEqual({ type: 'failed', reason: 'server-error', message: 'no match objects left' });
  });
});
