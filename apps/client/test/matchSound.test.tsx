// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrefsStore } from '../src/app/prefs';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider } from '../src/audio/SoundProvider';
import { useMatchSound } from '../src/audio/useMatchSound';
import { Director } from '../src/director/director';
import { openingUpdate } from './support/fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(timeScale = 1) {
  const engine = new AudioEngine(() => new Promise(() => {}));
  const play = vi.spyOn(engine, 'play');
  const playNow = vi.spyOn(engine, 'playNow');
  const director = new Director('p0', () => {}, vi.fn(), timeScale);
  function Probe() {
    useMatchSound(director, 'p0', 100, timeScale);
    return null;
  }
  render(
    <SoundProvider engine={engine} prefs={createPrefsStore(null, { prefersReducedMotion: false })}>
      <Probe />
    </SoundProvider>,
  );
  const push = (events: GameEvent[], awaiting = openingUpdate().view.awaiting, timer: { windowId: number; endsAt: number } | null = null) =>
    act(() => director.push({ ...openingUpdate(), view: { ...openingUpdate().view, awaiting }, events, timer }));
  return { play, playNow, push };
}

const rolled = (player: string, face: number): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced: false, auto: false, visibility: 'public' });

describe('useMatchSound (spec #3 §5)', () => {
  it("plays each beat's cues as it starts, scaled by the director's time scale", () => {
    const { play, push } = setup(0.5);
    push([rolled('p1', 2), rolled('p0', 5)]);
    expect(play.mock.calls.map(([c]) => [c.id, c.atMs, c.soft])).toEqual([
      ['D3', 0, true],
      ['D2', 0, false],
    ]);
  });

  it('zings when my total differs from my face, from the log', () => {
    const { play, push } = setup();
    push([rolled('p0', 6)]);
    act(() => vi.advanceTimersByTime(1000));
    push([{ type: 'DiceTotaled', player: 'p0', faces: [6], total: 12, visibility: 'public' }]);
    expect(play.mock.calls.at(-1)![0]).toMatchObject({ id: 'D6' });
  });

  it('chimes once when a dice window opens for me, and ticks in its last 3 seconds', () => {
    const { playNow, push } = setup();
    const awaiting = { windowId: 2, window: 'dice' as const, players: ['p0', 'p1'], durationMs: 12_000 };
    push([], awaiting, { windowId: 2, endsAt: 5_000 });
    expect(playNow).toHaveBeenCalledWith('D1');
    act(() => vi.advanceTimersByTime(2_100));
    expect(playNow.mock.calls.filter(([id]) => id === 'D4')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(2_000));
    expect(playNow.mock.calls.filter(([id]) => id === 'D4')).toHaveLength(3);
    expect(playNow.mock.calls.filter(([id]) => id === 'D1')).toHaveLength(1);
  });
});
