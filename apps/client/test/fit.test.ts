import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { overviewAt } from '../src/scene/camera';
import { FIT_MARGIN, fitOverview, type OverviewView } from '../src/scene/fit';
import { tileToWorld, type Vec3 } from '../src/scene/layout';

// The overview keeps every piece in frame when the camera comes back to it (2026-10-17): zoomed in and
// panned away, it pans and, if it must, zooms out; it never zooms in on its own.

const LENS = { fov: 42, aspect: 844 / 390 };

function inFrame(view: OverviewView, points: Vec3[]): boolean {
  const { position, target } = overviewAt(view.zoom, view.pan);
  const camera = new PerspectiveCamera(LENS.fov, LENS.aspect, 0.5, 200);
  camera.position.set(...position);
  camera.lookAt(new Vector3(...target));
  camera.updateMatrixWorld();
  return points.every((p) => {
    const v = new Vector3(...p).project(camera);
    return Math.abs(v.x) <= FIT_MARGIN && Math.abs(v.y) <= FIT_MARGIN;
  });
}

describe('the overview fit (2026-10-17)', () => {
  it('leaves a view alone that already shows every piece', () => {
    const view: OverviewView = { zoom: 0.6, pan: [0, 0] };
    const near = [tileToWorld(45), tileToWorld(55)];
    expect(inFrame(view, near)).toBe(true);
    expect(fitOverview(view, near, LENS)).toEqual(view);
  });

  it('brings every piece on tiles 81–100 back into frame after I zoomed in near the start', () => {
    const view: OverviewView = { zoom: 0.45, pan: [-8, 6] };
    const top = [tileToWorld(81), tileToWorld(90), tileToWorld(91), tileToWorld(100)];
    expect(inFrame(view, top)).toBe(false);
    const fitted = fitOverview(view, top, LENS);
    expect(inFrame(fitted, top)).toBe(true);
    // It only zooms out as far as it must.
    expect(fitted.zoom).toBeLessThan(1);
  });

  it('keeps pieces on the start spots in frame with the far row', () => {
    const spread = [tileToWorld(0, 0), tileToWorld(0, 3), tileToWorld(95)];
    const fitted = fitOverview({ zoom: 0.5, pan: [0, -10] }, spread, LENS);
    expect(inFrame(fitted, spread)).toBe(true);
  });

  it('needs no change at the overview as set, wherever the pieces stand', () => {
    const anywhere = [tileToWorld(1), tileToWorld(10), tileToWorld(91), tileToWorld(100), tileToWorld(0, 0), tileToWorld(0, 3)];
    expect(fitOverview({ zoom: 1, pan: [0, 0] }, anywhere, LENS)).toEqual({ zoom: 1, pan: [0, 0] });
  });

  it('never zooms in on its own', () => {
    const view: OverviewView = { zoom: 1.3, pan: [0, 0] };
    expect(fitOverview(view, [tileToWorld(1), tileToWorld(100)], LENS).zoom).toBeGreaterThanOrEqual(1.3);
  });
});
