// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOADING_SKIP_MS, LoadingScreen } from '../src/app/LoadingScreen';
import { modelLoading, resetModelCache } from '../src/assets/modelCache';

// The loading screen on first start (the user, 2026-10-16): a phone on slow mobile data showed stand-ins.

const set = (requested: number, done: number, failed = 0) =>
  act(() =>
    modelLoading.setState({
      requested: Array.from({ length: requested }, (_, i) => `/models/m${i}.glb`),
      done,
      failed: Array.from({ length: failed }, (_, i) => `/models/m${i}.glb`),
      over: false,
    }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  resetModelCache();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LoadingScreen (2026-10-16)', () => {
  it('shows nothing before any model is asked for', () => {
    const { container } = render(<LoadingScreen onRetry={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('counts the models in, and goes once they are all there', () => {
    render(<LoadingScreen onRetry={() => {}} />);
    set(27, 18);
    expect(screen.getByRole('progressbar', { name: 'Loading 3D models' }).getAttribute('aria-valuenow')).toBe('18');
    expect(screen.getByText('18 of 27')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play anyway' })).toBeNull();
    act(() => modelLoading.setState({ done: 27, over: true }));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('offers to play anyway after a while', () => {
    render(<LoadingScreen onRetry={() => {}} />);
    set(27, 3);
    act(() => vi.advanceTimersByTime(LOADING_SKIP_MS + 500));
    fireEvent.click(screen.getByRole('button', { name: 'Play anyway' }));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(modelLoading.getState().over).toBe(true);
  });

  it('says when some models could not load, and can try again', () => {
    const onRetry = vi.fn();
    render(<LoadingScreen onRetry={onRetry} />);
    set(27, 27, 2);
    expect(screen.getByRole('heading').textContent).toBe("Some models didn't load");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('stays away once the first load is over (a quality change loads quietly)', () => {
    render(<LoadingScreen onRetry={() => {}} />);
    act(() => modelLoading.setState({ requested: ['/models/a.glb'], done: 1, failed: [], over: true }));
    act(() => modelLoading.setState({ requested: ['/models/a.glb', '/models/b.glb'] }));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
