// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { wantsFullscreen } from '../src/app/fullscreen';
import { COUNT_MS } from '../src/app/MatchmakingOverlay';
import { createPrefsStore } from '../src/app/prefs';
import { BEAT_MS } from '../src/director/beats';
import type { MatchService } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';
import { ScriptedMatchmaking, ScriptedSession } from './support/scripted';

const crash = vi.hoisted(() => ({ menu: false }));

// jsdom has no WebGL: stand both scenes in with labelled boxes.
vi.mock('../src/scene/MenuScene', async () => {
  const { createElement } = await import('react');
  return {
    MenuScene: ({ setting }: { setting: string }) => {
      if (crash.menu) throw new Error('menu exploded');
      return createElement('div', { role: 'img', 'aria-label': `Podium, ${setting}` });
    },
  };
});
vi.mock('../src/scene/MatchScene', async () => {
  const { createElement } = await import('react');
  return { MatchScene: () => createElement('div', { role: 'img', 'aria-label': 'Match board' }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  crash.menu = false;
});

function setup(dev = false) {
  const made: ScriptedMatchmaking[] = [];
  const findMatch = vi.fn(() => {
    const matchmaking = new ScriptedMatchmaking();
    made.push(matchmaking);
    return matchmaking;
  });
  const service: MatchService = { findMatch };
  const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
  const { container } = render(<App service={service} prefs={prefs} dev={dev} />);
  return { findMatch, made, prefs, container };
}

/** PLAY, then the bots, MATCH FOUND and the countdown: the match screen with a scripted session. */
function startMatch(made: ScriptedMatchmaking[]) {
  fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
  const session = new ScriptedSession();
  made.at(-1)!.emit({ kind: 'found', session });
  act(() => vi.advanceTimersByTime(3 * COUNT_MS));
  session.update(openingUpdate());
  return session;
}

const rankings = [
  { player: 'p2', rank: 1, position: 100 },
  { player: 'p0', rank: 2, position: 87 },
  { player: 'p3', rank: 3, position: 60 },
  { player: 'p1', rank: 4, position: 41 },
];

function finish(session: ScriptedSession) {
  const { view } = openingUpdate();
  session.update({
    view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
    events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
    timer: null,
  });
  // The winner cam, then the ranks reveal for 2nd, 3rd and 4th (polish spec 4.5).
  act(() => vi.advanceTimersByTime(BEAT_MS.victory + 3 * BEAT_MS.rankStep + BEAT_MS.rankHold));
}

describe('App (spec #2 §4.1, §7.1)', () => {
  it('goes menu → matchmaking → match → end, and Play again goes back to matchmaking', () => {
    const { findMatch, made } = setup();
    expect(screen.getByRole('img', { name: 'Podium, auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'Guest5500', piece: 'knight' }, {});
    made[0]!.emit({ kind: 'searching', elapsedMs: 0, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeTruthy();
    const session = new ScriptedSession();
    made[0]!.emit({ kind: 'found', session });
    act(() => vi.advanceTimersByTime(3 * COUNT_MS));
    expect(screen.getByRole('img', { name: 'Match board' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Podium/ })).toBeNull();
    session.update(openingUpdate());
    finish(session);
    expect(screen.getByRole('heading', { name: 'Pip wins!' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(findMatch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('img', { name: 'Podium, auto' })).toBeTruthy();
  });

  it('goes back to the menu from the end screen', () => {
    const { made } = setup();
    const session = startMatch(made);
    finish(session);
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('returns to the menu when the search is cancelled', () => {
    const { made } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    made[0]!.emit({ kind: 'searching', elapsedMs: 0, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(made[0]!.cancel).toHaveBeenCalled();
    made[0]!.emit({ kind: 'cancelled' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('shows the error screen when the match fails, and goes back to the menu', () => {
    const { made } = setup();
    const session = startMatch(made);
    session.fail('InvariantError: bad destination 104');
    expect(screen.getByRole('heading', { name: 'Something went wrong in this match' })).toBeTruthy();
    expect(session.leave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('leaves a match through the leave dialog', () => {
    const { made } = setup();
    const session = startMatch(made);
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('pauses the match while the page is hidden, and only in a match (C14)', () => {
    const { made } = setup();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    const session = startMatch(made);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('opens the settings from the menu, and applies quality and reduced motion', () => {
    const { container, prefs } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Low' }));
    expect(screen.getByRole('img', { name: 'Podium, low' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    expect(prefs.getState().settings.reducedMotion).toBe(true);
    expect(container.querySelector('.app')!.className).toContain('reduced-motion');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });

  it('catches a crash with the error screen, with the error text in dev builds', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    crash.menu = true;
    setup(true);
    expect(screen.getByRole('heading', { name: 'Something went wrong in this match' })).toBeTruthy();
    expect(screen.getByText(/menu exploded/)).toBeTruthy();
    crash.menu = false;
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });
  it('shows the render stats in e2e builds, for the draw-call check', () => {
    const made: ScriptedMatchmaking[] = [];
    const service: MatchService = {
      findMatch: () => {
        const matchmaking = new ScriptedMatchmaking();
        made.push(matchmaking);
        return matchmaking;
      },
    };
    const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
    render(<App service={service} prefs={prefs} dev={false} test={{ fast: true, timeScale: 0.05, drawCalls: () => 0 }} />);
    startMatch(made);
    expect(screen.getByText(/draw calls/)).toBeTruthy();
  });
});

describe('fullscreen on the first tap (spec #2 §7.3)', () => {
  const android = { pointerType: 'touch', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)', platform: 'Linux armv8l', maxTouchPoints: 5, fullscreenEnabled: true, inFullscreen: false };

  it('asks on a touch tap where the browser supports it', () => {
    expect(wantsFullscreen(android)).toBe(true);
    expect(wantsFullscreen({ ...android, fullscreenEnabled: false })).toBe(false);
    expect(wantsFullscreen({ ...android, inFullscreen: true })).toBe(false);
  });

  it('never asks on iPhones and iPads, or for mouse clicks', () => {
    expect(wantsFullscreen({ ...android, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(false);
    expect(wantsFullscreen({ ...android, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' })).toBe(false);
    expect(wantsFullscreen({ ...android, pointerType: 'mouse' })).toBe(false);
  });
});
