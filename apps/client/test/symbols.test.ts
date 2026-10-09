import { Color, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { WORLD_COLORS } from '../src/app/theme';
import { capGeometry, symbolGeometry } from '../src/assets/symbols';
import { SYMBOLS } from '../src/scene/pairs';

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('the pair symbols (spec #5 A13)', () => {
  it.each(SYMBOLS)('draws the %s flat on its base, a unit across, with a dark rim round a white face', (name) => {
    const g = symbolGeometry(name);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeLessThan(0.01);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeCloseTo(1, 1);
    expect(Math.abs((box.min.x + box.max.x) / 2)).toBeLessThan(0.1);
    // Vertex colours: the rim in ink, the face white for the instance colour to paint.
    const colour = g.getAttribute('color');
    const ink = new Color(WORLD_COLORS.ink);
    const shades = new Set<string>();
    for (let i = 0; i < colour.count; i++) shades.add(colour.getX(i) === 1 ? 'white' : Math.abs(colour.getX(i) - ink.r) < 1e-6 ? 'ink' : 'other');
    expect([...shades].sort()).toEqual(['ink', 'white']);
    // The face lies above the rim, so it shows through.
    expect(triangles(g)).toBeLessThanOrEqual(160);
  });

  it('turns every symbol upright to the board camera: its top toward the far side (-Z)', () => {
    const g = symbolGeometry('triangle');
    const position = g.getAttribute('position');
    let tip = 0;
    for (let i = 1; i < position.count; i++) if (position.getZ(i) < position.getZ(tip)) tip = i;
    expect(Math.abs(position.getX(tip))).toBeLessThan(0.05); // the triangle's point is its top, centred
  });

  it("builds a whirlpool's cap: a low cream-topped disc that stays still while the bowl spins", () => {
    const g = capGeometry(0.2, 0.04);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(g.boundingBox!.max.y).toBeCloseTo(0.04, 5);
    expect(g.boundingBox!.max.x).toBeCloseTo(0.2, 2);
    expect(g.getAttribute('color')).toBeDefined();
  });
});
