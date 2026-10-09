// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndScreen } from '../src/app/EndScreen';
import { ErrorScreen } from '../src/app/ErrorScreen';
import { COUNT_MS, MatchmakingOverlay, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/MatchmakingOverlay';
import { createPrefsStore } from '../src/app/prefs';
import { SettingsDialog } from '../src/app/SettingsDialog';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider } from '../src/audio/SoundProvider';
import { SEATS } from './support/fixtures';
import { ScriptedMatchmaking, ScriptedSession } from './support/scripted';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const you = SEATS[0]!;

/** Renders inside a SoundProvider whose engine never loads; returns its recorded plays as "id" or "id:arg". */
function withSound(ui: ReactElement) {
  const engine = new AudioEngine(() => new Promise(() => {}));
  const playNow = vi.spyOn(engine, 'playNow');
  render(<SoundProvider engine={engine} prefs={createPrefsStore(null, { prefersReducedMotion: false })}>{ui}</SoundProvider>);
  return () => playNow.mock.calls.map(([id, arg]) => (arg === undefined ? id : `${id}:${arg}`));
}

describe('MatchmakingOverlay (spec #2 §7.1, C7)', () => {
  function open() {
    const matchmaking = new ScriptedMatchmaking();
    const onCancelled = vi.fn();
    const onReady = vi.fn();
    const onRetry = vi.fn();
    const onOffline = vi.fn();
    render(<MatchmakingOverlay matchmaking={matchmaking} onCancelled={onCancelled} onReady={onReady} onRetry={onRetry} onOffline={onOffline} />);
    return { matchmaking, onCancelled, onReady, onRetry, onOffline };
  }

  it("says when the server can't be reached, with Try again, Play offline with bots and Cancel (spec #4 §3.3)", () => {
    const { matchmaking, onRetry, onOffline } = open();
    matchmaking.emit({ kind: 'unreachable', message: "Can't reach the game server." });
    expect(screen.getByRole('dialog', { name: "CAN'T CONNECT" })).toBeTruthy();
    expect(screen.getByText("Can't reach the game server.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play offline with bots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(matchmaking.cancel).toHaveBeenCalledTimes(1);
  });

  it('tags bots BOT and real players nothing (spec #4 §4)', () => {
    const { matchmaking } = open();
    const bo = { ...SEATS[1]!, nickname: 'Bo', bot: false };
    matchmaking.emit({ kind: 'searching', elapsedMs: 1_000, seats: [you, bo, null, null] });
    expect(screen.queryByText('BOT')).toBeNull();
    matchmaking.emit({ kind: 'filling', seats: [you, bo, SEATS[2]!, null] });
    expect(screen.getAllByText('BOT')).toHaveLength(1);
  });

  it('searches with my seat and three open ones, offering bots only after 15 s', () => {
    const { matchmaking } = open();
    matchmaking.emit({ kind: 'searching', elapsedMs: 14_000, seats: [you, null, null, null] });
    const dialog = screen.getByRole('dialog', { name: 'FINDING PLAYERS' });
    expect(within(dialog).getByRole('timer').textContent).toBe('0:14');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['YouYOU', 'Searching', 'Searching', 'Searching']);
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [you, null, null, null] });
    expect(dialog.textContent).toContain('Taking a while? Start now and bots take the empty seats.');
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('cancels with the button or Esc, and goes back when the search is cancelled', () => {
    const { matchmaking, onCancelled } = open();
    matchmaking.emit({ kind: 'searching', elapsedMs: 1_000, seats: [you, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(matchmaking.cancel).toHaveBeenCalledTimes(2);
    matchmaking.emit({ kind: 'cancelled' });
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  it('shows the bots taking their seats, then MATCH FOUND and 3-2-1 before the match starts', () => {
    const { matchmaking, onReady } = open();
    matchmaking.emit({ kind: 'filling', seats: [you, SEATS[1]!, null, null] });
    expect(screen.getByRole('dialog', { name: 'ADDING BOTS' }).textContent).toContain('MochiBOT');
    const session = new ScriptedSession();
    matchmaking.emit({ kind: 'found', session });
    expect(screen.getByRole('dialog', { name: 'MATCH FOUND!' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('3');
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(screen.getByRole('timer').textContent).toBe('2');
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(screen.getByRole('timer').textContent).toBe('1');
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(onReady).toHaveBeenCalledWith(session);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('matchmaking sounds (spec #3 §5)', () => {
  it('pops as each bot takes a seat, then plays MATCH FOUND and the countdown', () => {
    const matchmaking = new ScriptedMatchmaking();
    const plays = withSound(<MatchmakingOverlay matchmaking={matchmaking} onCancelled={() => {}} onReady={() => {}} />);
    matchmaking.emit({ kind: 'searching', elapsedMs: 1_000, seats: [you, null, null, null] });
    matchmaking.emit({ kind: 'filling', seats: [you, SEATS[1]!, null, null] });
    matchmaking.emit({ kind: 'filling', seats: [you, SEATS[1]!, SEATS[2]!, null] });
    matchmaking.emit({ kind: 'filling', seats: [you, SEATS[1]!, SEATS[2]!, SEATS[3]!] });
    matchmaking.emit({ kind: 'found', session: new ScriptedSession() });
    expect(plays()).toEqual(['Q1:0', 'Q1:1', 'Q1:2', 'Q2', 'Q3']);
  });
});

describe('EndScreen (spec #2 §7.1)', () => {
  const rankings = [
    { player: 'p2', rank: 1, position: 100 },
    { player: 'p0', rank: 2, position: 87 },
    { player: 'p3', rank: 3, position: 60 },
    { player: 'p1', rank: 4, position: 41 },
  ];

  it('stands the final standings on a podium, 1st to 4th, and offers Play again and Main menu', () => {
    const onPlayAgain = vi.fn();
    const onMenu = vi.fn();
    render(<EndScreen rankings={rankings} seats={SEATS} me="p0" onPlayAgain={onPlayAgain} onMenu={onMenu} />);
    expect(screen.getByRole('heading').textContent).toBe('Pip wins!');
    const places = within(screen.getByRole('list', { name: 'Final standings' })).getAllByRole('listitem');
    expect(places.map((li) => li.getAttribute('aria-label'))).toEqual(['1st: Pip, tile 100', '2nd: You (you), tile 87', '3rd: Juno, tile 60', '4th: Mochi, tile 41']);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('settles with a podium chord, once (spec #3 §5)', () => {
    const plays = withSound(<EndScreen rankings={rankings} seats={SEATS} me="p0" onPlayAgain={() => {}} onMenu={() => {}} />);
    expect(plays()).toEqual(['W4']);
  });

  it('cheers when I win', () => {
    render(<EndScreen rankings={rankings.map((r) => ({ ...r, rank: r.player === 'p0' ? 1 : r.rank === 1 ? 2 : r.rank }))} seats={SEATS} me="p0" onPlayAgain={() => {}} onMenu={() => {}} />);
    expect(screen.getByRole('heading').textContent).toBe('You win!');
  });
});

describe('ErrorScreen (spec #2 §7.1, §8)', () => {
  it('says something went wrong and goes back to the menu', () => {
    const onMenu = vi.fn();
    render(<ErrorScreen message="InvariantError: bad destination 104" showDetails={false} onMenu={onMenu} />);
    expect(screen.getByRole('heading').textContent).toBe('Something went wrong in this match');
    expect(screen.queryByText(/InvariantError/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('shows the error text with a copy button in dev builds', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ErrorScreen message="InvariantError: bad destination 104" showDetails onMenu={() => {}} />);
    expect(screen.getByText('InvariantError: bad destination 104')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
    expect(writeText).toHaveBeenCalledWith('InvariantError: bad destination 104');
  });
});

describe('SettingsDialog (spec #2 §7.1, §9.2)', () => {
  it('saves the graphics quality and shows its description and the level in use', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: false, shortSide: 900 }} onClose={() => {}} />);
    const quality = screen.getByRole('group', { name: 'Graphics quality' });
    expect(within(quality).getByRole('button', { name: 'Auto' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: High (Auto on this device)');
    fireEvent.click(within(quality).getByRole('button', { name: 'Low' }));
    expect(prefs.getState().settings.quality).toBe('low');
    expect(screen.getByRole('dialog').textContent).toContain('No live shadows and lower resolution. Best for older phones.');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: Low');
  });

  it('mutes sound and sets the effects and music volumes (spec #3 §4)', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: false, shortSide: 900 }} onClose={() => {}} />);
    const mute = screen.getByRole('switch', { name: 'Mute sound' });
    expect(mute.getAttribute('data-sound')).toBe('U3');
    fireEvent.click(mute);
    expect(prefs.getState().settings.sound.muted).toBe(true);
    fireEvent.change(screen.getByRole('slider', { name: 'Effects volume' }), { target: { value: '40' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), { target: { value: '25' } });
    expect(prefs.getState().settings.sound).toEqual({ muted: true, effects: 0.4, music: 0.25 });
  });

  it('saves Reduced motion, and closes', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    const onClose = vi.fn();
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: true, shortSide: 390 }} onClose={onClose} />);
    const toggle = screen.getByRole('switch', { name: 'Reduced motion' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(prefs.getState().settings.reducedMotion).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: Low (Auto on this device)');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
