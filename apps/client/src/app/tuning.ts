import { createStore } from 'zustand/vanilla';

// Admin settings (the user, 2026-10-15): numbers an admin can change without touching the code. They
// live in public/tuning.json, served with the game and read at startup; a later dashboard can write the
// same file. Every value is checked: a missing or bad one falls back to its default below.

export interface Tuning {
  camera: {
    /** The whole-board view: how far back and how high the camera sits, and how far a wheel or pinch can zoom it (1 = as set). */
    overview: { distance: number; height: number; zoomMin: number; zoomMax: number };
    /** How quickly the camera reaches a new shot, following a piece or swooping in for my own moments (higher is quicker). */
    follow: { ease: number };
    swoop: { ease: number };
  };
  timing: {
    /** Each tile hop, in the air and landing (ms). */
    hopMs: number;
    /** The pause after the last die roll, dice still showing, before the pieces move (ms). */
    rollPauseMs: number;
    /** Before each card plays, while the camera reaches its player (ms). */
    cardLeadMs: number;
    /** The pause after each card and its moves (ms). */
    cardPauseMs: number;
    /** My own face-off's opening: the collision held, then the hop down (ms). */
    faceOffIntroMs: number;
    /** A face-off loser's flight backwards (ms). */
    knockbackMs: number;
  };
  hud: {
    /** Lines in the action log, top left. */
    feedLines: number;
    /** On landscape phones, card info as a compact list under the action log instead of bubbles and a bottom queue. */
    phoneCompactCards: boolean;
  };
}

export const DEFAULT_TUNING: Tuning = {
  camera: {
    overview: { distance: 23.4, height: 24.4, zoomMin: 0.6, zoomMax: 1.4 },
    follow: { ease: 3.2 },
    swoop: { ease: 2.8 },
  },
  timing: { hopMs: 230, rollPauseMs: 400, cardLeadMs: 450, cardPauseMs: 600, faceOffIntroMs: 1900, knockbackMs: 850 },
  hud: { feedLines: 4, phoneCompactCards: true },
};

/** Settings that must be whole numbers, and ones that must be above zero (not just zero or more). */
const WHOLE = new Set(['hud.feedLines']);
const POSITIVE = new Set(['camera.overview.distance', 'camera.overview.height', 'camera.overview.zoomMin', 'camera.overview.zoomMax', 'camera.follow.ease', 'camera.swoop.ease', 'timing.hopMs', 'hud.feedLines']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every value of `raw` that fits its default's shape and limits, over the defaults; and what was refused. */
export function mergeTuning(raw: unknown, defaults: Tuning = DEFAULT_TUNING): { tuning: Tuning; problems: string[] } {
  const problems: string[] = [];
  const walk = (def: Record<string, unknown>, given: unknown, path: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const from = isRecord(given) ? given : {};
    for (const [key, base] of Object.entries(def)) {
      const at = path ? `${path}.${key}` : key;
      const value = from[key];
      if (isRecord(base)) {
        out[key] = walk(base, value, at);
      } else if (value === undefined) {
        out[key] = base;
      } else if (typeof base === 'boolean') {
        out[key] = typeof value === 'boolean' ? value : (problems.push(`${at} should be true or false`), base);
      } else {
        const ok = typeof value === 'number' && Number.isFinite(value) && (POSITIVE.has(at) ? value > 0 : value >= 0) && (!WHOLE.has(at) || Number.isInteger(value));
        out[key] = ok ? value : (problems.push(`${at} should be a ${WHOLE.has(at) ? 'whole ' : ''}number${POSITIVE.has(at) ? ' above 0' : ' of 0 or more'}`), base);
      }
    }
    return out;
  };
  const tuning = walk(defaults as unknown as Record<string, unknown>, raw, '') as unknown as Tuning;
  const { overview } = tuning.camera;
  if (overview.zoomMin > 1 || overview.zoomMax < 1) {
    problems.push('camera.overview.zoomMin should be 1 or less', 'camera.overview.zoomMax should be 1 or more');
    overview.zoomMin = defaults.camera.overview.zoomMin;
    overview.zoomMax = defaults.camera.overview.zoomMax;
  }
  return { tuning, problems };
}

/** The settings in use. The game reads them through `tuning()`. */
export const tuningStore = createStore<Tuning>()(() => DEFAULT_TUNING);

export const tuning = (): Tuning => tuningStore.getState();

/** How long startup waits for tuning.json before going on with the defaults. */
const LOAD_TIMEOUT_MS = 1500;

/**
 * Reads tuning.json (next to the page) into the settings in use. Missing, slow or broken, the game starts
 * with the defaults; refused values are reported once, so an admin can see what didn't take.
 */
export async function loadTuning(fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch, warn: (message: string) => void = (m) => console.warn(m)): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
  try {
    const response = await fetcher('tuning.json', { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) {
      tuningStore.setState(DEFAULT_TUNING, true);
      return;
    }
    const { tuning: merged, problems } = mergeTuning(await response.json());
    tuningStore.setState(merged, true);
    if (problems.length > 0) warn(`tuning.json: ${problems.join('; ')}; using the defaults for those`);
  } catch (e) {
    tuningStore.setState(DEFAULT_TUNING, true);
    warn(`tuning.json could not be read (${String(e)}); using the defaults`);
  } finally {
    clearTimeout(timer);
  }
}
