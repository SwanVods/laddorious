import { describe, expect, it } from 'vitest';
import { pinchZoom, wheelZoom } from '../src/scene/zoom';

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
