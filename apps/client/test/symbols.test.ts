import { Color, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { WORLD_COLORS } from '../src/app/theme';
import { capGeometry, symbolGeometry } from '../src/assets/symbols';
import { SYMBOLS } from '../src/scene/pairs';

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('the pair symbols (spec #5 A13)', () => {
  it.each(SYMBOLS)('draws the %s flat on its base, a unit across, a white face with a grey rim', (name) => {
    const g = symbolGeometry(name);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeLessThan(0.01);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeCloseTo(1, 1);
    expect(Math.abs((box.min.x + box.max.x) / 2)).toBeLessThan(0.1);
    // Vertex colours: the face white and the rim a grey, so the instance colour paints the face and a deeper
    // shade of itself round it: no black (the user, Step 2 review 4).
    const colour = g.getAttribute('color');
    const shades = new Set<string>();
    for (let i = 0; i < colour.count; i++) {
      const [r, gr, b] = [colour.getX(i), colour.getY(i), colour.getZ(i)];
      shades.add(r === 1 && gr === 1 && b === 1 ? 'white' : r === gr && gr === b && r > 0.3 && r < 0.7 ? 'shade' : 'other');
    }
    expect([...shades].sort()).toEqual(['shade', 'white']);
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
    // Cream on top and a warm peach round its side: no ink.
    const colour = g.getAttribute('color');
    const ink = new Color(WORLD_COLORS.ink);
    for (let i = 0; i < colour.count; i++) expect(Math.abs(colour.getX(i) - ink.r) > 1e-3 || Math.abs(colour.getY(i) - ink.g) > 1e-3).toBe(true);
  });
});
