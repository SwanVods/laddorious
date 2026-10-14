import { describe, expect, it } from 'vitest';
import { slideCurve, tileToWorld } from '../src/scene/layout';
import { DASH_GAP, PUFFS, dashPoints, puffPoints } from '../src/scene/tracks';

const ladder = { id: 'l1', from: 22, to: 52 };
const slide = { id: 's1', from: 79, to: 41 };

describe('the jump trails, low-poly and simple (spec #5, Step 2 round 5)', () => {
  it("strings a rocket's smoke puffs along its arc, from the rocket to the flag, growing as they go", () => {
    const puffs = puffPoints(ladder);
    expect(puffs).toHaveLength(PUFFS);
    const [fx, , fz] = tileToWorld(ladder.from);
    const [tx, , tz] = tileToWorld(ladder.to);
    const along = (p: { position: readonly number[] }) => ((p.position[0]! - fx) * (tx - fx) + (p.position[2]! - fz) * (tz - fz)) / ((tx - fx) ** 2 + (tz - fz) ** 2);
    for (let i = 1; i < puffs.length; i++) {
      expect(along(puffs[i]!)).toBeGreaterThan(along(puffs[i - 1]!));
      expect(puffs[i]!.size).toBeGreaterThan(puffs[i - 1]!.size);
    }
    expect(along(puffs[0]!)).toBeLessThan(0.1);
    expect(along(puffs.at(-1)!)).toBeGreaterThan(0.9);
    // They arc: the middle puff flies well above the ends.
    expect(puffs[PUFFS / 2]!.position[1]).toBeGreaterThan(puffs[0]!.position[1]! + 1);
  });

  it("lays a slide's arrowheads along its lane, one every DASH_GAP, each pointing on toward the splat", () => {
    const curve = slideCurve(slide.from, slide.to);
    const dashes = dashPoints(slide);
    expect(dashes.length).toBe(Math.max(2, Math.floor(curve.getLength() / DASH_GAP)));
    for (let i = 0; i + 1 < dashes.length; i++) {
      const [x, , z] = dashes[i]!.position;
      const [nx, , nz] = dashes[i + 1]!.position;
      const ahead = [Math.sin(dashes[i]!.heading), Math.cos(dashes[i]!.heading)];
      expect(ahead[0]! * (nx! - x!) + ahead[1]! * (nz! - z!)).toBeGreaterThan(0); // +Z turned by heading points to the next one
    }
    const [hx, , hz] = tileToWorld(slide.from);
    const [ex, , ez] = tileToWorld(slide.to);
    expect(Math.hypot(dashes[0]!.position[0]! - hx, dashes[0]!.position[2]! - hz)).toBeLessThan(DASH_GAP);
    expect(Math.hypot(dashes.at(-1)!.position[0]! - ex, dashes.at(-1)!.position[2]! - ez)).toBeLessThan(DASH_GAP);
  });

  it('lets the arrowheads drift along the lane: a phase moves each a little further on', () => {
    const still = dashPoints(slide, 0);
    const moved = dashPoints(slide, 0.5);
    const [x, , z] = still[3]!.position;
    const [mx, , mz] = moved[3]!.position;
    const ahead = [Math.sin(still[3]!.heading), Math.cos(still[3]!.heading)];
    expect(ahead[0]! * (mx! - x!) + ahead[1]! * (mz! - z!)).toBeGreaterThan(0);
  });
});
