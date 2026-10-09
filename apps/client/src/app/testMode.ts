import type { SoundStats } from '../audio/engine';
import { renderStats } from '../scene/stats';

/** What e2e builds expose to Playwright (spec #2 §9.3). */
export interface TestHooks {
  /** The host plays every seat itself, with short windows. */
  fast: true;
  /** Beat lengths are multiplied by this. */
  timeScale: number;
  /** The draw calls of the last frames, for the ≤ 100 check (§6.4). */
  drawCalls(): number;
  /** The triangles drawn in the last frames, for the 150k check (spec #2 §6.4). */
  triangles(): number;
  /** Whether sound started, how many sounds played and how many failed (spec #3 §7). */
  soundStats(): SoundStats;
}

declare global {
  interface Window {
    __laddoriousTest?: TestHooks;
  }
}

export const TEST_TIME_SCALE = 0.05;

/**
 * The test hook, only in builds made with `--mode e2e`: Vite replaces import.meta.env.MODE at
 * build time, so every other build drops it. Null elsewhere.
 */
export function testHooks(mode: string = import.meta.env.MODE, soundStats: () => SoundStats = () => ({ started: false, played: 0, errors: 0 })): TestHooks | null {
  if (mode !== 'e2e') return null;
  const hooks: TestHooks = { fast: true, timeScale: TEST_TIME_SCALE, drawCalls: () => renderStats.getState().calls, triangles: () => renderStats.getState().triangles, soundStats };
  window.__laddoriousTest = hooks;
  return hooks;
}
