// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullscreenButton } from '../src/ui/FullscreenButton';

// Full-screen mode (the user, 2026-10-15): a round button in the menu and in matches.

let fullscreenElement: Element | null = null;

function stubFullscreen(enabled: boolean) {
  fullscreenElement = null;
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => enabled });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  const enter = vi.fn(async () => {
    fullscreenElement = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  const exit = vi.fn(async () => {
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: enter });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  return { enter, exit };
}

afterEach(cleanup);

describe('FullscreenButton', () => {
  it('enters full screen, then exits it, its label following', async () => {
    const { enter, exit } = stubFullscreen(true);
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Full screen' })));
    expect(enter).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' })));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy();
  });

  it('follows full screen left another way (the Esc key)', async () => {
    stubFullscreen(true);
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Full screen' })));
    await act(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.getByRole('button', { name: 'Full screen' })).toBeTruthy();
  });

  it('does not show where full screen is not available (an iPhone)', () => {
    stubFullscreen(false);
    const { container } = render(<FullscreenButton />);
    expect(container.innerHTML).toBe('');
  });
});
