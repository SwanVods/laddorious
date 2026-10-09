import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalHost } from '../src/worker/localHost';
import type { FromHost } from '../src/worker/protocol';
import { SEATS } from './support/fixtures';

// The host's own rules are tested in packages/host; this checks the worker's messages reach it.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

function startHost() {
  const sent: FromHost[] = [];
  const host = new LocalHost((msg) => sent.push(structuredClone(msg)));
  host.handle({ type: 'create', seats: SEATS, seed: 'board-seed', rngSeed: 'secret' });
  const updates = () => sent.filter((m) => m.type === 'update').map((m) => m.update);
  return { host, sent, updates, last: () => updates().at(-1)! };
}

describe('LocalHost (the offline worker, spec #2 §4.4)', () => {
  it('starts the match and sends the human seat its opening view', () => {
    const { updates, last } = startHost();
    expect(updates()).toHaveLength(1);
    expect(last().view.me).toBe('p0');
  });

  it("passes the human seat's roll and playback to the match host", () => {
    const { host, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(last().timer).not.toBeNull();
  });

  it('freezes on pause and goes quiet on leave', () => {
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'pause' });
    const count = sent.length;
    vi.advanceTimersByTime(60_000);
    expect(sent).toHaveLength(count);
    host.handle({ type: 'resume' });
    host.handle({ type: 'leave' });
    const after = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(after);
  });

  it('fails a match without a human seat', () => {
    const sent: FromHost[] = [];
    new LocalHost((msg) => sent.push(msg)).handle({ type: 'create', seats: SEATS.map((s) => ({ ...s, bot: true })), seed: 's', rngSeed: 'r' });
    expect(sent).toEqual([{ type: 'failed', message: 'a local match needs a human seat' }]);
  });
});
