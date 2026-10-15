import { PROTOCOL_VERSION, type PieceId, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchmakingState, Profile } from '../src/service/matchService';
import { CONNECT_TIMEOUT_MS, LOST_MESSAGE, OnlineMatchService, START_FAILED_MESSAGE, serverUrl } from '../src/service/onlineMatchService';
import { SERVER_SILENCE_MS } from '../src/service/onlineSession';
import { PING_MS } from '../src/service/onlineSocket';
import { SEAT_KEY, saveSeat } from '../src/service/savedSeat';
import { fakeSockets, memoryStore } from './support/fakeSocket';

const ARI: Profile = { nickname: 'Ari', piece: 'meeple' };
const seat = (playerId: string, nickname: string, piece: PieceId = 'knight', bot = false): Seat => ({ playerId, nickname, piece, bot });

/** PLAY against a fake lobby: every matchmaking state is recorded. */
function search() {
  const sockets = fakeSockets();
  const store = memoryStore();
  const service = new OnlineMatchService({ url: 'ws://test', open: sockets.open, store, tabs: () => null });
  const matchmaking = service.findMatch(ARI);
  const states: MatchmakingState[] = [];
  matchmaking.onState((s) => states.push(s));
  return { service, matchmaking, states, last: () => states.at(-1)!, lobby: sockets.made[0]!, sockets, store };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OnlineMatchService matchmaking (spec #4 §4)', () => {
  it('shows me in seat 0 at once, then says hello and find when the lobby opens', () => {
    const { last, lobby } = search();
    expect(lobby.url).toBe('ws://test/lobby');
    expect(last()).toEqual({ kind: 'searching', elapsedMs: 0, seats: [{ playerId: 'p0', nickname: 'Ari', piece: 'meeple', bot: false, color: '#ff5470' }, null, null, null] });
    lobby.open();
    expect(lobby.sent).toEqual([{ type: 'hello', version: PROTOCOL_VERSION, profile: ARI }, { type: 'find' }]);
  });

  it('lists the table with my seat first, each seat in the colour of its place at the table (M10)', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.reply({ type: 'matchmaking', state: 'searching', seats: [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), null, null], you: 1, elapsedMs: 3000 });
    const s = last();
    if (s.kind !== 'searching') throw new Error(`expected searching, got ${s.kind}`);
    expect(s.elapsedMs).toBe(3000);
    expect(s.seats.map((x) => x && [x.nickname, x.color])).toEqual([['Ari', '#3b82f6'], ['Bo', '#ff5470'], null, null]);
  });

  it('asks the server for bots, and shows them taking seats', () => {
    const { matchmaking, last, lobby } = search();
    lobby.open();
    matchmaking.playWithBots();
    expect(lobby.sent.at(-1)).toEqual({ type: 'playWithBots' });
    lobby.reply({ type: 'matchmaking', state: 'filling', seats: [seat('p0', 'Ari', 'meeple'), seat('p1', 'Mochi', 'knight', true), null, null], you: 0, elapsedMs: 15_000 });
    expect(last().kind).toBe('filling');
    lobby.reply({ type: 'matchmaking', state: 'searching', seats: [seat('p0', 'Ari', 'meeple'), null, null, null], you: 0, elapsedMs: 16_000 });
    expect(last().kind).toBe('filling'); // a late tick doesn't undo it
  });

  it('opens the match with its seat and token, and saves them for a reload', () => {
    const { last, lobby, sockets, store } = search();
    lobby.open();
    const seats = [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), seat('p2', 'Mochi', 'pawn', true), seat('p3', 'Pip', 'dragon', true)];
    lobby.reply({ type: 'found', matchId: 'm7', me: 'p1', seats, token: 'cd'.repeat(16) });
    const s = last();
    if (s.kind !== 'found') throw new Error(`expected found, got ${s.kind}`);
    expect(s.session.me).toBe('p1');
    expect(s.session.seats.map((x) => x.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
    expect(lobby.closed).toBe(true);
    expect(sockets.last().url).toBe('ws://test/match/m7');
    expect(JSON.parse(store.map.get(SEAT_KEY)!)).toEqual({ matchId: 'm7', token: 'cd'.repeat(16), me: 'p1', seats });
  });

  it('cancels while searching, and ignores cancel once bots are taking seats', () => {
    const first = search();
    first.lobby.open();
    first.matchmaking.cancel();
    expect(first.lobby.sent.at(-1)).toEqual({ type: 'cancel' });
    expect(first.last()).toEqual({ kind: 'cancelled' });
    expect(first.lobby.closed).toBe(true);

    const second = search();
    second.lobby.open();
    second.lobby.reply({ type: 'matchmaking', state: 'filling', seats: [seat('p0', 'Ari', 'meeple'), null, null, null], you: 0, elapsedMs: 15_000 });
    second.matchmaking.cancel();
    expect(second.last().kind).toBe('filling');
    expect(second.lobby.closed).toBe(false);
  });
});

