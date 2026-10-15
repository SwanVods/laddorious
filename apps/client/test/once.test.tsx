// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDisposeOnUnmount, useOncePer } from '../src/app/once';

// React's StrictMode runs effects twice in dev builds (2026-10-15: the deferred dev-only doubles).

describe('useOncePer', () => {
  it('runs once for each new key, even when StrictMode runs the effect twice', () => {
    const run = vi.fn();
    const { rerender } = renderHook(({ key }) => useOncePer(key, run), { wrapper: StrictMode, initialProps: { key: 1 as number | null } });
    expect(run).toHaveBeenCalledTimes(1);
    rerender({ key: 1 });
    expect(run).toHaveBeenCalledTimes(1);
    rerender({ key: 2 });
    expect(run).toHaveBeenCalledTimes(2);
    rerender({ key: null });
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('useDisposeOnUnmount', () => {
  it("doesn't dispose on StrictMode's pretend unmount, only on the real one", async () => {
    const dispose = vi.fn();
    const { unmount } = renderHook(() => useDisposeOnUnmount(dispose), { wrapper: StrictMode });
    await Promise.resolve();
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
