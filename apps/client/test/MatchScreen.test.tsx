// @vitest-environment jsdom
import type { PlayerView, PublicChallenge } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchScreen } from '../src/app/MatchScreen';
import { createPrefsStore } from '../src/app/prefs';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider } from '../src/audio/SoundProvider';
import { BEAT_MS } from '../src/director/beats';
import type { MatchUpdate } from '../src/service/matchService';
import { openingUpdate } from './support/fixtures';
import { ScriptedSession } from './support/scripted';

// jsdom has no WebGL: stand the 3D scene in with a labelled box that shows whose piece the camera follows.
vi.mock('../src/scene/MatchScene', async () => {
  const { createElement } = await import('react');
  return {
    MatchScene: ({ watch, setting }: { watch: string | null; setting: string }) =>
      createElement('div', { role: 'img', 'aria-label': `3D board, ${setting}, watching ${watch ?? 'my piece'}` }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function opening(change: Partial<PlayerView> = {}, timer: MatchUpdate['timer'] = null): MatchUpdate {
  const u = openingUpdate();
  return { ...u, view: { ...u.view, ...change }, timer };
}

function start(
  props: {
    onLeave?: () => void;
    onFailed?: (m: string) => void;
    onFinished?: (r: unknown) => void;
    sound?: AudioEngine;
    muted?: boolean;
    onToggleMute?: () => void;
  } = {},
) {
  const session = new ScriptedSession();
  const match = (
    <MatchScreen
      session={session}
      quality="auto"
      reducedMotion={false}
      muted={props.muted}
      onToggleMute={props.onToggleMute}
      onLeave={props.onLeave ?? (() => {})}
      onFailed={props.onFailed ?? (() => {})}
      onFinished={props.onFinished ?? (() => {})}
    />
  );
  render(props.sound ? <SoundProvider engine={props.sound} prefs={createPrefsStore(null, { prefersReducedMotion: false })}>{match}</SoundProvider> : match);
  return session;
}

/** An engine that never loads, with its plays recorded. */
function quietEngine() {
  const engine = new AudioEngine(() => new Promise(() => {}));
  return { engine, playNow: vi.spyOn(engine, 'playNow') };
}

describe('MatchScreen (spec #2 §7.1, §7.2)', () => {
  it('shows the round, its countdown and my ROLL, and rolls', () => {
    const session = start();
    session.update(opening({}, { windowId: 1, endsAt: 12_000 }));
    expect(screen.getByText('ROUND').textContent).toBe('ROUND 1');
    expect(screen.getByRole('timer', { name: '12 seconds left' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ROLL' }));
    expect(session.send).toHaveBeenCalledWith({ type: 'roll' });
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('reports playback done for the window an update opens', () => {
    const session = start();
    session.update(opening());
    expect(session.playbackDone).toHaveBeenCalledWith(1);
  });

  it('opens the face-off for its players and sends the pick', () => {
    const session = start();
    const challenge: PublicChallenge = { id: 'c4', tile: 23, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null };
    session.update(opening({ phase: { kind: 'settle', challenges: [challenge] }, awaiting: { windowId: 4, window: 'challenge', players: ['p0', 'p1'], durationMs: 8_000 } }));
    fireEvent.click(screen.getByRole('button', { name: /Scissors/ }));
    expect(session.send).toHaveBeenCalledWith({ type: 'challengePick', challengeId: 'c4', choice: 'scissors' });
  });

  it('opens the card pick for the offer’s owner and sends rerolls and the pick', () => {
    const session = start();
    session.update(
      opening({
        phase: { kind: 'mysterySelect', picked: { p0: false } },
        myOffer: { player: 'p0', tile: 9, rarity: 'rare', cards: ['aegis', 'sprint', 'jackpot'], rerolled: [false, false, false], rerollsUsed: 0, seen: ['aegis', 'sprint', 'jackpot'], picked: null, autoPicked: false },
        awaiting: { windowId: 7, window: 'mystery', players: ['p0'], durationMs: 15_000 },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Jackpot' }));
    expect(session.send).toHaveBeenCalledWith({ type: 'reroll', slot: 2 });
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));
    expect(session.send).toHaveBeenCalledWith({ type: 'pickCard', slot: 1 });
  });

  const cardPickOpening = () =>
    opening({
      phase: { kind: 'mysterySelect', picked: { p0: false } },
      myOffer: { player: 'p0', tile: 9, rarity: 'rare', cards: ['aegis', 'sprint', 'jackpot'], rerolled: [false, false, false], rerollsUsed: 0, seen: ['aegis', 'sprint', 'jackpot'], picked: null, autoPicked: false },
      awaiting: { windowId: 7, window: 'mystery', players: ['p0'], durationMs: 30_000 },
    });

  it('closes the card pick the moment I pick, before the host answers (polish spec 4.3)', () => {
    const session = start();
    session.update(cardPickOpening());
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));
    expect(session.send).toHaveBeenCalledWith({ type: 'pickCard', slot: 1 });
    expect(screen.queryByRole('dialog', { name: 'Choose One' })).toBeNull();
  });

  it('keeps the card pick open after a reroll', () => {
    const session = start();
    session.update(cardPickOpening());
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Jackpot' }));
    expect(screen.getByRole('dialog', { name: 'Choose One' })).toBeTruthy();
  });

  it('brings the card pick back when the host rejects the pick', () => {
    const session = start();
    session.update(cardPickOpening());
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));
    session.reject('NOT_AWAITED');
    expect(screen.getByRole('dialog', { name: 'Choose One' })).toBeTruthy();
  });

  it("pops a one-line bubble beside each caster's row when the cards are revealed (polish spec 4.4)", () => {
    const session = start();
    session.update(opening());
    session.update({
      ...opening(),
      events: [{ type: 'CardSelected', player: 'p1', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: false, visibility: 'public' }],
    });
    expect(document.querySelector('.players .pbubble .pbubble-name')?.textContent).toBe('Shove');
    expect(document.querySelector('.tags .bubble')).toBeNull(); // not over the pieces any more
  });

  it('fans the cards out with a sound when my card pick opens, and bonks on a refused action (spec #3 §5)', () => {
    const { engine, playNow } = quietEngine();
    const session = start({ sound: engine });
    session.update(cardPickOpening());
    expect(playNow).toHaveBeenCalledWith('C1');
    session.reject('NOT_AWAITED');
    expect(playNow).toHaveBeenCalledWith('U4');
  });

  it('mutes and unmutes from the speaker button (spec #3 §4)', () => {
    const onToggleMute = vi.fn();
    start({ onToggleMute, muted: false });
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);
    cleanup();
    start({ onToggleMute, muted: true });
    expect(screen.getByRole('button', { name: 'Turn sound on' }).getAttribute('data-sound')).toBe('U3');
  });

  it("gives the match's buttons their own sounds (spec #3 §5)", () => {
    const session = start();
    session.update(opening({}, { windowId: 1, endsAt: 12_000 }));
    expect(screen.getByRole('button', { name: 'ROLL' }).getAttribute('data-sound')).toBe('none');
    session.update(cardPickOpening());
    expect(screen.getByRole('button', { name: /^Sprint/ }).getAttribute('data-sound')).toBe('C3');
    expect(screen.getByRole('button', { name: 'Reroll Jackpot' }).getAttribute('data-sound')).toBe('C2');
  });

  it('gives the face-off choices their lock-in sound (spec #3 §5)', () => {
    const session = start();
    const challenge: PublicChallenge = { id: 'c4', tile: 23, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null };
    session.update(opening({ phase: { kind: 'settle', challenges: [challenge] }, awaiting: { windowId: 4, window: 'challenge', players: ['p0', 'p1'], durationMs: 8_000 } }));
    expect(screen.getByRole('button', { name: /Scissors/ }).getAttribute('data-sound')).toBe('F2');
  });

  it('toasts a rejected action', () => {
    const session = start();
    session.update(opening());
    session.reject('STALE_INPUT');
    expect(screen.getByText('Too late, that window closed').getAttribute('role')).toBe('status');
  });

  it('watches another piece from the player column, and comes back to mine', () => {
    const session = start();
    session.update(opening());
    fireEvent.click(screen.getByRole('button', { name: /^Mochi,/ }));
    expect(screen.getByRole('img', { name: '3D board, auto, watching p1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to my piece' }));
    expect(screen.getByRole('img', { name: '3D board, auto, watching my piece' })).toBeTruthy();
  });

  it('leaves through the leave dialog, which can also be closed', () => {
    const onLeave = vi.fn();
    const session = start({ onLeave });
    session.update(opening());
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('dialog', { name: 'Leave match?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('reports a failed match', () => {
    const onFailed = vi.fn();
    const session = start({ onFailed });
    session.fail('board corrupted');
    expect(onFailed).toHaveBeenCalledWith('board corrupted');
  });

  it('hands the final rankings over once the victory and the ranks reveal have played (polish spec 4.5)', () => {
    const onFinished = vi.fn();
    const session = start({ onFinished });
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    const { view } = openingUpdate();
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.getByText('PIP WINS!')).toBeTruthy();
    expect(document.querySelectorAll('.rank-badge')).toHaveLength(0);
    act(() => vi.advanceTimersByTime(BEAT_MS.victory));
    expect([...document.querySelectorAll('.rank-badge')].map((b) => b.textContent)).toEqual(['2nd', '4th', '3rd']); // seat order: p0, p1, p3
    act(() => vi.advanceTimersByTime(3 * BEAT_MS.rankStep + BEAT_MS.rankHold - 1));
    expect(onFinished).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFinished).toHaveBeenCalledWith(rankings);
  });
});
