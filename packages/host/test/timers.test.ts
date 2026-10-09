import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PausableTimers } from '../src/timers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PausableTimers', () => {
  it('fires once after its delay, then forgets the key', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(timers.has('a')).toBe(false);
  });

  it('replaces a timer set again under the same key', () => {
    const timers = new PausableTimers();
    const first = vi.fn();
    const second = vi.fn();
    timers.set('a', 1000, first);
    timers.set('a', 500, second);
    vi.advanceTimersByTime(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports when a timer is due, and clear and clearAll cancel', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    timers.set('b', 2000, fn);
    timers.set('c', 3000, fn);
    expect(timers.dueAt('b')).toBe(2000);
    expect(timers.dueAt('missing')).toBeUndefined();
    timers.clear('a');
    expect(timers.has('a')).toBe(false);
    timers.clearAll();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    expect(timers.has('b') || timers.has('c')).toBe(false);
  });

  it('freezes every timer while paused and resumes it with the time that was left', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(400);
    timers.pause();
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    expect(timers.dueAt('a')).toBe(10_400 + 600);
    timers.resume();
    expect(timers.dueAt('a')).toBe(11_000);
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('starts a timer set while paused frozen, with its full delay', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.pause();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    timers.resume();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
