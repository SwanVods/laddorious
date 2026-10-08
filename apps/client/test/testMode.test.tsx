// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { TEST_TIME_SCALE, testHooks } from '../src/app/testMode';
import { renderStats } from '../src/scene/stats';

afterEach(() => {
  delete window.__laddoriousTest;
});

describe('the e2e test hook (spec #2 §9.3)', () => {
  it('exists only in e2e builds', () => {
    expect(testHooks('production')).toBeNull();
    expect(testHooks('development')).toBeNull();
    expect(window.__laddoriousTest).toBeUndefined();
  });

  it('speeds the match up and reports the draw calls', () => {
    const hooks = testHooks('e2e')!;
    expect(hooks).toMatchObject({ fast: true, timeScale: TEST_TIME_SCALE });
    expect(window.__laddoriousTest).toBe(hooks);
    renderStats.setState({ calls: 42 });
    expect(window.__laddoriousTest!.drawCalls()).toBe(42);
  });
});
