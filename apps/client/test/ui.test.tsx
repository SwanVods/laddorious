// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../src/ui/Dialog';
import { DieFace } from '../src/ui/DieFace';
import { PieceIcon, Portrait } from '../src/ui/PieceIcon';
import { RotateScreen } from '../src/ui/RotateScreen';
import { TOAST_MS, ToastHost, showToast } from '../src/ui/toasts';
import { PIECES } from '../src/service/matchService';

/** jsdom has no matchMedia: answer every query with `matches`. */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Dialog', () => {
  it('has a titled, modal panel that closes on its button, the backdrop and Esc (spec #2 §7.3)', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Settings" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('.backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('toasts (spec #2 §8)', () => {
  it('shows a message, then hides it after a few seconds', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => showToast('Too late, that window closed'));
    expect(screen.getByRole('status').textContent).toBe('Too late, that window closed');
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('RotateScreen (spec #2 §7.1)', () => {
  it('asks to turn the phone sideways only in portrait', () => {
    mockMatchMedia(true);
    const { unmount } = render(<RotateScreen />);
    expect(screen.getByRole('alert').textContent).toContain('Turn your phone sideways');
    unmount();
    mockMatchMedia(false);
    render(<RotateScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('piece portraits and dice', () => {
  it('draws each piece, and the pawn with a round head', () => {
    for (const piece of PIECES) {
      const { container, unmount } = render(<PieceIcon piece={piece} />);
      expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M[\d.,QLZ -]+Z$/);
      expect(container.querySelector('circle:not(.piece-eye)') !== null).toBe(piece === 'pawn');
      unmount();
    }
  });

  it('sets the seat colour and the rank badge on a portrait', () => {
    const { container } = render(<Portrait piece="dragon" color="var(--accent)" badge={2} />);
    const portrait = container.querySelector<HTMLElement>('.portrait')!;
    expect(portrait.style.getPropertyValue('--seat')).toBe('var(--accent)');
    expect(portrait.textContent).toBe('2');
  });

  it('draws the pips of a face', () => {
    const { container } = render(<DieFace face={6} forced />);
    expect(container.querySelectorAll('circle')).toHaveLength(6);
    expect(screen.getByRole('img', { name: '6' }).getAttribute('class')).toContain('forced');
  });
});
