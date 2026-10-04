import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_SEAT_MS, LocalMatchService, SEARCH_TICK_MS } from '../src/service/localMatchService';
import type { MatchmakingState, Profile } from '../src/service/matchService';
import { FakeWorker } from './support/fixtures';

const ARI: Profile = { nickname: 'Ari', piece: 'meeple' };

/** A service whose workers are fakes, with every matchmaking state recorded. */
function startSearch(profile = ARI) {
  const workers: FakeWorker[] = [];
  const service = new LocalMatchService(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const matchmaking = service.findMatch(profile);
  const states: MatchmakingState[] = [];
  matchmaking.onState((s) => states.push(s));
  const last = () => states.at(-1)!;
  const filled = () => states.filter((s) => s.kind === 'filling').map((s) => s.seats.filter((seat) => seat !== null).length);
  return { matchmaking, states, last, filled, workers };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LocalMatchService', () => {
  it('reports searching every 250 ms with you in seat 0 and three open seats', () => {
    const { states } = startSearch();
    vi.advanceTimersByTime(4 * SEARCH_TICK_MS);
    expect(states.map((s) => (s.kind === 'searching' ? s.elapsedMs : s.kind))).toEqual([0, 250, 500, 750, 1000]);
    expect(states[0]).toEqual({
      kind: 'searching',
      elapsedMs: 0,
      seats: [{ playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false }, null, null, null],
    });
  });

  it('never finds a real player', () => {
    const { last, workers } = startSearch();
    vi.advanceTimersByTime(10 * 60_000);
    expect(last().kind).toBe('searching');
    expect(workers).toHaveLength(0);
  });

  it('fills the open seats with bots 420 ms apart, then finds the match', () => {
    const { matchmaking, last, filled } = startSearch();
    matchmaking.playWithBots();
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(BOT_SEAT_MS - 1);
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(filled()).toEqual([1, 2]);
    vi.advanceTimersByTime(2 * BOT_SEAT_MS);
    expect(filled()).toEqual([1, 2, 3, 4]);
    expect(last().kind).toBe('found');
    vi.advanceTimersByTime(10_000);
    expect(last().kind).toBe('found'); // searching stopped for good
  });

  it('seats Mochi, Pip and Juno in their colours, on the pieces you did not choose, in picker order', () => {
    const { matchmaking, last } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    const found = last();
    if (found.kind !== 'found') throw new Error(`expected found, got ${found.kind}`);
    expect(found.session.me).toBe('p0');
    expect(found.session.seats).toEqual([
      { playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false },
      { playerId: 'p1', nickname: 'Mochi', piece: 'knight', color: '#3b82f6', bot: true },
      { playerId: 'p2', nickname: 'Pip', piece: 'pawn', color: '#a3e635', bot: true },
      { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
    ]);
  });

  it('starts one worker with two different random seeds', () => {
    const { matchmaking, workers } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    expect(workers).toHaveLength(1);
    const create = workers[0]!.posted[0];
    if (create?.type !== 'create') throw new Error('expected a create message first');
    expect(create.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.rngSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.seed).not.toBe(create.rngSeed);
  });

  it('cancels while searching, then ignores play with bots', () => {
    const { matchmaking, states, last, workers } = startSearch();
    matchmaking.cancel();
    expect(last()).toEqual({ kind: 'cancelled' });
    const count = states.length;
    matchmaking.playWithBots();
    vi.advanceTimersByTime(10_000);
    expect(states).toHaveLength(count);
    expect(workers).toHaveLength(0);
  });

  it('ignores cancel once filling has started, and a second play with bots: one match starts', () => {
    const { matchmaking, states, workers } = startSearch();
    matchmaking.playWithBots();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(BOT_SEAT_MS);
    matchmaking.cancel();
    vi.advanceTimersByTime(10 * BOT_SEAT_MS);
    expect(states.filter((s) => s.kind === 'found')).toHaveLength(1);
    expect(states.some((s) => s.kind === 'cancelled')).toBe(false);
    expect(workers).toHaveLength(1);
  });

  it('stops calling a listener that unsubscribed', () => {
    const service = new LocalMatchService(() => new FakeWorker());
    const states: MatchmakingState[] = [];
    const off = service.findMatch(ARI).onState((s) => states.push(s));
    off();
    vi.advanceTimersByTime(1000);
    expect(states).toHaveLength(1);
  });
});
