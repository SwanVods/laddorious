// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevMatchPage, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/DevMatchPage';
import type { Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';

/** Matchmaking the test drives by hand. */
class ScriptedMatchmaking implements Matchmaking {
  private listener: ((s: MatchmakingState) => void) | null = null;
  cancel = vi.fn();
  playWithBots = vi.fn();

  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }

  emit(s: MatchmakingState): void {
    act(() => this.listener?.(s));
  }
}

/** A session the test drives by hand. */
class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private failed: ((e: { message: string }) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {};
  }

  onRejected(): () => void {
    return () => {};
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    this.failed = cb;
    return () => {};
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  fail(message: string): void {
    act(() => this.failed?.({ message }));
  }
}

function startSearch() {
  const matchmaking = new ScriptedMatchmaking();
  const findMatch = vi.fn(() => matchmaking);
  render(<DevMatchPage service={{ findMatch }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Find match' }));
  return { matchmaking, findMatch };
}

function startMatch() {
  const { matchmaking } = startSearch();
  const session = new ScriptedSession();
  matchmaking.emit({ kind: 'found', session });
  return session;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DevMatchPage', () => {
  it('searches with the dev profile and offers Play with bots only after 15 s', () => {
    const { matchmaking, findMatch } = startSearch();
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'You', piece: 'knight' });
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS - 250, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByText('Finding players… 14 s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('logs each update, reports playback at once and counts the window down', () => {
    const session = startMatch();
    const opening = openingUpdate();
    session.update(opening);
    expect(session.playbackDone).toHaveBeenCalledWith(1);
    expect(screen.getByText('Round 1 · dice window · waiting for You, Mochi, Pip, Juno · waiting for playback')).toBeTruthy();

    const roll: GameEvent = { type: 'DieRolled', player: 'p1', natural: 5, face: 5, forced: false, auto: false, visibility: 'public' };
    session.update({ ...opening, events: [roll], timer: { windowId: 1, endsAt: 12_000 } });
    expect(screen.getByText(/DieRolled player=Mochi natural=5/)).toBeTruthy();
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 12 s$/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 7 s$/)).toBeTruthy();
    expect(session.playbackDone).toHaveBeenCalledTimes(1);
  });

  it('shows the final rankings when the match is over', () => {
    const session = startMatch();
    const { view } = openingUpdate();
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.getByText('Round 21 · match over')).toBeTruthy();
    expect(screen.getByText('1. Pip — tile 100')).toBeTruthy();
    expect(screen.getByText('4. Mochi — tile 41')).toBeTruthy();
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('pauses the match while the page is hidden', () => {
    const session = startMatch();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('logs a failed match, and Leave ends the session and returns to the start', () => {
    const session = startMatch();
    session.fail('board corrupted');
    expect(screen.getByText(/FAILED board corrupted/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Find match' })).toBeTruthy();
  });
});
