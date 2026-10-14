import { describe, expect, it } from 'vitest';
import { NO_PAN, PanDrag, clampPan, dragPan, isTap, panAfterShot, panBox, panReach, unitsPerPixel } from '../src/scene/pan';

// Panning the zoomed-in overview (board theme spec B5, §5).

describe('the pan', () => {
  it("reaches nowhere at or above the lock zoom, and to the board's edges fully zoomed in", () => {
    expect(panReach(1, 0.95, 0.45)).toBe(0);
    expect(panReach(0.95, 0.95, 0.45)).toBe(0);
    expect(panReach(0.7, 0.95, 0.45)).toBeCloseTo(0.5);
    expect(panReach(0.45, 0.95, 0.45)).toBe(1);
    expect(panReach(0.3, 0.95, 0.45)).toBe(1);
  });

  it('keeps the look-at point over the board: further toward the far rows, as the overview aims toward the near ones', () => {
    expect(panBox(1, 13.5, 6.75)).toEqual({ minX: -13.5, maxX: 13.5, minZ: -20.25, maxZ: 6.75 });
    expect(panBox(0, 13.5, 6.75)).toEqual({ minX: -0, maxX: 0, minZ: -0, maxZ: 0 });
  });

  it('clamps an offset into the box, so zooming out pulls the camera home', () => {
    const box = panBox(0.5, 13.5, 6.75);
    expect(clampPan([20, -30], box)).toEqual([6.75, -10.125]);
    expect(clampPan([1, 1], box)).toEqual([1, 1]);
    expect(clampPan([5, -5], panBox(0, 13.5, 6.75)).map(Math.abs)).toEqual([0, 0]); // a point box: home (0 or -0)
  });

  it('moves the board with the finger: a drag right looks further left, a drag down looks further away', () => {
    const per = unitsPerPixel(20, 400);
    expect(per).toBeCloseTo(0.055);
    const [x, z] = dragPan(NO_PAN, 100, 100, per);
    expect(x).toBeCloseTo(-5.5);
    expect(z).toBeCloseTo(-7.15);
  });

  it('resets when the game takes the camera, and keeps it on the overview', () => {
    expect(panAfterShot([3, -4], 'overview')).toEqual([3, -4]);
    expect(panAfterShot([3, -4], 'follow')).toBe(NO_PAN);
    expect(panAfterShot([3, -4], 'swoop')).toBe(NO_PAN);
  });

  it('tells a tap from a drag by how far the press moved', () => {
    expect(isTap(0, 6)).toBe(true);
    expect(isTap(6, 6)).toBe(true);
    expect(isTap(7, 6)).toBe(false);
  });
});

describe('PanDrag', () => {
  it('moves nothing until the press passes the slop, then gives each step', () => {
    const drag = new PanDrag();
    drag.down(1, 100, 100);
    expect(drag.move(1, 103, 102, 6)).toBeNull();
    expect(drag.dragging).toBe(false);
    expect(drag.move(1, 110, 100, 6)).toEqual({ dx: 10, dy: 0 });
    expect(drag.dragging).toBe(true);
    expect(drag.move(1, 115, 90, 6)).toEqual({ dx: 5, dy: -10 });
    drag.up(1);
    expect(drag.dragging).toBe(false);
  });

  it('stops when a second finger lands (a pinch), and ignores the other finger', () => {
    const drag = new PanDrag();
    drag.down(1, 0, 0);
    expect(drag.move(1, 20, 0, 6)).toEqual({ dx: 20, dy: 0 });
    drag.down(2, 200, 0);
    expect(drag.move(1, 40, 0, 6)).toBeNull();
    expect(drag.move(2, 220, 0, 6)).toBeNull();
    drag.up(2);
    expect(drag.move(1, 60, 0, 6)).toBeNull(); // the pinch's first finger doesn't start panning again
    drag.up(1);
    drag.down(3, 0, 0);
    expect(drag.move(3, 10, 0, 6)).toEqual({ dx: 10, dy: 0 });
  });

  it('stops when the button was let go off the canvas (over the HUD), so the camera never pans unpressed', () => {
    const drag = new PanDrag();
    drag.down(1, 0, 0);
    expect(drag.move(1, 20, 0, 6)).toEqual({ dx: 20, dy: 0 });
    // The pointer comes back over the canvas with no button held: the drag is over.
    expect(drag.move(1, 60, 0, 6, false)).toBeNull();
    expect(drag.dragging).toBe(false);
    expect(drag.move(1, 90, 0, 6)).toBeNull();
    drag.down(2, 0, 0);
    expect(drag.move(2, 10, 0, 6)).toEqual({ dx: 10, dy: 0 });
  });
});
