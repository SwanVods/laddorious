import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError } from '@laddorious/core';
import { BOT_DELAY_MAX_MS, type MatchOut, type MatchStats, type MatchUpdate, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MS, END_LINGER_MS, JOIN_DEADLINE_MS, MatchRoom, REJOIN_MS, SILENCE_MS, type RoomConn } from '../src/room';

/** Two humans and two bots. */
const SEATS: Seat[] = [
  { playerId: 'p0', nickname: 'Ari', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Bo', piece: 'pawn', bot: false },
  { playerId: 'p2', nickname: 'Mochi', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Pip', piece: 'dragon', bot: true },
];

/** A game's match socket: what it was sent, and whether it was closed. */
class FakeConn implements RoomConn {
  sent: MatchOut[] = [];
  closed = false;

  send(msg: MatchOut): void {
    this.sent.push(structuredClone(msg));
  }

  close(): void {
    this.closed = true;
  }

  of<T extends MatchOut['type']>(type: T): Array<Extract<MatchOut, { type: T }>> {
    return this.sent.filter((m): m is Extract<MatchOut, { type: T }> => m.type === type);
  }

  updates(): MatchUpdate[] {
    return this.of('update').map((m) => m.update);
  }

  lastPresence(): string[] | undefined {
    return this.of('presence').at(-1)?.away;
  }
}

function setup(opts: { fast?: boolean } = {}) {
  const room = new MatchRoom(opts);
  const tokens = room.start(SEATS, 'board-seed', 'rng-secret');
  /** A socket that opens and, given a token, joins with it. */
  const connect = (token?: string) => {
    const conn = new FakeConn();
    room.open(conn);
    if (token !== undefined) room.receive(conn, { type: 'join', token });
    return conn;
  };
  return { room, tokens, connect };
}

/** Lets time pass in 5 s steps, with these sockets pinging as the game does (spec #4 §5.3). */
function pass(room: MatchRoom, ms: number, ...alive: FakeConn[]) {
  for (let t = 0; t < ms; t += 5000) {
    for (const conn of alive) room.receive(conn, { type: 'ping', t: Date.now() });
    vi.advanceTimersByTime(Math.min(5000, ms - t));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MatchRoom joining (spec #4 §5.1)', () => {
  it('gives each human seat its own 128-bit token', () => {
    const { tokens } = setup();
    expect(Object.keys(tokens)).toEqual(['p0', 'p1']);
    for (const token of Object.values(tokens)) expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(tokens.p0).not.toBe(tokens.p1);
  });

  it('welcomes a player with their seat, then their own current view and who is away', () => {
    const { tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    expect(ari.sent[0]).toEqual({ type: 'welcome', me: 'p0', seats: SEATS, serverTime: 0 });
    expect(ari.updates()).toHaveLength(1);
    expect(ari.updates()[0]).toMatchObject({ events: [], timer: null });
    expect(ari.updates()[0]!.view.me).toBe('p0');
    expect(ari.lastPresence()).toEqual([]);
  });

  it('closes a socket whose first message is not join, and refuses an unknown token', () => {
    const { room, connect } = setup();
    const early = connect();
    room.receive(early, { type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(early.closed).toBe(true);
    const stranger = connect('f'.repeat(32));
    expect(stranger.sent).toEqual([{ type: 'failed', reason: 'bad-token', message: 'That seat is not at this match' }]);
    expect(stranger.closed).toBe(true);
  });

  it("stamps a player's actions with their own seat", () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(bo.updates().flatMap((u) => u.events)).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
  });

  it('starts the countdown once both players have watched the opening', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'playbackDone', windowId: 1 });
    expect(bo.updates().at(-1)!.timer).toBeNull();
    room.receive(bo, { type: 'playbackDone', windowId: 1 });
    expect(bo.updates().at(-1)!.timer).toEqual({ windowId: 1, endsAt: DEFAULT_WINDOWS.diceMs });
  });

  it('answers ping with pong and the server time', () => {
    const { room, tokens, connect } = setup();
    vi.setSystemTime(7000);
    const ari = connect(tokens.p0!);
    room.receive(ari, { type: 'ping', t: 6990 });
    expect(ari.sent.at(-1)).toEqual({ type: 'pong', t: 6990, serverTime: 7000 });
  });
});

describe('MatchRoom away and rejoin (spec #4 §5.2)', () => {
  it('marks a dropped seat away for everyone, and lets it rejoin within 60 s', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(bo);
    expect(ari.lastPresence()).toEqual(['p1']);
    pass(room, REJOIN_MS - 1000, ari);
    const back = connect(tokens.p1!);
    expect(back.sent[0]).toMatchObject({ type: 'welcome', me: 'p1' });
    expect(back.updates()).toHaveLength(1);
    expect(ari.lastPresence()).toEqual([]);
  });

  it('cancels the token after 60 s away: a late join hears the match carried on without it', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(bo);
    pass(room, REJOIN_MS, ari);
    const late = connect(tokens.p1!);
    expect(late.sent).toEqual([{ type: 'failed', reason: 'seat-lost', message: 'The match carried on without you' }]);
    expect(late.closed).toBe(true);
  });

  it('counts 10 s of silence as gone', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    pass(room, SILENCE_MS, ari);
    expect(bo.closed).toBe(true);
    expect(ari.closed).toBe(false);
    expect(ari.lastPresence()).toEqual(['p1']);
  });

  it('counts a player who never joins within 15 s as away', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    pass(room, JOIN_DEADLINE_MS, ari);
    expect(ari.lastPresence()).toEqual(['p1']);
  });

  it('makes a seat away for good on leave', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(bo, { type: 'leave' });
    expect(bo.closed).toBe(true);
    expect(ari.lastPresence()).toEqual(['p1']);
    expect(connect(tokens.p1!).sent).toEqual([{ type: 'failed', reason: 'seat-lost', message: 'The match carried on without you' }]);
  });

  it('lets a newer socket with the same token take the seat over without going away', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    const reloaded = connect(tokens.p1!);
    expect(bo.closed).toBe(true);
    room.drop(bo); // the old socket's close arrives late
    expect(reloaded.sent[0]).toMatchObject({ type: 'welcome', me: 'p1' });
    expect(ari.of('presence').every((p) => p.away.length === 0)).toBe(true);
  });

  it('pauses while nobody is connected and picks up where it was', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(ari);
    room.drop(bo);
    vi.advanceTimersByTime(EMPTY_MS - 10_000);
    const back = connect(tokens.p0!);
    expect(back.updates().at(-1)!.view.awaiting.windowId).toBe(1);
    expect(back.updates().at(-1)!.timer).toEqual({ windowId: 1, endsAt: EMPTY_MS - 10_000 + DEFAULT_WINDOWS.diceMs });
  });

  it('ends the match after 60 s with nobody connected; a later socket hears it is no longer running', () => {
    const { room, tokens, connect } = setup();
    room.drop(connect(tokens.p0!));
    room.drop(connect(tokens.p1!));
    vi.advanceTimersByTime(EMPTY_MS);
    const late = connect(tokens.p0!);
    expect(late.sent).toEqual([{ type: 'failed', reason: 'server-error', message: 'This match is no longer running' }]);
    expect(late.closed).toBe(true);
  });
});

