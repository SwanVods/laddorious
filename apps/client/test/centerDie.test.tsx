// @vitest-environment jsdom
import type { GameEvent, PlayerId } from '@laddorious/core';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS } from '../src/director/beats';
import { Director } from '../src/director/director';
import { CENTER_DIE, CenterDie } from '../src/hud/CenterDie';
import { openingUpdate } from './support/fixtures';

const rolled = (player: PlayerId, face: number, opts: { forced?: boolean; auto?: boolean } = {}): GameEvent => ({
  type: 'DieRolled',
  player,
  natural: face,
  face,
  forced: opts.forced ?? false,
  auto: opts.auto ?? false,
  visibility: 'public',
});
const totaled = (player: PlayerId, total: number, faces: number[]): GameEvent => ({ type: 'DiceTotaled', player, faces, total, visibility: 'public' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function start(reducedMotion = false) {
  const director = new Director('p0', () => {}, vi.fn());
  act(() => director.push(openingUpdate()));
  render(<CenterDie director={director} me="p0" reducedMotion={reducedMotion} timeScale={1} />);
  return (events: GameEvent[]) => act(() => director.push({ ...openingUpdate(), events }));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const die = () => screen.queryByRole('status', { name: /You rolled/ });

describe('CenterDie (polish spec §4.2)', () => {
  it('tumbles in the centre, then lands on my face', () => {
    const push = start();
    push([rolled('p1', 3), rolled('p0', 4)]);
    expect(die()?.getAttribute('aria-label')).toBe('You rolled 4');
    expect(die()?.querySelector('.die-face.tumbling')).toBeTruthy();
    advance(BEAT_MS.roll + CENTER_DIE.tumbleStepMs);
    expect(die()?.querySelector('.die-face.tumbling')).toBeNull();
    expect(screen.getByRole('img', { name: '4' })).toBeTruthy();
  });

  it("never shows another player's roll", () => {
    const push = start();
    push([rolled('p1', 5)]);
    expect(die()).toBeNull();
  });

  it('shows an automatic roll on timeout too', () => {
    const push = start();
    push([rolled('p0', 2, { auto: true })]);
    expect(die()?.getAttribute('aria-label')).toBe('You rolled 2');
  });

  it('marks a face a card forced', () => {
    const push = start();
    push([rolled('p0', 6, { forced: true })]);
    advance(BEAT_MS.roll + CENTER_DIE.tumbleStepMs);
    expect(screen.getByText('Forced')).toBeTruthy();
  });

  it('says how far I move when a card changes my total, and stays quiet when it does not', () => {
    const push = start();
    push([rolled('p0', 6)]);
    advance(BEAT_MS.roll);
    push([totaled('p0', 12, [6])]);
    expect(screen.getByText('Move 12')).toBeTruthy();
    advance(CENTER_DIE.moveMs + CENTER_DIE.tumbleStepMs);
    expect(screen.queryByText('Move 12')).toBeNull();

    push([rolled('p0', 3)]);
    advance(BEAT_MS.roll);
    push([totaled('p0', 3, [3])]);
    expect(screen.queryByText(/^Move/)).toBeNull();
  });

  it('fades out and leaves 1.85 s after the roll began', () => {
    const push = start();
    push([rolled('p0', 5)]);
    advance(CENTER_DIE.holdMs + CENTER_DIE.tumbleStepMs);
    expect(die()?.classList.contains('leaving')).toBe(true);
    advance(CENTER_DIE.fadeMs);
    expect(die()).toBeNull();
  });

  it('skips the tumble with reduced motion', () => {
    const push = start(true);
    push([rolled('p0', 1)]);
    expect(die()?.querySelector('.die-face.tumbling')).toBeNull();
    expect(screen.getByRole('img', { name: '1' })).toBeTruthy();
  });
});
