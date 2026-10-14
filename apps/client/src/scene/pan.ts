import type { ShotMode } from './camera';

// Panning the zoomed-in overview (board theme spec B5, §5): the camera never turns. Closer than the
// overview, a drag moves the point it looks at, and the camera with it, inside a box over the board that
// grows as the zoom closes in. At the overview's own zoom the box is a point, so the camera stays put.

/** The look-at point's offset from the overview's own, on the ground: x across, z toward the camera. */
export type Pan = readonly [x: number, z: number];
export const NO_PAN: Pan = [0, 0];

export interface PanBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** How far the pan may reach at a zoom: 0 at or above `lockAbove`, 1 fully zoomed in. */
export function panReach(zoom: number, lockAbove: number, zoomMin: number): number {
  if (lockAbove <= zoomMin) return 0;
  return Math.min(1, Math.max(0, (lockAbove - zoom) / (lockAbove - zoomMin)));
}

/**
 * The box the offset stays in: up to half the board's width each way across; toward the far row as far as
 * the far edge, and toward the near row as far as the near edge, measured from the overview's aim, which
 * sits `aimZ` toward the near row.
 */
export function panBox(reach: number, half: number, aimZ: number): PanBox {
  return { minX: -half * reach, maxX: half * reach, minZ: -(half + aimZ) * reach, maxZ: (half - aimZ) * reach };
}

export function clampPan([x, z]: Pan, box: PanBox): Pan {
  return [Math.min(box.maxX, Math.max(box.minX, x)), Math.min(box.maxZ, Math.max(box.minZ, z))];
}

/** World units a pixel of drag moves, for a camera this high: about the visible depth per screen height. */
export function unitsPerPixel(height: number, viewHeightPx: number): number {
  return (height * 1.1) / Math.max(1, viewHeightPx);
}

/**
 * The offset after a drag of (dx, dy) pixels: the board follows the finger. Up and down the screen moves a
 * little further, as the camera sees the ground at a slant.
 */
export function dragPan([x, z]: Pan, dx: number, dy: number, perPixel: number): Pan {
  return [x - dx * perPixel, z - dy * perPixel * 1.3];
}

/** When the game takes the camera (a follow, a swoop, a card shot), the pan goes back to the middle. */
export function panAfterShot(pan: Pan, mode: ShotMode): Pan {
  return mode === 'overview' ? pan : NO_PAN;
}

/** A press that moved no further than the slop is a tap: it peeks a tile or shows a name. Further, it was a drag. */
export function isTap(movedPx: number, slopPx: number): boolean {
  return movedPx <= slopPx;
}

/**
 * One finger or the mouse dragging the view. A press moves nothing until it passes the slop, so a tap stays
 * a tap; a second finger (a pinch) ends the drag until every finger has lifted.
 */
export class PanDrag {
  private id: number | null = null;
  private start = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private moving = false;
  private fingers = 0;

  down(id: number, x: number, y: number): void {
    this.fingers += 1;
    if (this.fingers > 1) {
      this.id = null;
      this.moving = false;
      return;
    }
    this.id = id;
    this.start = { x, y };
    this.last = { x, y };
  }

  /** The movement since the last step once the press is past the slop; null before that, or for another finger. */
  move(id: number, x: number, y: number, slopPx: number): { dx: number; dy: number } | null {
    if (id !== this.id) return null;
    if (!this.moving) {
      if (Math.hypot(x - this.start.x, y - this.start.y) <= slopPx) return null;
      this.moving = true;
    }
    const step = { dx: x - this.last.x, dy: y - this.last.y };
    this.last = { x, y };
    return step;
  }

  up(id: number): void {
    this.fingers = Math.max(0, this.fingers - 1);
    if (id === this.id) {
      this.id = null;
      this.moving = false;
    }
  }

  get dragging(): boolean {
    return this.moving;
  }
}
