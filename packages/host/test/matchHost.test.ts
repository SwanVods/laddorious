import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError, type PlayerId } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, MatchHost, PLAYBACK_CAP_MS, type MatchHostOptions } from '../src/matchHost';
import type { FromHost, MatchUpdate, Seat } from '../src/types';

const SECRET = 'secret-rng-seed-7f3a';

/** You and three bots, as "Play with bots" seats them when you chose the knight. */
const SOLO: Seat[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', bot: true },
];

/** A host on a fresh match. Messages are cloned like postMessage would, so anything uncloneable fails here. */
function startHost(seed = 'board-seed') {
  const sent: FromHost[] = [];
  const host = new MatchHost({ send: (_to, msg) => sent.push(structuredClone(msg)) });
  host.create(SOLO, seed, SECRET);
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

describe('MatchHost window timing', () => {
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
    host.playbackDone('p0', 1);
    expect(last().timer).toEqual({ windowId: 1, endsAt: 3000 + DEFAULT_WINDOWS.diceMs });
  });

  it('starts the countdown after the 12 s cap when playback never finishes', () => {
    const { last } = startHost();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it('ignores playbackDone for another window, and a repeated one', () => {
    const { host, updates } = startHost();
    host.playbackDone('p0', 7);
    expect(updates()).toHaveLength(1);
    host.playbackDone('p0', 1);
    host.playbackDone('p0', 1);
    expect(updates()).toHaveLength(2);
  });

  it('lets each bot act between 0.6 s and 2.5 s into the countdown', () => {
    const { host, last, events } = startHost();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(BOT_DELAY_MIN_MS - 1);
    expect(last().view.awaiting.players).toEqual(['p0', 'p1', 'p2', 'p3']);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1);
    expect(last().view.awaiting.players).toEqual(['p0']);
    const rolled = events().filter((e) => e.type === 'DieRolled').map((e) => e.player);
    expect(rolled.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('times the window out at endsAt: the human seat rolls automatically and the next window waits for playback', () => {
    const { host, last, events } = startHost();
    host.playbackDone('p0', 1);
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

describe('MatchHost visibility (spec #2 §4.2)', () => {
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

describe('MatchHost inputs', () => {
  it("applies the human seat's action, even before the countdown starts", () => {
    const { host, last } = startHost();
    host.action('p0', { type: 'roll' }, 1);
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    expect(last().view.awaiting.players).toEqual(['p1', 'p2', 'p3']);
    expect(last().timer).toBeNull();
  });

  it('rejects a bad action with the engine error code and leaves the match unchanged', () => {
    const { host, sent, updates, last } = startHost();
    host.action('p0', { type: 'roll' }, 99);
    host.action('p0', { type: 'pickCard', slot: 0 }, 1);
    expect(sent.filter((m) => m.type === 'rejected').map((m) => m.error.code)).toEqual(['STALE_INPUT', 'WRONG_PHASE']);
    expect(updates()).toHaveLength(1);
    host.action('p0', { type: 'roll' }, 1);
    expect(last().view.awaiting.players).not.toContain('p0');
  });
});

describe('MatchHost pause and resume (spec #2 C14)', () => {
  it('freezes the countdown and the bots while paused, and sends the new end time on resume', () => {
    const { host, updates, last } = startHost();
    host.playbackDone('p0', 1);
    const endsAt = last().timer!.endsAt;
    host.pause();
    vi.advanceTimersByTime(60_000);
    expect(updates()).toHaveLength(2); // no bot rolled and the window did not time out
    host.resume();
    expect(last().timer).toEqual({ windowId: 1, endsAt: endsAt + 60_000 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs);
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('freezes the playback cap too', () => {
    const { host, last } = startHost();
    host.pause();
    vi.advanceTimersByTime(60_000);
    expect(last().timer).toBeNull();
    host.resume();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).not.toBeNull();
  });
});

describe('MatchHost failures', () => {
  it('fails and stops when the match cannot be created', () => {
    const sent: FromHost[] = [];
    const host = new MatchHost({ send: (_to, msg) => sent.push(msg) });
    host.create([SOLO[0]!, SOLO[0]!], 's', 'r');
    expect(sent).toEqual([{ type: 'failed', message: 'player ids must be unique' }]);
    host.action('p0', { type: 'roll' }, 1);
    expect(sent).toHaveLength(1);
  });

  it('fails and stops when a timer throws, such as an engine InvariantError', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { host, sent } = startHost();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.at(-1)).toEqual({ type: 'failed', message: 'board corrupted' });
    const count = sent.length;
    vi.runAllTimers();
    host.resume();
    expect(sent).toHaveLength(count);
  });

  it('stops on stop', () => {
    const { host, sent } = startHost();
    host.playbackDone('p0', 1);
    host.stop();
    const count = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(count);
  });
});

describe('MatchHost fast mode (e2e builds, spec #2 §9.3)', () => {
  it('plays every seat itself, the human one included, and finishes a match quickly', () => {
    const sent: FromHost[] = [];
    const host = new MatchHost({ send: (_to, msg) => sent.push(msg), fast: true });
    host.create(SOLO, 'board-seed', SECRET);
    const events = () => sent.flatMap((m) => (m.type === 'update' ? m.update.events : []));
    for (let t = 0; t < 600_000 && !events().some((e) => e.type === 'MatchWon'); t += 100) vi.advanceTimersByTime(100);
    expect(events().some((e) => e.type === 'MatchWon')).toBe(true);
    const myRolls = events().filter((e) => e.type === 'DieRolled' && e.player === 'p0');
    expect(myRolls.length).toBeGreaterThan(0);
    expect(myRolls.every((e) => e.type === 'DieRolled' && !e.auto)).toBe(true);
    expect(sent.some((m) => m.type === 'failed' || m.type === 'rejected')).toBe(false);
  });
});

/** Two humans and two bots, as an online table seats them. */
const PAIR: Seat[] = [
  { playerId: 'p0', nickname: 'Ari', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Bo', piece: 'pawn', bot: false },
  { playerId: 'p2', nickname: 'Mochi', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Pip', piece: 'dragon', bot: true },
];

/** A host with two humans; what it sends is recorded per seat. */
function startTable(opts: Omit<MatchHostOptions, 'send'> = {}) {
  const sent: Array<{ to: PlayerId; msg: FromHost }> = [];
  const host = new MatchHost({ send: (to, msg) => sent.push({ to, msg: structuredClone(msg) }), ...opts });
  host.create(PAIR, 'board-seed', SECRET);
  const updates = (to: PlayerId): MatchUpdate[] => sent.flatMap((s) => (s.to === to && s.msg.type === 'update' ? [s.msg.update] : []));
  const last = (to: PlayerId) => updates(to).at(-1)!;
  const events = (to: PlayerId) => updates(to).flatMap((u) => u.events);
  return { host, sent, updates, last, events };
}

describe('MatchHost with several humans (spec #4 §3.1)', () => {
  it('sends each human only their own view and events', () => {
    const { sent, updates, events } = startTable();
    vi.runAllTimers();
    for (const me of ['p0', 'p1']) {
      expect(updates(me).length).toBeGreaterThan(10);
      for (const u of updates(me)) {
        expect(u.view.me).toBe(me);
        for (const e of u.events) expect(e.visibility === 'public' || e.visibility.private === me).toBe(true);
      }
      expect(events(me).some((e) => e.type === 'MysteryOffered' && e.player !== me)).toBe(false);
    }
    expect(updates('p0')).toHaveLength(updates('p1').length);
    expect(sent.every((s) => s.to === 'p0' || s.to === 'p1')).toBe(true);
    expect(JSON.stringify(sent)).not.toContain(SECRET);
  });

  it('starts the countdown once every connected human has watched the playback', () => {
    const { host, last } = startTable();
    vi.advanceTimersByTime(2000);
    host.playbackDone('p0', 1);
    expect(last('p0').timer).toBeNull();
    host.playbackDone('p1', 1);
    expect(last('p0').timer).toEqual({ windowId: 1, endsAt: 2000 + DEFAULT_WINDOWS.diceMs });
    expect(last('p1').timer).toEqual(last('p0').timer);
  });

  it('caps the wait for a slow player at 12 s', () => {
    const { host, last } = startTable();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last('p1').timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it("applies each human's action to their own seat, and rejects only to the sender", () => {
    const { host, sent, events, last } = startTable();
    host.action('p1', { type: 'roll' }, 1);
    expect(events('p0')).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p1', auto: false }));
    expect(last('p0').view.awaiting.players).toEqual(['p0', 'p2', 'p3']);
    host.action('p0', { type: 'pickCard', slot: 0 }, 1);
    expect(sent.filter((s) => s.msg.type === 'rejected').map((s) => s.to)).toEqual(['p0']);
  });

  it('stops updating an away human and never waits for their playback; a returning human hears again', () => {
    const { host, updates, last } = startTable();
    host.setAway('p1', true);
    const before = updates('p1').length;
    host.playbackDone('p0', 1);
    expect(last('p0').timer).not.toBeNull();
    expect(updates('p1')).toHaveLength(before);
    host.setAway('p1', false);
    host.action('p0', { type: 'roll' }, 1);
    expect(updates('p1').length).toBeGreaterThan(before);
  });

  it('times a window out at once when only away humans are left in it (spec #4 M3)', () => {
    const { host, events, last } = startTable();
    host.setAway('p1', true);
    host.playbackDone('p0', 1);
    host.action('p0', { type: 'roll' }, 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS); // the bots roll; only the away seat is left
    expect(BOT_DELAY_MAX_MS).toBeLessThan(DEFAULT_WINDOWS.diceMs); // well before the window's own timeout
    expect(events('p0')).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p1', auto: true }));
    expect(last('p0').view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('never closes windows early while no human is connected', () => {
    const { host, last } = startTable();
    host.setAway('p0', true);
    host.setAway('p1', true);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    host.setAway('p0', false);
    host.resync('p0');
    expect(last('p0').view.awaiting).toMatchObject({ windowId: 1, players: ['p0', 'p1'] });
  });

  it('resyncs one human with the current view, no events and the running countdown', () => {
    const { host, sent, last } = startTable();
    host.playbackDone('p0', 1);
    host.playbackDone('p1', 1);
    const count = sent.length;
    host.resync('p1');
    expect(sent.slice(count).map((s) => s.to)).toEqual(['p1']);
    expect(last('p1')).toMatchObject({ events: [], timer: { windowId: 1, endsAt: DEFAULT_WINDOWS.diceMs } });
    expect(last('p1').view.me).toBe('p1');
  });

  it('reports the end once when the match is won', () => {
    const onEnd = vi.fn();
    const host = new MatchHost({ send: () => {}, onEnd });
    host.create(SOLO, 'board-seed', SECRET);
    vi.runAllTimers();
    expect(onEnd.mock.calls).toEqual([['won']]);
  });

  it('tells every human and reports the end when the host fails', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const onEnd = vi.fn();
    const { host, sent } = startTable({ onEnd });
    host.playbackDone('p0', 1);
    host.playbackDone('p1', 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.filter((s) => s.msg.type === 'failed').map((s) => s.to)).toEqual(['p0', 'p1']);
    expect(onEnd.mock.calls).toEqual([['failed']]);
  });
});
