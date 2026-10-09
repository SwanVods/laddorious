// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuScreen, TIPS, TIP_MS } from '../src/app/MenuScreen';
import { createPrefsStore } from '../src/app/prefs';

// jsdom has no WebGL: stand the podium scene in with a labelled box.
vi.mock('../src/scene/MenuScene', async () => {
  const { createElement } = await import('react');
  return {
    MenuScene: ({ piece, setting }: { piece: string; setting: string }) => createElement('div', { role: 'img', 'aria-label': `Podium with the ${piece}, ${setting}` }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function open(showSeed = false) {
  const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
  const onPlay = vi.fn();
  const onSettings = vi.fn();
  render(<MenuScreen prefs={prefs} onPlay={onPlay} onSettings={onSettings} showSeed={showSeed} />);
  return { prefs, onPlay, onSettings };
}

const rename = (to: string, key = 'Enter') => {
  fireEvent.click(screen.getByRole('button', { name: /Tap to rename/ }));
  const input = screen.getByRole('textbox', { name: 'Nickname' });
  fireEvent.change(input, { target: { value: to } });
  fireEvent.keyDown(input, { key });
};

describe('MenuScreen (spec #2 §7.1)', () => {
  it('shows my guest profile, the logo, and PLAY for a 4-player match', () => {
    const { onPlay } = open();
    expect(screen.getByRole('button', { name: /Tap to rename/ }).textContent).toContain('Guest5500');
    expect(screen.getByRole('heading').textContent).toBe('LADDORIOUSRACE TO 100');
    expect(screen.getByText('4-player match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalledWith({});
  });

  it('renames me from the profile chip, and keeps my name for an empty one or Esc', () => {
    const { prefs } = open();
    rename('  Ari  ');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    expect(screen.getByRole('button', { name: /Tap to rename/ }).textContent).toContain('Ari');
    rename('   ');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    rename('Bob', 'Escape');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    expect(screen.queryByRole('textbox', { name: 'Nickname' })).toBeNull();
  });

  it('saves the new name when I tap away', () => {
    const { prefs } = open();
    fireEvent.click(screen.getByRole('button', { name: /Tap to rename/ }));
    const input = screen.getByRole('textbox', { name: 'Nickname' });
    expect(input.getAttribute('maxlength')).toBe('16');
    fireEvent.change(input, { target: { value: 'Mika' } });
    fireEvent.blur(input);
    expect(prefs.getState().profile.nickname).toBe('Mika');
  });

  it('picks my piece from the picker or the arrows beside the podium', () => {
    const { prefs } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Dragon head' }));
    expect(prefs.getState().profile.piece).toBe('dragon');
    expect(screen.getByRole('button', { name: 'Dragon head' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('img', { name: 'Podium with the dragon, auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next piece' }));
    expect(prefs.getState().profile.piece).toBe('knight');
    fireEvent.click(screen.getByRole('button', { name: 'Previous piece' }));
    expect(prefs.getState().profile.piece).toBe('dragon');
  });

  it("gives each piece its own pick sound, on the picker and the arrows (spec #3 §5)", () => {
    open();
    const dragon = screen.getByRole('button', { name: 'Dragon head' });
    expect([dragon.getAttribute('data-sound'), dragon.getAttribute('data-sound-arg')]).toEqual(['U2', '3']);
    expect(screen.getByRole('button', { name: 'Next piece' }).getAttribute('data-sound-arg')).toBe('1');
    expect(screen.getByRole('button', { name: 'Previous piece' }).getAttribute('data-sound-arg')).toBe('3');
  });

  it('turns over the rule tips every few seconds', () => {
    vi.useFakeTimers();
    open();
    expect(screen.getByRole('note').textContent).toContain(TIPS[0]);
    act(() => vi.advanceTimersByTime(TIP_MS));
    expect(screen.getByRole('note').textContent).toContain(TIPS[1]);
  });

  it('opens the settings from the gear', () => {
    const { onSettings } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('plays a typed board seed in dev builds only', () => {
    open();
    expect(screen.queryByRole('textbox', { name: 'Board seed (dev)' })).toBeNull();
    cleanup();
    const { onPlay } = open(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Board seed (dev)' }), { target: { value: ' daily-2026-10-08 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalledWith({ seed: 'daily-2026-10-08' });
  });
});