describe('MatchRoom end (spec #4 §5.2)', () => {
  it('closes every socket 10 s after the win, still telling everyone who leaves and comes back until then', () => {
    const { room, tokens, connect } = setup({ fast: true });
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    const won = () => ari.updates().some((u) => u.view.phase.kind === 'finished');
    for (let t = 0; t < 600_000 && !won(); t += 1000) pass(room, 1000, ari, bo);
    expect(won()).toBe(true);
    room.drop(bo);
    expect(ari.lastPresence()).toEqual(['p1']);
    connect(tokens.p1!); // a reload just after the win
    expect(ari.lastPresence()).toEqual([]);
    vi.advanceTimersByTime(END_LINGER_MS);
    expect(ari.closed).toBe(true);
    expect(connect().sent[0]).toMatchObject({ type: 'failed', reason: 'server-error' });
  });

  it('tells every player and closes when the host fails', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'playbackDone', windowId: 1 });
    room.receive(bo, { type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    for (const conn of [ari, bo]) {
      expect(conn.sent.at(-1)).toEqual({ type: 'failed', reason: 'server-error', message: 'board corrupted' });
      expect(conn.closed).toBe(true);
    }
  });
});

describe('MatchRoom match stats (2026-10-17)', () => {
  it('reports an online match nobody came back to as abandoned, with its real players only and the board seed', () => {
    const reports: MatchStats[] = [];
    const room = new MatchRoom({ stats: { mode: 'quick', version: '0.2.0', keys: { p0: 'key-ari' }, onStats: (s) => reports.push(s) } });
    room.start(SEATS, 'board-seed', 'rng-secret');
    vi.advanceTimersByTime(EMPTY_MS + 1000);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.match).toMatchObject({ mode: 'quick', status: 'abandoned', seed: 'board-seed', humans: 2, bots: 2 });
    expect(reports[0]!.players.map((p) => [p.nickname, p.playerKey])).toEqual([['Ari', 'key-ari'], ['Bo', '']]);
  });
});
