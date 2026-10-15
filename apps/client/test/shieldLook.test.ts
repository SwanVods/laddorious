import { describe, expect, it } from 'vitest';
import { shieldLook } from '../src/scene/motion';

describe('the shield bubble (2026-10-15)', () => {
  it('stays clearly visible while up, breathing gently', () => {
    const looks = [0, 500, 1000, 1500].map((t) => shieldLook(t, false, false));
    for (const l of looks) {
      expect(l.opacity).toBeGreaterThanOrEqual(0.3);
      expect(l.opacity).toBeLessThanOrEqual(0.4);
      expect(l.rim).toBeGreaterThan(0.6);
    }
    expect(new Set(looks.map((l) => l.scale.toFixed(3))).size).toBeGreaterThan(1);
  });

  it('flashes when it blocks', () => {
    const l = shieldLook(0, true, false);
    expect(l.opacity).toBeGreaterThan(0.6);
    expect(l.rim).toBe(1);
    expect(l.scale).toBeGreaterThan(1.05);
  });

  it('holds still with reduced motion', () => {
    expect(shieldLook(0, false, true)).toEqual(shieldLook(700, false, true));
  });
});
