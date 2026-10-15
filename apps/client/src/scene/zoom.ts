// Zooming the overview (the user, 2026-10-15): a mouse wheel or a two-finger pinch over the board, kept
// between matches. The
// zoom scales the overview's distance: 1 is as tuning.json sets it, lower is closer.

export interface ZoomLimits {
  min: number;
  max: number;
}

const clamp = (v: number, { min, max }: ZoomLimits) => Math.min(max, Math.max(min, v));

/** How much one wheel step (100 units of deltaY) changes the zoom, as a factor. */
const WHEEL_STEP = 0.1;

/** The zoom after a wheel turn: rolling up (negative deltaY) comes closer, down goes back. */
export function wheelZoom(zoom: number, deltaY: number, limits: ZoomLimits): number {
  return clamp(zoom * Math.exp((deltaY / 100) * WHEEL_STEP), limits);
}

/** The zoom during a pinch that began at `startZoom` with the fingers `startGap` apart, now `gap` apart. */
export function pinchZoom(startZoom: number, startGap: number, gap: number, limits: ZoomLimits): number {
  return clamp(startZoom * (startGap / Math.max(1, gap)), limits);
}

/** Where the zoom is kept between matches (2026-10-15). */
const ZOOM_KEY = 'laddorious.zoom';

type ZoomStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

/** The page's storage, or null where there's none (a test, a blocked or private browser). */
function pageStorage(): ZoomStorage {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The zoom the last match ended on, within the limits in use; 1 with nothing (readable) kept. */
export function savedZoom(limits: ZoomLimits, storage: ZoomStorage = pageStorage()): number {
  try {
    const kept = Number(storage?.getItem(ZOOM_KEY) ?? NaN);
    return Number.isFinite(kept) && kept > 0 ? clamp(kept, limits) : 1;
  } catch {
    return 1;
  }
}

/** Keep the zoom for the next match. */
export function rememberZoom(zoom: number, storage: ZoomStorage = pageStorage()): void {
  try {
    storage?.setItem(ZOOM_KEY, String(zoom));
  } catch {
    // Storage full or blocked: the zoom just isn't kept.
  }
}
