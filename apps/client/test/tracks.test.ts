import { describe, expect, it } from 'vitest';
import { TILE_SIZE, slideCurve, tileToWorld } from '../src/scene/layout';
import { DASH_GAP, dashPoints, ladderCurve, type Dash } from '../src/scene/tracks';

const ladder = { id: 'l1', from: 22, to: 52 };
const slide = { id: 's1', from: 79, to: 41 };

/** The way a dash's tip points: +Z turned by its pitch, then its heading. */
const ahead = (d: Dash) => [Math.sin(d.heading) * Math.cos(d.pitch), Math.sin(d.pitch), Math.cos(d.heading) * Math.cos(d.pitch)];
const toward = (d: Dash, next: Dash) => {
  const dir = ahead(d);
  return dir.reduce((sum, v, i) => sum + v * (next.position[i]! - d.position[i]!), 0);
};

describe('the jump trails: arrowheads (2026-10-14)', () => {
  it("spaces the arrowheads by the board's step, so each tile carries as many as on the 2.0 board (board theme spec B3)", () => {
    expect(DASH_GAP / TILE_SIZE).toBeCloseTo(0.3);
  });

  it("lays a slide's arrowheads along its lane, one every DASH_GAP, each pointing on toward the splat", () => {
    const curve = slideCurve(slide.from, slide.to);
    const dashes = dashPoints(slide);
    expect(dashes.length).toBe(Math.max(2, Math.floor(curve.getLength() / DASH_GAP)));
    for (let i = 0; i + 1 < dashes.length; i++) {
      expect(toward(dashes[i]!, dashes[i + 1]!)).toBeGreaterThan(0);
      expect(dashes[i]!.pitch).toBe(0); // flat on the board
    }
    const [hx, , hz] = tileToWorld(slide.from);
    const [ex, , ez] = tileToWorld(slide.to);
    expect(Math.hypot(dashes[0]!.position[0]! - hx, dashes[0]!.position[2]! - hz)).toBeLessThan(DASH_GAP);
    expect(Math.hypot(dashes.at(-1)!.position[0]! - ex, dashes.at(-1)!.position[2]! - ez)).toBeLessThan(DASH_GAP);
  });

  it("strings a rocket's arrowheads along its arc to the flag, each tilted to point along it", () => {
    const curve = ladderCurve(ladder.from, ladder.to);
    const dashes = dashPoints(ladder);
    expect(dashes.length).toBe(Math.max(2, Math.floor(curve.getLength() / DASH_GAP)));
    for (let i = 0; i + 1 < dashes.length; i++) expect(toward(dashes[i]!, dashes[i + 1]!)).toBeGreaterThan(0);
    // They climb, then dive: the first points up, the last down, and the middle flies well above the board.
    expect(dashes[0]!.pitch).toBeGreaterThan(0.2);
    expect(dashes.at(-1)!.pitch).toBeLessThan(-0.2);
    expect(dashes[Math.floor(dashes.length / 2)]!.position[1]).toBeGreaterThan(1);
    const [fx, , fz] = tileToWorld(ladder.from);
    expect(Math.hypot(dashes[0]!.position[0]! - fx, dashes[0]!.position[2]! - fz)).toBeLessThan(DASH_GAP);
  });

  it('lets the arrowheads drift along the way: a phase moves each a little further on', () => {
    for (const jump of [slide, ladder]) {
      const still = dashPoints(jump, 0);
      const moved = dashPoints(jump, 0.5);
      expect(toward(still[3]!, moved[3]!)).toBeGreaterThan(0);
    }
  });
});
