import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchFailure, MatchUpdate } from '../src/service/matchService';
import { BACKOFF_MS, CLAIM_WAIT_MS, NEVER_REACHED_MESSAGE, OTHER_TAB_MESSAGE, OnlineMatchSession, REJOIN_MS, SERVER_SILENCE_MS } from '../src/service/onlineSession';
import { PING_MS } from '../src/service/onlineSocket';
import { SEAT_KEY, saveSeat, type SavedSeat } from '../src/service/savedSeat';
import { SEATS, openingUpdate } from './support/fixtures';
import { fakeSockets, memoryStore, memoryTabs } from './support/fakeSocket';

const TOKEN = 'ab'.repeat(16);
const SAVED: SavedSeat = { matchId: 'm1', token: TOKEN, me: 'p0', seats: SEATS.map((s) => ({ playerId: s.playerId, nickname: s.nickname, piece: s.piece, bot: s.bot })) };

/** A session on a fresh socket, with everything it reports recorded. */
function start() {
  const sockets = fakeSockets();
  const store = memoryStore();
  saveSeat(store, SAVED);
  const session = new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store }, SAVED);
  const got = { updates: [] as MatchUpdate[], presence: [] as string[][], failures: [] as MatchFailure[], rejected: [] as unknown[] };
  session.onUpdate((u) => got.updates.push(u));
  session.onPresence((away) => got.presence.push(away));
  session.onFailed((f) => got.failures.push(f));
  session.onRejected((e) => got.rejected.push(e));
  return { session, sockets, store, got };
}

/** An update for this window, its countdown ending at server time `endsAt`, or none. */
function update(windowId: number, endsAt: number | null): MatchUpdate {
  const u = openingUpdate();
  return { ...u, view: { ...u.view, awaiting: { ...u.view.awaiting, windowId } }, timer: endsAt === null ? null : { windowId, endsAt } };
}

