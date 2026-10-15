import { DoubleSide } from 'three';
import { describe, expect, it } from 'vitest';
import { createShieldMaterial, setShieldLook } from '../src/scene/shieldMaterial';

// The shield bubble glows along its outline and is nearly clear face-on (2026-10-15: the user's pick after
// the first bubble, with a band round its middle, looked like a hamster ball).
describe('the shield bubble material', () => {
  it('is see-through, drawn from both sides, and never hides what is behind it', () => {
    const m = createShieldMaterial('#5ff0c5');
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.side).toBe(DoubleSide);
    expect(m.fragmentShader).toContain('pow(');
  });

  it('keeps the face nearly clear and the outline bright, brighter still when it blocks', () => {
    const m = createShieldMaterial('#5ff0c5');
    setShieldLook(m, { opacity: 0.35, rim: 0.8 });
    const resting = { fill: m.uniforms.uFill!.value as number, rim: m.uniforms.uRim!.value as number };
    expect(resting.fill).toBeLessThan(0.08);
    expect(resting.rim).toBeGreaterThan(0.7);
    setShieldLook(m, { opacity: 0.7, rim: 1 });
    expect(m.uniforms.uFill!.value).toBeGreaterThan(resting.fill);
    expect(m.uniforms.uRim!.value).toBeGreaterThan(resting.rim);
  });
});
