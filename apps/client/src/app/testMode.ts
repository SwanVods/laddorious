import { renderStats } from '../scene/stats';

/** What e2e builds expose to Playwright (spec #2 §9.3). */
export interface TestHooks {
  /** The host plays every seat itself, with short windows. */
  fast: true;
  /** Beat lengths are multiplied by this. */
  timeScale: number;
  /** The draw calls of the last frames, for the ≤ 100 check (§6.4). */
  drawCalls(): number;
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
export function testHooks(mode: string = import.meta.env.MODE): TestHooks | null {
  if (mode !== 'e2e') return null;
  const hooks: TestHooks = { fast: true, timeScale: TEST_TIME_SCALE, drawCalls: () => renderStats.getState().calls };
  window.__laddoriousTest = hooks;
  return hooks;
}
