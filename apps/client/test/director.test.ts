import type { GameEvent, MoveCause, PlayerId, PlayerView, WindowKind } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS } from '../src/director/beats';
import { Director, LOG_LIMIT, MAX_QUEUED_UPDATES } from '../src/director/director';
import type { MatchUpdate } from '../src/service/matchService';
import { WorkerMatchSession } from '../src/service/workerSession';
import { SEATS, loopbackWorker, openingUpdate } from './support/fixtures';

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice'): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced: false, visibility: 'public' };
}

const hops = (tiles: number) => tiles * BEAT_MS.hopPerTile + BEAT_MS.landing;

/** An update on the fixture's board whose view has the given positions and window. */
function update(
  events: GameEvent[],
  positions: Record<PlayerId, number>,
  windowId: number,
  opts: { timer?: MatchUpdate['timer']; window?: WindowKind } = {},
): MatchUpdate {
  const { view } = openingUpdate();
  const next: PlayerView = {
    ...view,
    players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })),
    awaiting: { ...view.awaiting, windowId, window: opts.window ?? 'dice' },
  };
  return { view: next, events, timer: opts.timer ?? null };
}

/** A director that has already played the opening update. */
function startDirector() {
  const done: number[] = [];
  const warn = vi.fn();
  const director = new Director('p0', (windowId) => done.push(windowId), warn);
  director.push(openingUpdate());
  return { director, done, warn, state: () => director.store.getState() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Director', () => {
  it('logs the win once, although the ranks reveal replays it (polish spec 4.5)', () => {
    const { director, state } = startDirector();
    const won: GameEvent = { type: 'MatchWon', winner: 'p1', rankings: [{ player: 'p1', rank: 1, position: 100 }, { player: 'p0', rank: 2, position: 0 }], visibility: 'public' };
    director.push(update([moved('p1', 0, 100), won], { p1: 100 }, 2, { window: 'none' }));
    vi.advanceTimersByTime(100 * BEAT_MS.hopPerTile + BEAT_MS.landing + BEAT_MS.victory);
    expect(state().beat?.kind).toBe('ranks');
    expect(state().log.filter((l) => l.event.type === 'MatchWon')).toHaveLength(1);
  });

  it('reports playback done at once for an update with nothing to play', () => {
    const { done, state } = startDirector();
    expect(done).toEqual([1]);
    expect(state().settled?.view.awaiting.windowId).toBe(1);
    expect(state().presentation?.positions).toEqual({ p0: 0, p1: 0, p2: 0, p3: 0 });
  });

  it('plays the beats in order, moving the board at the end of each, then reports playback done', () => {
    const { director, done, state } = startDirector();
    director.push(update([moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')], { p1: 14 }, 2));
    expect(state().beat).toMatchObject({ kind: 'move', durationMs: hops(3), startedAt: 0 });
    expect(state().presentation?.positions.p1).toBe(0);
    vi.advanceTimersByTime(hops(3));
    expect(state().presentation?.positions.p1).toBe(3);
    expect(state().beat).toMatchObject({ kind: 'launch', startedAt: hops(3) });
    expect(done).toEqual([1]);
    vi.advanceTimersByTime(BEAT_MS.launch);
    expect(state().presentation?.positions.p1).toBe(14);
    expect(state().beat).toBeNull();
    expect(state().settled?.view.awaiting.windowId).toBe(2);
    expect(done).toEqual([1, 2]);
  });

  it('reports playback done only for an update that opened a window', () => {
    const { director, done } = startDirector();
    director.push(update([], {}, 1, { timer: { windowId: 1, endsAt: 12_000 } }));
    director.push(update([], {}, 9, { window: 'none' }));
    expect(done).toEqual([1]);
  });

  it('queues an update that arrives mid-timeline and plays it after', () => {
    const { director, done, state } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    director.push(update([moved('p2', 0, 2)], { p1: 3, p2: 2 }, 3));
    vi.advanceTimersByTime(hops(3));
    expect(done).toEqual([1, 2]);
    expect(state().beat).toMatchObject({ kind: 'move', events: [moved('p2', 0, 2)] });
    vi.advanceTimersByTime(hops(2));
    expect(done).toEqual([1, 2, 3]);
    expect(state().presentation?.positions).toMatchObject({ p1: 3, p2: 2 });
  });

  it(`fast-forwards to the latest view when more than ${MAX_QUEUED_UPDATES} updates wait`, () => {
    const { director, done, state, warn } = startDirector();
    director.push(update([moved('p1', 0, 20)], { p1: 20 }, 2));
    for (let n = 3; n <= 6; n++) director.push(update([moved('p2', n - 3, n - 2)], { p1: 20, p2: n - 2 }, n));
    expect(state().beat).toBeNull();
    expect(state().settled?.view.awaiting.windowId).toBe(6);
    expect(state().presentation?.positions).toMatchObject({ p1: 20, p2: 4 });
    expect(done).toEqual([1, 6]);
    vi.runAllTimers();
    expect(done).toEqual([1, 6]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('resets the board to the view after a timeline, warning when they differ', () => {
    const { director, state, warn } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 5 }, 2));
    vi.advanceTimersByTime(hops(3));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('drifted');
    expect(state().presentation?.positions.p1).toBe(5);
  });

  it('stops playing when disposed', () => {
    const { director, done } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    director.dispose();
    vi.runAllTimers();
    expect(done).toEqual([1]);
  });
});

describe('Director event log (for the HUD)', () => {
  const totaled = (player: PlayerId, total: number): GameEvent => ({ type: 'DiceTotaled', player, faces: [total], total, visibility: 'public' });
  const logged = (d: Director) => d.store.getState().log.map((l) => l.event);

  it('logs events that take no time at once, and a beat when it starts', () => {
    const { director } = startDirector();
    director.push(update([totaled('p1', 3), moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')], { p1: 14 }, 2));
    expect(logged(director)).toEqual([totaled('p1', 3), moved('p1', 0, 3)]);
    vi.advanceTimersByTime(hops(3));
    expect(logged(director)).toEqual([totaled('p1', 3), moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')]);
    const seqs = director.store.getState().log.map((l) => l.seq);
    expect(seqs).toEqual([1, 2, 3]);
  });

  it('logs the events a fast-forward skips, in order', () => {
    const { director } = startDirector();
    director.push(update([moved('p1', 0, 20), moved('p1', 20, 30, 'ladder')], { p1: 30 }, 2));
    for (let n = 3; n <= 6; n++) director.push(update([moved('p2', n - 3, n - 2)], { p1: 30, p2: n - 2 }, n));
    expect(logged(director)).toEqual([
      moved('p1', 0, 20),
      moved('p1', 20, 30, 'ladder'),
      moved('p2', 0, 1),
      moved('p2', 1, 2),
      moved('p2', 2, 3),
      moved('p2', 3, 4),
    ]);
  });

  it(`keeps only the newest ${LOG_LIMIT} events`, () => {
    const { director } = startDirector();
    const many = Array.from({ length: LOG_LIMIT + 5 }, (_, i) => totaled('p1', (i % 6) + 1));
    director.push(update(many, {}, 2));
    const log = director.store.getState().log;
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.seq).toBe(6);
    expect(log.at(-1)!.seq).toBe(LOG_LIMIT + 5);
  });

  it("never logs another player's private events", () => {
    const { director } = startDirector();
    const theirs: GameEvent = { type: 'MysteryOffered', player: 'p1', tile: 4, rarity: 'common', cards: ['sprint', 'sprint', 'sprint'], visibility: { private: 'p1' } };
    const mine: GameEvent = { ...theirs, player: 'p0', visibility: { private: 'p0' } };
    director.push(update([theirs, mine], {}, 2));
    expect(logged(director)).toEqual([mine]);
  });
});

describe('Director with a real host', () => {
  it('plays a whole match without drifting from the engine', () => {
    const worker = loopbackWorker();
    const session = new WorkerMatchSession(worker, SEATS, { seed: 'director', rngSeed: 'director-secret' });
    const warn = vi.fn();
    const director = new Director(session.me, (windowId) => session.playbackDone(windowId), warn);
    session.onUpdate((u) => director.push(u));
    vi.runAllTimers();
    const { presentation, settled } = director.store.getState();
    expect(settled?.view.phase.kind).toBe('finished');
    expect(warn).not.toHaveBeenCalled();
    expect(presentation?.positions).toEqual(Object.fromEntries(settled!.view.players.map((p) => [p.id, p.position])));
  });
});

describe('Director time scale (e2e builds)', () => {
  it('plays each beat at a fraction of its length', () => {
    const done: number[] = [];
    const director = new Director('p0', (w) => done.push(w), vi.fn(), 0.1);
    director.push(openingUpdate());
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    const short = Math.round(hops(3) * 0.1);
    expect(director.store.getState().beat?.durationMs).toBe(short);
    vi.advanceTimersByTime(short);
    expect(director.store.getState().beat).toBeNull();
    expect(done).toEqual([1, 2]);
  });
});
