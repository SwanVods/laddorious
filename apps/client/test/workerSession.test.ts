import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchUpdate } from '../src/service/matchService';
import { STATS_WAIT_MS, WorkerMatchSession } from '../src/service/workerSession';
import type { MatchStats } from '@laddorious/host';
import { FakeWorker, SEATS, loopbackWorker, openingUpdate } from './support/fixtures';

const SEEDS = { seed: 'board-seed', rngSeed: 'secret-rng-seed' };

describe('WorkerMatchSession match stats (2026-10-17)', () => {
  const STATS = { match: { mode: 'offline' }, players: [], cards: [] } as unknown as MatchStats;

  it("asks the worker for stats with this device's key, and passes its report on", () => {
    const worker = new FakeWorker();
    const report = vi.fn();
    new WorkerMatchSession(worker, SEATS, SEEDS, false, { playerKey: 'key-me', version: '0.2.0', report });
    expect(worker.posted[0]).toMatchObject({ type: 'create', stats: { playerKey: 'key-me', version: '0.2.0' } });
    worker.reply({ type: 'stats', stats: STATS });
    expect(report).toHaveBeenCalledWith(STATS);
  });

  it("on leave, waits for the worker's last report before stopping it, but not for long", () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS, false, { playerKey: 'k', version: '0.2.0', report });
    session.leave();
    expect(worker.terminated).toBe(false);
    worker.reply({ type: 'stats', stats: STATS });
    expect(report).toHaveBeenCalledTimes(1);
    expect(worker.terminated).toBe(true);
    const silent = new FakeWorker();
    new WorkerMatchSession(silent, SEATS, SEEDS, false, { playerKey: 'k', version: '0.2.0', report }).leave();
    vi.advanceTimersByTime(STATS_WAIT_MS);
    expect(silent.terminated).toBe(true);
    vi.useRealTimers();
  });

  it('stops the worker at once on leave without stats', () => {
    const worker = new FakeWorker();
    new WorkerMatchSession(worker, SEATS, SEEDS).leave();
    expect(worker.terminated).toBe(true);
  });
});

describe('WorkerMatchSession', () => {
  it('never reports anyone away', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: string[][] = [];
    const off = session.onPresence((away) => got.push(away));
    worker.reply({ type: 'update', update: openingUpdate() });
    off();
    expect(got).toEqual([]);
  });

  it('starts the match with a create message, and its human seat is me', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    expect(worker.posted).toEqual([{ type: 'create', seats: SEATS, seed: 'board-seed', rngSeed: 'secret-rng-seed', fast: false }]);
    expect(session.me).toBe('p0');
    expect(session.seats).toBe(SEATS);
  });

  it("stamps each action with the latest update's window", () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    session.onUpdate(() => {});
    const update = openingUpdate();
    worker.reply({ type: 'update', update: { ...update, view: { ...update.view, awaiting: { ...update.view.awaiting, windowId: 4 } } } });
    session.send({ type: 'roll' });
    expect(worker.posted.at(-1)).toEqual({ type: 'action', action: { type: 'roll' }, windowId: 4 });
  });

  it('posts playbackDone, pause and resume', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    session.playbackDone(3);
    session.pause();
    session.resume();
    expect(worker.posted.slice(1)).toEqual([{ type: 'playbackDone', windowId: 3 }, { type: 'pause' }, { type: 'resume' }]);
  });

  it('holds messages that arrive before the first subscriber and hands them over', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const update = openingUpdate();
    worker.reply({ type: 'update', update });
    worker.reply({ type: 'rejected', error: { code: 'STALE_INPUT', message: 'late' } });
    worker.reply({ type: 'failed', message: 'boom' });
    const got: unknown[] = [];
    session.onUpdate((u) => got.push(u));
    session.onRejected((e) => got.push(e));
    session.onFailed((e) => got.push(e));
    expect(got).toEqual([update, { code: 'STALE_INPUT', message: 'late' }, { message: 'boom' }]);
  });

  it('reports a worker that fails to load as a failed match', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const failures: Array<{ message: string }> = [];
    session.onFailed((e) => failures.push(e));
    worker.crash('');
    expect(failures).toEqual([{ message: 'the match worker stopped' }]);
  });

  it('stops delivering to a listener that unsubscribed', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: MatchUpdate[] = [];
    const off = session.onUpdate((u) => got.push(u));
    worker.reply({ type: 'update', update: openingUpdate() });
    off();
    worker.reply({ type: 'update', update: openingUpdate() });
    expect(got).toHaveLength(1);
  });

  it('leaves by posting leave and terminating the worker, then goes quiet', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: MatchUpdate[] = [];
    session.onUpdate((u) => got.push(u));
    session.leave();
    expect(worker.posted.at(-1)).toEqual({ type: 'leave' });
    expect(worker.terminated).toBe(true);
    session.send({ type: 'roll' });
    worker.reply({ type: 'update', update: openingUpdate() });
    expect(worker.posted.at(-1)).toEqual({ type: 'leave' });
    expect(got).toEqual([]);
  });
});

describe('WorkerMatchSession with a real host', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays a whole match: playback reported at once, the human rolls in every dice window', () => {
    const worker = loopbackWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const updates: MatchUpdate[] = [];
    let rolledIn = -1;
    session.onUpdate((u) => {
      updates.push(u);
      const aw = u.view.awaiting;
      if (u.timer === null && aw.window !== 'none') session.playbackDone(aw.windowId);
      if (aw.window === 'dice' && aw.players.includes(session.me) && rolledIn !== aw.windowId) {
        rolledIn = aw.windowId;
        session.send({ type: 'roll' });
      }
    });
    vi.runAllTimers();
    expect(updates.at(-1)!.view.phase.kind).toBe('finished');
    const myRolls = updates.flatMap((u) => u.events).filter((e) => e.type === 'DieRolled' && e.player === 'p0');
    // Every round but the ones a card made me skip, plus my extra rolls from Encore (2026-10-16).
    const all = updates.flatMap((u) => u.events);
    const skipped = all.filter((e) => e.type === 'RollSkipped' && e.player === 'p0').length;
    const extra = all.filter((e) => e.type === 'ExtraRoll' && e.players.includes('p0')).length;
    expect(myRolls.length).toBe(updates.at(-1)!.view.round - skipped + extra);
    expect(myRolls.every((e) => e.type === 'DieRolled' && !e.auto)).toBe(true);
    expect(worker.fromHost.some((m) => m.type === 'rejected' || m.type === 'failed')).toBe(false);
  });
});