describe('OnlineMatchService when the server is out of reach (spec #4 §3.3)', () => {
  it("offers offline play when the lobby doesn't open within 5 s", () => {
    const { last, lobby } = search();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(last().kind).toBe('searching');
    vi.advanceTimersByTime(1);
    expect(last()).toEqual({ kind: 'unreachable', message: "Can't reach the game server." });
    expect(lobby.closed).toBe(true);
  });

  it('says so at once when the lobby connection drops before a match is found', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.drop();
    expect(last()).toEqual({ kind: 'unreachable', message: "Can't reach the game server." });
  });

  it('pings the lobby, and says it lost the server when the lobby goes quiet (2026-10-15)', () => {
    const { last, lobby } = search();
    lobby.open();
    vi.advanceTimersByTime(PING_MS);
    expect(lobby.sent.at(-1)).toMatchObject({ type: 'ping' });
    lobby.reply({ type: 'pong', t: 0, serverTime: 0 });
    expect(last().kind).toBe('searching');
    vi.advanceTimersByTime(SERVER_SILENCE_MS + PING_MS);
    expect(last()).toEqual({ kind: 'unreachable', message: LOST_MESSAGE });
    expect(lobby.closed).toBe(true);
  });

  it("shows a plain message when a match fails to start, not the server's own text (2026-10-15)", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { last, lobby } = search();
    lobby.open();
    lobby.reply({ type: 'failed', reason: 'server-error', message: 'TypeError: seats[4] is undefined' });
    expect(last()).toEqual({ kind: 'unreachable', message: START_FAILED_MESSAGE });
    expect(warn.mock.calls.flat().join(' ')).toContain('seats[4] is undefined');
    warn.mockRestore();
  });

  it('asks for a reload when the server runs another version', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.reply({ type: 'failed', reason: 'version', message: 'Please reload, the game was updated.' });
    expect(last()).toEqual({ kind: 'unreachable', message: 'Please reload, the game was updated.' });
  });

  it('goes back to the menu on cancel from there', () => {
    const { matchmaking, last } = search();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    matchmaking.cancel();
    expect(last()).toEqual({ kind: 'cancelled' });
  });
});

describe('OnlineMatchService.rejoin (spec #4 §3.3)', () => {
  it('rejoins the saved seat after a reload, and returns null without one', () => {
    const sockets = fakeSockets();
    const store = memoryStore();
    const service = new OnlineMatchService({ url: 'ws://test', open: sockets.open, store, tabs: () => null });
    expect(service.rejoin()).toBeNull();
    saveSeat(store, { matchId: 'm7', token: 'cd'.repeat(16), me: 'p1', seats: [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), seat('p2', 'Mochi', 'pawn', true), seat('p3', 'Pip', 'dragon', true)] });
    const session = service.rejoin();
    expect(session?.me).toBe('p1');
    expect(sockets.last().url).toBe('ws://test/match/m7');
    store.setItem(SEAT_KEY, '{broken');
    expect(service.rejoin()).toBeNull();
  });
});

describe('serverUrl (spec #4 M11)', () => {
  it('reads VITE_SERVER: same-origin, an explicit address, or offline', () => {
    const page = { protocol: 'http:', host: '192.168.1.20:8787' };
    expect(serverUrl('same-origin', page)).toBe('ws://192.168.1.20:8787');
    expect(serverUrl('same-origin', { protocol: 'https:', host: 'laddorious.example.workers.dev' })).toBe('wss://laddorious.example.workers.dev');
    expect(serverUrl('wss://game.example.com/', page)).toBe('wss://game.example.com');
    expect(serverUrl('ws://localhost:8787', page)).toBe('ws://localhost:8787');
    expect(serverUrl(undefined, page)).toBeNull();
    expect(serverUrl('', page)).toBeNull();
    expect(serverUrl('http://not-a-socket', page)).toBeNull();
  });
});