const welcome = (serverTime: number) => ({ type: 'welcome', me: 'p0', seats: SAVED.seats, serverTime });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OnlineMatchSession (spec #4 §3.3)', () => {
  it('opens /match/:id, joins with its token, then pings every 5 s', () => {
    const { session, sockets } = start();
    const ws = sockets.last();
    expect(ws.url).toBe('ws://test/match/m1');
    ws.open();
    expect(ws.sent).toEqual([{ type: 'join', token: TOKEN }, { type: 'ping', t: 0 }]);
    vi.advanceTimersByTime(5000);
    expect(ws.sent.at(-1)).toEqual({ type: 'ping', t: 5000 });
    expect(session.me).toBe('p0');
    expect(session.seats.map((s) => s.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
  });

  it("converts the countdown to this device's clock, from the median of the last pings (spec #4 §5.3)", () => {
    const { sockets, got } = start();
    const ws = sockets.last();
    ws.open();
    // The server's clock runs 10 s ahead of this phone's.
    ws.reply(welcome(10_000));
    ws.reply({ type: 'update', update: update(1, 22_000) });
    expect(got.updates.at(-1)!.timer).toEqual({ windowId: 1, endsAt: 12_000 });
    // Pings measure it more closely, and one slow answer is outvoted.
    vi.setSystemTime(200);
    ws.reply({ type: 'pong', t: 100, serverTime: 10_250 }); // 10_250 - (100 + 200) / 2 = 10_100
    ws.reply({ type: 'pong', t: 100, serverTime: 10_250 });
    ws.reply({ type: 'pong', t: 100, serverTime: 13_000 });
    ws.reply({ type: 'update', update: update(1, 22_000) });
    expect(got.updates.at(-1)!.timer).toEqual({ windowId: 1, endsAt: 11_900 });
  });

  it("stamps actions with the latest update's window, and passes playback and rejections on", () => {
    const { session, sockets, got } = start();
    const ws = sockets.last();
    ws.open();
    ws.reply({ type: 'update', update: update(4, null) });
    session.send({ type: 'roll' });
    expect(ws.sent.at(-1)).toEqual({ type: 'action', action: { type: 'roll' }, windowId: 4 });
    session.playbackDone(4);
    expect(ws.sent.at(-1)).toEqual({ type: 'playbackDone', windowId: 4 });
    ws.reply({ type: 'rejected', error: { code: 'STALE_INPUT', message: 'late' } });
    expect(got.rejected).toEqual([{ code: 'STALE_INPUT', message: 'late' }]);
  });

  it('reports who is away', () => {
    const { sockets, got } = start();
    sockets.last().open();
    sockets.last().reply({ type: 'presence', away: ['p1'] });
    expect(got.presence).toEqual([['p1']]);
  });

  it('reconnects with backoff, shows me away meanwhile, and rejoins with the same token', () => {
    const { sockets, got } = start();
    sockets.last().open();
    sockets.last().reply({ type: 'presence', away: ['p2'] });
    sockets.last().drop();
    expect(got.presence.at(-1)).toEqual(['p2', 'p0']);
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const count = sockets.made.length;
      let waited = 0;
      while (sockets.made.length === count) {
        vi.advanceTimersByTime(100);
        waited += 100;
      }
      waits.push(waited);
      if (i < 5) sockets.last().drop(); // that attempt failed too
    }
    expect(waits).toEqual([...BACKOFF_MS, 8000]);
    const ws = sockets.last();
    ws.open();
    expect(ws.sent[0]).toEqual({ type: 'join', token: TOKEN });
    ws.reply(welcome(Date.now()));
    ws.reply({ type: 'presence', away: [] });
    expect(got.presence.at(-1)).toEqual([]);
  });

  it('notices a connection that went silent, even if the browser has not, and reconnects (spec #4 §5.2)', () => {
    const { sockets, got } = start();
    const ws = sockets.last();
    ws.open();
    ws.reply(welcome(0));
    vi.advanceTimersByTime(SERVER_SILENCE_MS + PING_MS); // no pong ever comes back
    expect(ws.closed).toBe(true);
    expect(got.presence.at(-1)).toEqual(['p0']);
    vi.advanceTimersByTime(BACKOFF_MS[0]);
    expect(sockets.made).toHaveLength(2);
  });

  it('gives up after 60 s: the match carried on without me', () => {
    const { sockets, store, got } = start();
    sockets.last().open();
    sockets.last().reply(welcome(0));
    sockets.last().drop();
    for (let t = 0; t <= REJOIN_MS + 10_000 && got.failures.length === 0; t += 100) {
      const count = sockets.made.length;
      vi.advanceTimersByTime(100);
      if (sockets.made.length > count) sockets.last().drop();
    }
    expect(got.failures).toEqual([{ message: 'The match carried on without you', reason: 'seat-lost' }]);
    expect(store.map.has(SEAT_KEY)).toBe(false);
    const count = sockets.made.length;
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(count);
  });

  it("passes the server's failures on: a lost seat, another version, a match that's gone", () => {
    for (const [reason, message, shown] of [
      ['seat-lost', 'The match carried on without you', 'The match carried on without you'],
      ['version', 'protocol 2', 'Please reload, the game was updated.'],
      ['server-error', 'This match is no longer running', 'This match is no longer running'],
    ] as const) {
      const { sockets, store, got } = start();
      sockets.last().open();
      sockets.last().reply({ type: 'failed', reason, message });
      expect(got.failures).toEqual([{ message: shown, reason }]);
      expect(sockets.last().closed).toBe(true);
      expect(store.map.has(SEAT_KEY)).toBe(false);
    }
  });

  it('leaves: sends leave, closes, forgets the seat and never reconnects', () => {
    const { session, sockets, store } = start();
    const ws = sockets.last();
    ws.open();
    session.leave();
    expect(ws.sent.at(-1)).toEqual({ type: 'leave' });
    expect(ws.closed).toBe(true);
    expect(store.map.has(SEAT_KEY)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(1);
  });

  it('stops reconnecting and forgets the seat once the match is won', () => {
    const { sockets, store } = start();
    const ws = sockets.last();
    ws.open();
    const u = openingUpdate();
    const rankings = [{ player: 'p0', rank: 1, position: 100 }];
    ws.reply({ type: 'update', update: { ...u, view: { ...u.view, phase: { kind: 'finished', winner: 'p0', rankings }, awaiting: { windowId: 9, window: 'none', players: [], durationMs: 0 } } } });
    expect(store.map.has(SEAT_KEY)).toBe(false);
    ws.drop(); // the server closes the room 10 s after the win
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(1);
  });
});

describe('a session that never got through (2026-10-15)', () => {
  it("says it couldn't reach the match, not that the match carried on without me", () => {
    const { sockets, got } = start();
    sockets.last().drop();
    for (let t = 0; t <= REJOIN_MS + 10_000 && got.failures.length === 0; t += 100) {
      const count = sockets.made.length;
      vi.advanceTimersByTime(100);
      if (sockets.made.length > count) sockets.last().drop();
    }
    expect(got.failures).toEqual([{ message: NEVER_REACHED_MESSAGE, reason: 'seat-lost' }]);
  });
});

describe('a duplicated tab (2026-10-15)', () => {
  it('leaves the seat to the tab that had it, and says the match is open there', () => {
    const tabs = memoryTabs();
    const sockets = fakeSockets();
    // The first tab plays the seat.
    const first = new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store: memoryStore(), tabs }, SAVED);
    sockets.last().open();
    sockets.last().reply(welcome(0));
    // Its copy wakes up with the same saved seat, and asks first.
    const copyStore = memoryStore();
    saveSeat(copyStore, SAVED);
    const copy = new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store: copyStore, tabs }, SAVED, { rejoining: true });
    const failures: MatchFailure[] = [];
    copy.onFailed((f) => failures.push(f));
    vi.advanceTimersByTime(CLAIM_WAIT_MS);
    expect(failures).toEqual([{ message: OTHER_TAB_MESSAGE, reason: 'seat-lost' }]);
    expect(sockets.made).toHaveLength(1); // the copy never opened a socket
    expect(copyStore.map.has(SEAT_KEY)).toBe(false);
    first.leave();
  });

  it('never opens the match after I leave during the wait', () => {
    const sockets = fakeSockets();
    const session = new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store: memoryStore(), tabs: memoryTabs() }, SAVED, { rejoining: true });
    session.leave();
    vi.advanceTimersByTime(CLAIM_WAIT_MS * 2);
    expect(sockets.made).toHaveLength(0);
  });

  it('takes the seat after a short wait when no other tab has it (a plain reload)', () => {
    const sockets = fakeSockets();
    const store = memoryStore();
    saveSeat(store, SAVED);
    new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store, tabs: memoryTabs() }, SAVED, { rejoining: true });
    expect(sockets.made).toHaveLength(0);
    vi.advanceTimersByTime(CLAIM_WAIT_MS);
    expect(sockets.made).toHaveLength(1);
  });
});
