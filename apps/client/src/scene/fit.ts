import { PerspectiveCamera, Vector3 } from 'three';
import { tuning } from '../app/tuning';
import { OVERVIEW_TARGET_Z, overviewAt } from './camera';
import { BOARD_HALF, type Vec3 } from './layout';
import { clampPan, panBox, panReach, type Pan } from './pan';

/** The overview's zoom and pan, as the wheel, a pinch or a drag left them. */
export interface OverviewView {
  zoom: number;
  pan: Pan;
}

/** How far from the middle a piece may stand, in screen units (1 is the edge), and still count as in frame. */
export const FIT_MARGIN = 0.9;
const ZOOM_STEP = 0.05;

/**
 * The overview that shows every piece (2026-10-17), for when the camera comes back to it: the view as it
 * is if they're all in frame; else panned to their middle, zooming out step by step until they fit. It never
 * zooms in on its own.
 */
export function fitOverview(view: OverviewView, points: readonly Vec3[], lens: { fov: number; aspect: number }): OverviewView {
  const camera = new PerspectiveCamera(lens.fov, lens.aspect, 0.5, 200);
  const at = new Vector3();
  const fits = ({ zoom, pan }: OverviewView) => {
    const { position, target } = overviewAt(zoom, pan);
    camera.position.set(...position);
    camera.lookAt(at.set(...target));
    camera.updateMatrixWorld();
    return points.every((p) => {
      const v = at.set(...p).project(camera);
      return Math.abs(v.x) <= FIT_MARGIN && Math.abs(v.y) <= FIT_MARGIN;
    });
  };
  if (points.length === 0 || fits(view)) return view;
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  const middle: Pan = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2 - OVERVIEW_TARGET_Z];
  const { overview, pan } = tuning().camera;
  for (let zoom = view.zoom; ; zoom = Math.min(overview.zoomMax, zoom + ZOOM_STEP)) {
    const next = { zoom, pan: clampPan(middle, panBox(panReach(zoom, pan.lockAbove, overview.zoomMin), BOARD_HALF, OVERVIEW_TARGET_Z)) };
    if (fits(next) || zoom >= overview.zoomMax) return next;
  }
}
