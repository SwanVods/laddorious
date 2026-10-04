import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, LocalHost, PLAYBACK_CAP_MS } from '../src/worker/localHost';
import type { FromHost } from '../src/worker/protocol';
import { SEATS } from './support/fixtures';

const SECRET = 'secret-rng-seed-7f3a';

/** A host on a fresh match. Messages are cloned like postMessage would, so anything uncloneable fails here. */
function startHost(seed = 'board-seed') {
  const sent: FromHost[] = [];
  const host = new LocalHost((msg) => sent.push(structuredClone(msg)));
  host.handle({ type: 'create', seats: SEATS, seed, rngSeed: SECRET });
  const updates = () => sent.filter((m) => m.type === 'update').map((m) => m.update);
  const last = () => updates().at(-1)!;
  const events = () => updates().flatMap((u) => u.events);
  return { host, sent, updates, last, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LocalHost window timing', () => {
  it('opens round 1 with every seat awaited and no countdown until playback is done', () => {
    const { updates, last } = startHost();
    expect(updates()).toHaveLength(1);
    expect(last().view.round).toBe(1);
    expect(last().view.awaiting).toMatchObject({ windowId: 1, window: 'dice', players: ['p0', 'p1', 'p2', 'p3'] });
    expect(last().timer).toBeNull();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS - 1);
    expect(updates()).toHaveLength(1); // no countdown, and no bot has rolled
  });

  it('starts the countdown as soon as the human seat reports playback done', () => {
    const { host, last } = startHost();
    vi.advanceTimersByTime(3000);
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(last().timer).toEqual({ windowId: 1, endsAt: 3000 + DEFAULT_WINDOWS.diceMs });
  });

  it('starts the countdown after the 12 s cap when playback never finishes', () => {
    const { last } = startHost();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it('ignores playbackDone for another window, and a repeated one', () => {
    const { host, updates } = startHost();
    host.handle({ type: 'playbackDone', windowId: 7 });
    expect(updates()).toHaveLength(1);
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(updates()).toHaveLength(2);
  });

  it('lets each bot act between 0.6 s and 2.5 s into the countdown', () => {
    const { host, last, events } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MIN_MS - 1);
    expect(last().view.awaiting.players).toEqual(['p0', 'p1', 'p2', 'p3']);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1);
    expect(last().view.awaiting.players).toEqual(['p0']);
    const rolled = events().filter((e) => e.type === 'DieRolled').map((e) => e.player);
    expect(rolled.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('times the window out at endsAt: the human seat rolls automatically and the next window waits for playback', () => {
    const { host, last, events } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs - 1);
    expect(last().view.awaiting.windowId).toBe(1);
    vi.advanceTimersByTime(1);
    expect(events()).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: true }));
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
    expect(last().timer).toBeNull();
  });

  it('plays a whole match to the end on timers alone when the human never acts', () => {
    const { last } = startHost();
    vi.runAllTimers();
    expect(last().view.phase.kind).toBe('finished');
    expect(last().view.awaiting.window).toBe('none');
    expect(last().timer).toBeNull();
  });
});

describe('LocalHost visibility (spec #2 §4.2)', () => {
  it('sends only the human seat its own view and events, and never the rng seed', () => {
    const { sent, updates, events } = startHost();
    vi.runAllTimers();
    for (const u of updates()) {
      expect(u.view.me).toBe('p0');
      if (u.view.myOffer) expect(u.view.myOffer.player).toBe('p0');
      for (const e of u.events) expect(e.visibility === 'public' || e.visibility.private === 'p0').toBe(true);
    }
    // The bots were offered cards (their picks were revealed), but their hands never arrived.
    expect(events().some((e) => e.type === 'CardSelected' && e.player !== 'p0')).toBe(true);
    expect(events().some((e) => e.type === 'MysteryOffered' && e.player !== 'p0')).toBe(false);
    expect(JSON.stringify(sent)).not.toContain(SECRET);
  });
});

describe('LocalHost inputs', () => {
  it("applies the human seat's action, even before the countdown starts", () => {
    const { host, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    expect(last().view.awaiting.players).toEqual(['p1', 'p2', 'p3']);
    expect(last().timer).toBeNull();
  });

  it('rejects a bad action with the engine error code and leaves the match unchanged', () => {
    const { host, sent, updates, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 99 });
    host.handle({ type: 'action', action: { type: 'pickCard', slot: 0 }, windowId: 1 });
    expect(sent.filter((m) => m.type === 'rejected').map((m) => m.error.code)).toEqual(['STALE_INPUT', 'WRONG_PHASE']);
    expect(updates()).toHaveLength(1);
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().view.awaiting.players).not.toContain('p0');
  });
});

describe('LocalHost pause and resume (spec #2 C14)', () => {
  it('freezes the countdown and the bots while paused, and sends the new end time on resume', () => {
    const { host, updates, last } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    const endsAt = last().timer!.endsAt;
    host.handle({ type: 'pause' });
    vi.advanceTimersByTime(60_000);
    expect(updates()).toHaveLength(2); // no bot rolled and the window did not time out
    host.handle({ type: 'resume' });
    expect(last().timer).toEqual({ windowId: 1, endsAt: endsAt + 60_000 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs);
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('freezes the playback cap too', () => {
    const { host, last } = startHost();
    host.handle({ type: 'pause' });
    vi.advanceTimersByTime(60_000);
    expect(last().timer).toBeNull();
    host.handle({ type: 'resume' });
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).not.toBeNull();
  });
});

describe('LocalHost failures', () => {
  it('fails and stops when the match cannot be created', () => {
    const sent: FromHost[] = [];
    const host = new LocalHost((msg) => sent.push(msg));
    host.handle({ type: 'create', seats: [SEATS[0]!, SEATS[0]!], seed: 's', rngSeed: 'r' });
    expect(sent).toEqual([{ type: 'failed', message: 'player ids must be unique' }]);
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(sent).toHaveLength(1);
  });

  it('fails and stops when a timer throws, such as an engine InvariantError', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.at(-1)).toEqual({ type: 'failed', message: 'board corrupted' });
    const count = sent.length;
    vi.runAllTimers();
    host.handle({ type: 'resume' });
    expect(sent).toHaveLength(count);
  });

  it('stops on leave', () => {
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'leave' });
    const count = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(count);
  });
});
