import { describe, expect, it } from 'vitest';
import { pinchZoom, rememberZoom, savedZoom, wheelZoom } from '../src/scene/zoom';

// Zooming the overview (the user, 2026-10-15): a mouse wheel or a two-finger pinch, within limits.
const LIMITS = { min: 0.6, max: 1.4 };

describe('zooming the overview', () => {
  it('zooms in as the wheel rolls up and out as it rolls down, smoothly', () => {
    expect(wheelZoom(1, -100, LIMITS)).toBeLessThan(1);
    expect(wheelZoom(1, 100, LIMITS)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100, LIMITS)).toBeLessThan(1.2);
  });

  it('zooms in as fingers spread and out as they pinch together', () => {
    expect(pinchZoom(1, 100, 200, LIMITS)).toBeCloseTo(0.6, 5); // twice as far apart: half the distance, held at the limit
    expect(pinchZoom(1, 200, 160, LIMITS)).toBeCloseTo(1.25, 5);
  });

  it('stays within the limits', () => {
    expect(wheelZoom(0.6, -1000, LIMITS)).toBe(0.6);
    expect(wheelZoom(1.4, 1000, LIMITS)).toBe(1.4);
    expect(pinchZoom(1, 10, 1000, LIMITS)).toBe(0.6);
    expect(pinchZoom(1, 1000, 10, LIMITS)).toBe(1.4);
  });
});

describe('the overview zoom, remembered between matches (2026-10-15)', () => {
  const memory = () => {
    const kept = new Map<string, string>();
    return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
  };
  const limits = { min: 0.45, max: 1.4 };

  it('keeps the last zoom and starts the next match there', () => {
    const storage = memory();
    rememberZoom(0.7, storage);
    expect(savedZoom(limits, storage)).toBe(0.7);
  });

  it('starts at 1 with nothing kept, something unreadable, or no storage at all', () => {
    expect(savedZoom(limits, memory())).toBe(1);
    const odd = memory();
    odd.setItem('laddorious.zoom', 'far');
    expect(savedZoom(limits, odd)).toBe(1);
    expect(savedZoom(limits, null)).toBe(1);
  });

  it('keeps a kept zoom within the limits in use', () => {
    const storage = memory();
    rememberZoom(0.2, storage);
    expect(savedZoom(limits, storage)).toBe(0.45);
  });
});

