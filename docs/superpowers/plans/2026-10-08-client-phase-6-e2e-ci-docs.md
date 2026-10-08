# Phase 6 — End-to-End Tests, CI and Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** Playwright playing whole matches on desktop Chromium and on emulated landscape iPhone 12 and Pixel 7. CI running the build, the unit and component tests, and the e2e run. README files that explain how to work on, test and deploy every part.

**Architecture:**

- **Fast test mode:** e2e builds (`vite build --mode e2e`) expose `window.__laddoriousTest` and switch the game into a fast mode:
  - the Director plays beats at a fraction of their length (`timeScale`);
  - the Web Worker host plays the human seat with a bot;
  - bots decide in tens of milliseconds;
  - windows and the playback cap are short.

  So a full match runs in seconds. Vite replaces `import.meta.env.MODE` at build time, so normal builds drop the test code.
- **Playwright:** it serves the e2e build with `vite preview` and drives the real UI by its accessible names. It reads the draw calls through the hook.

**Tech Stack:** Playwright 1.63 (`@playwright/test`, Chromium only: the iPhone project is emulated in Chromium), GitHub Actions, Vite 8, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md`:

- §9.3: end-to-end tests (projects, flow, portrait, the test hook, the performance check).
- §9.4: the manual phone check.
- §9.5: CI.
- §10: documentation.
- §3: the `pnpm e2e` script.

## Global Constraints

- **Test hook:** `window.__laddoriousTest` exists only in builds made with `--mode e2e`. Production and dev builds don't have it (§9.3).
- **Projects:** desktop Chromium, and landscape iPhone 12 and Pixel 7 emulated in Chromium (§9.3).
- **Flow:** menu → PLAY → (clock advanced) Play with bots → a full match to the end screen → Play again → matchmaking.
- **Portrait:** the viewport shows the rotate screen.
- **Performance:** at most 100 draw calls in a match (§6.4, §9.3).
- **CI** keeps typecheck, lint and test. It adds the client production build and the Playwright run in Chromium (§9.5).
- **READMEs:** the root, `apps/client`, `packages/core` and `packages/bots`, with the contents §10 lists.
- **Release-age gate:** pnpm refuses releases younger than a day, so use `@playwright/test@^1.63.0`. 1.64.0 came out on 2026-10-07.
- **Process:** work on `client/phase-6`, inline, with no subagents; reviews are self-reviews. Commit per task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Read counts with `grep -E "Test Files|Tests "`.

## Review Focus

1. **A test-only switch leaking into production.** Expected: a production build contains no `__laddoriousTest`. Pinned in Task 1 (`testHooks` returns null outside e2e) and Task 2 (a grep of `dist/` after `pnpm build`).
2. **The host playing my seat outside e2e.** Expected: without `fast`, the human seat is never played by a bot. Pinned in Task 1: the existing LocalHost tests stay green, and the new test sets `fast` explicitly.
3. **Headless Chromium without a GPU.** Expected: WebGL still works through SwiftShader, so the draw-call check reads real numbers. Pinned in Task 2 (launch flags, and the draw-call test asserts more than 0 calls).
4. **A slow CI machine.** Expected: a whole match fits the test timeout. Pinned in Task 2 by a 180 s test timeout and fast mode; a fast-mode match is about 30 s of game time.
5. **README commands that don't work.** Expected: every command in the READMEs exists in `package.json`. Pinned in Task 4 by running each one, or a dry run of it.

---

## Before Task 1: commit the plan

- [ ] **Commit the plan and the phase index row**

In `docs/superpowers/plans/2026-10-04-3d-client-phases.md`, fill the Phase 6 plan cell with `2026-10-08-client-phase-6-e2e-ci-docs.md`. In `docs/superpowers/HANDOFF.md`, change the Phase 6 status in "Next step" to "plan written, being executed on `client/phase-6`".

```bash
git add docs/superpowers/plans/2026-10-08-client-phase-6-e2e-ci-docs.md docs/superpowers/plans/2026-10-04-3d-client-phases.md docs/superpowers/HANDOFF.md
git commit -m "docs: add the phase 6 plan (e2e, CI, docs)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Fast test mode and the test hook

**Files:**
- Modify:
  - `apps/client/src/director/director.ts`, `apps/client/src/worker/protocol.ts`, `apps/client/src/worker/localHost.ts`;
  - `apps/client/src/service/workerSession.ts`, `apps/client/src/service/localMatchService.ts`;
  - `apps/client/src/app/MatchScreen.tsx`, `apps/client/src/app/App.tsx`, `apps/client/src/main.tsx`;
  - tests: `apps/client/test/director.test.ts`, `localHost.test.ts`, `localMatchService.test.ts`, `App.test.tsx`.
- Create: `apps/client/src/app/testMode.ts`, `apps/client/test/testMode.test.tsx`

**Interfaces:**
- Produces:
  - `new Director(me, playbackDone, warn?, timeScale?)`;
  - `ToHost` `create` with `fast?: boolean`, and `FAST` in `localHost.ts`;
  - `new WorkerMatchSession(worker, seats, seeds, fast?)` and `new LocalMatchService(createWorker, opts?: { fast?: boolean })`;
  - `MatchScreen` prop `timeScale?`, and `App` prop `test?: TestHooks | null`;
  - `testHooks(mode?)`, `TestHooks` and `TEST_TIME_SCALE` (0.05).

- [ ] **Step 1: Write the failing tests**

Append to `apps/client/test/director.test.ts`:

```ts
describe('Director time scale (e2e builds)', () => {
  it('plays each beat at a fraction of its length', () => {
    const done: number[] = [];
    const director = new Director('p0', (w) => done.push(w), vi.fn(), 0.1);
    director.push(openingUpdate());
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    const short = Math.round(hops(3) * 0.1);
    expect(director.store.getState().beat?.durationMs).toBe(short);
    vi.advanceTimersByTime(short);
    expect(director.store.getState().beat).toBeNull();
    expect(done).toEqual([1, 2]);
  });
});
```

Append to `apps/client/test/localHost.test.ts`:

```ts
describe('LocalHost fast mode (e2e builds, spec #2 §9.3)', () => {
  it('plays every seat itself, the human one included, and finishes a match quickly', () => {
    const sent: FromHost[] = [];
    const host = new LocalHost((msg) => sent.push(msg));
    host.handle({ type: 'create', seats: SEATS, seed: 'board-seed', rngSeed: SECRET, fast: true });
    const events = () => sent.flatMap((m) => (m.type === 'update' ? m.update.events : []));
    for (let t = 0; t < 600_000 && !events().some((e) => e.type === 'MatchWon'); t += 100) vi.advanceTimersByTime(100);
    expect(events().some((e) => e.type === 'MatchWon')).toBe(true);
    const myRolls = events().filter((e) => e.type === 'DieRolled' && e.player === 'p0');
    expect(myRolls.length).toBeGreaterThan(0);
    expect(myRolls.every((e) => e.type === 'DieRolled' && !e.auto)).toBe(true);
    expect(sent.some((m) => m.type === 'failed' || m.type === 'rejected')).toBe(false);
  });
});
```

Append to `apps/client/test/localMatchService.test.ts`:

```ts
describe('LocalMatchService in e2e builds', () => {
  it('starts the worker in fast mode only when asked', () => {
    const workers: FakeWorker[] = [];
    const make = (fast?: boolean) =>
      new LocalMatchService(() => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      }, fast === undefined ? undefined : { fast });
    for (const service of [make(), make(true)]) {
      service.findMatch(ARI).playWithBots();
      vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    }
    expect(workers.map((w) => (w.posted[0]?.type === 'create' ? w.posted[0].fast : 'none'))).toEqual([false, true]);
  });
});
```

Create `apps/client/test/testMode.test.tsx`:

```tsx
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
```

Append to the `describe('App …')` block in `apps/client/test/App.test.tsx`:

```tsx
  it('shows the render stats in e2e builds, for the draw-call check', () => {
    const made: ScriptedMatchmaking[] = [];
    const service: MatchService = {
      findMatch: () => {
        const matchmaking = new ScriptedMatchmaking();
        made.push(matchmaking);
        return matchmaking;
      },
    };
    const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
    render(<App service={service} prefs={prefs} dev={false} test={{ fast: true, timeScale: 0.05, drawCalls: () => 0 }} />);
    startMatch(made);
    expect(screen.getByText(/draw calls/)).toBeTruthy();
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/director.test.ts apps/client/test/localHost.test.ts apps/client/test/localMatchService.test.ts apps/client/test/testMode.test.tsx apps/client/test/App.test.tsx`

Expected:
- `testMode.test.tsx`: FAIL with `Failed to resolve import "../src/app/testMode"`.
- The new director, LocalHost, LocalMatchService and App tests FAIL. Without `fast`, the host leaves the human seat to time out, so its rolls are `auto`.

- [ ] **Step 3: Implement the fast mode and the hook**

In `apps/client/src/director/director.ts`, add a fourth constructor parameter after `warn`:

```ts
    /** Beat lengths are multiplied by this: e2e builds play matches fast (spec #2 §9.3). */
    private readonly timeScale = 1,
```

and in `playNext`, replace the lines from `this.store.setState({ beat: { ...beat, startedAt: Date.now() }, …` to the end of the `setTimeout` call with:

```ts
    const durationMs = Math.round(beat.durationMs * this.timeScale);
    this.store.setState({ beat: { ...beat, durationMs, startedAt: Date.now() }, log: this.logged(beat.events) });
    this.timer = setTimeout(() => {
      this.timer = null;
      this.store.setState({ presentation: beat.after });
      current.next += 1;
      this.playNext();
    }, durationMs);
```

In `apps/client/src/worker/protocol.ts`, change the `create` member to:

```ts
  | { type: 'create'; seats: SeatInfo[]; seed: string; rngSeed: string; /** e2e builds: every seat plays itself, fast (spec #2 §9.3). */ fast?: boolean }
```

In `apps/client/src/worker/localHost.ts`:

1. After `BOT_DELAY_MAX_MS`, add:

   ```ts
   /** Fast mode (e2e builds, spec #2 §9.3): every seat plays itself at once and windows are short, so a match takes seconds. */
   export const FAST = { windows: { diceMs: 1500, challengeMs: 1500, mysteryMs: 1500 }, botDelayMinMs: 20, botDelayMaxMs: 80, playbackCapMs: 1500 } as const;
   ```

2. Add a field `private fast = false;` after `private stopped = false;`.
3. In `handle`, call `this.create(msg.seats, msg.seed, msg.rngSeed, msg.fast ?? false);`.
4. Replace `create` with:

   ```ts
   private create(seats: SeatInfo[], seed: string, rngSeed: string, fast: boolean): void {
     const human = seats.find((s) => !s.bot);
     if (!human) throw new Error('a local match needs a human seat');
     this.me = human.playerId;
     this.fast = fast;
     // In fast mode a bot plays the human seat too.
     const played = fast ? seats : seats.filter((s) => s.bot);
     this.bots = makeBots(played.map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
     this.match = createMatch(fast ? { seed, rngSeed, windows: FAST.windows } : { seed, rngSeed }, seats.map((s) => ({ id: s.playerId })));
     this.afterStep([]);
   }
   ```

5. In `afterStep`, use `this.fast ? FAST.playbackCapMs : PLAYBACK_CAP_MS` for the playback timer.
6. In `scheduleBots`, compute the delay from `this.fast ? FAST.botDelayMinMs : BOT_DELAY_MIN_MS` and `this.fast ? FAST.botDelayMaxMs : BOT_DELAY_MAX_MS`.

In `apps/client/src/service/workerSession.ts`, add a fourth constructor parameter `fast = false` after `seeds`, and post `{ type: 'create', seats, seed: seeds.seed, rngSeed: seeds.rngSeed, fast }`.

In `apps/client/src/service/localMatchService.ts`:

1. Change the service constructor to `constructor(private readonly createWorker: () => HostWorker, private readonly opts: { fast?: boolean } = {}) {}`.
2. Pass `this.opts.fast ?? false` to `LocalMatchmaking` as a fourth argument, `private readonly fast: boolean`.
3. Create the session with `new WorkerMatchSession(this.createWorker(), this.seats, { seed: this.boardSeed ?? randomSeed(), rngSeed: randomSeed() }, this.fast)`.

Create `apps/client/src/app/testMode.ts`:

```ts
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
```

In `apps/client/src/app/MatchScreen.tsx`:

- add `timeScale?: number` to `MatchScreenProps`, documented as "Beat lengths are multiplied by this (e2e builds).";
- take `timeScale = 1` in the props;
- create the director with `new Director(me, (windowId) => session.playbackDone(windowId), undefined, timeScale)`.

In `apps/client/src/app/App.tsx`:

- import `type TestHooks` from `./testMode`;
- add `test?: TestHooks | null` to `AppProps` ("e2e builds: fast matches and the render stats for the draw-call check");
- take `test = null` in the props;
- pass `showStats={dev || test !== null}` and `timeScale={test?.timeScale ?? 1}` to `MatchScreen`.

In `apps/client/src/main.tsx`:

- import `testHooks` from `./app/testMode`;
- before the service, add `const test = import.meta.env.MODE === 'e2e' ? testHooks() : null;`;
- create the service with `new LocalMatchService(createWorker, { fast: test !== null })`;
- render `<App … test={test} />`.

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/director.test.ts apps/client/test/localHost.test.ts apps/client/test/localMatchService.test.ts apps/client/test/testMode.test.tsx apps/client/test/App.test.tsx`
Expected: PASS, 5 files.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  55 passed (55)` and `Tests  412 passed (412)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add a fast test mode behind an e2e-only hook

Builds made with --mode e2e expose window.__laddoriousTest: the host
plays every seat itself with short windows, the director plays beats at
5% of their length and the render stats stay on for the draw-call
check, so a full match runs in seconds (spec #2 §9.3). Other builds
drop it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Playwright end-to-end tests

**Files:**
- Create: `apps/client/playwright.config.ts`, `apps/client/e2e/game.spec.ts`, `apps/client/e2e/tsconfig.json`
- Modify: `apps/client/package.json` (`@playwright/test` and the `e2e` script), root `package.json` (`e2e`, `typecheck`), `.gitignore`, `pnpm-lock.yaml`

- [ ] **Step 1: Add Playwright and its Chromium**

Run: `pnpm --filter @laddorious/client add -D @playwright/test@^1.63.0`
Run: `pnpm --filter @laddorious/client exec playwright install chromium`
Expected: both complete. The second downloads Chromium and its headless shell into the Playwright cache.

- [ ] **Step 2: Write the e2e tests**

Create `apps/client/e2e/game.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

/** PLAY, then (clock advanced 16 s) Play with bots, until the match screen is up. */
async function startMatch(page: Page) {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
}

test('plays a whole match against the bots, then Play again goes back to matchmaking (spec #2 §9.3)', async ({ page }) => {
  await startMatch(page);
  await expect(page.getByRole('heading', { name: /wins?!$/ })).toBeVisible({ timeout: 150_000 });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
});

test('keeps a match within 100 draw calls (spec #2 §6.4)', async ({ page }) => {
  await startMatch(page);
  const calls: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    calls.push(await page.evaluate(() => window.__laddoriousTest?.drawCalls() ?? -1));
  }
  expect(Math.max(...calls)).toBeGreaterThan(0);
  expect(Math.max(...calls)).toBeLessThanOrEqual(100);
});

test('asks to turn the phone sideways in portrait (spec #2 §7.3)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Turn your phone sideways');
});
```

Create `apps/client/e2e/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "types": ["node"],
    "noEmit": true
  },
  "include": [".", "../playwright.config.ts", "../src/app/testMode.ts", "../src/scene/stats.ts"]
}
```

- [ ] **Step 3: Configure Playwright and the scripts**

Create `apps/client/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

/**
 * End-to-end tests (spec #2 §9.3) against the e2e build, which has the fast test mode and
 * window.__laddoriousTest. All projects run in Chromium; the phones are emulated.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // WebGL without a GPU: SwiftShader.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-12-landscape', use: { ...devices['iPhone 12 landscape'], browserName: 'chromium' } },
    { name: 'pixel-7-landscape', use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

In `apps/client/package.json`, add the script `"e2e": "playwright test"`.

In the root `package.json`:

- add the script `"e2e": "pnpm --filter @laddorious/client e2e"`;
- append ` && tsc -p apps/client/e2e` to `typecheck`.

In `.gitignore`, add `dist-e2e/`, `test-results/` and `playwright-report/`.

- [ ] **Step 4: Run the e2e tests**

Run: `pnpm e2e`
Expected: 9 passed (3 tests × 3 projects).

- [ ] **Step 5: Check that production drops the hook, and run the full gate**

Run: `pnpm build && grep -rl "__laddoriousTest" apps/client/dist || echo "no hook in production"`
Expected: `no hook in production`.

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  55 passed (55)` and `Tests  412 passed (412)`. Vitest doesn't pick up `e2e/`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json apps/client pnpm-lock.yaml
git commit -m "test(client): play whole matches end to end with Playwright

Desktop Chromium and landscape iPhone 12 and Pixel 7 (emulated in
Chromium) play menu → PLAY → Play with bots → a full match → end →
Play again against the e2e build; a portrait viewport shows the rotate
screen; a match stays within 100 draw calls (spec #2 §6.4, §9.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the build and the Playwright job**

Replace `.github/workflows/ci.yml` with:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build

  e2e:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @laddorious/client exec playwright install --with-deps chromium
      - run: pnpm e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: apps/client/test-results
```

- [ ] **Step 2: Check the workflow parses and its commands exist**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); for (const c of y.matchAll(/run: (pnpm [^\n]+)/g)) console.log(c[1])"`
Expected: the commands listed, each of which `package.json` defines (`typecheck`, `lint`, `test`, `build`, `e2e`) or pnpm itself runs (`install`, `--filter … exec`).

There is no git remote, so the workflow can't run here.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build the client and run Playwright in Chromium

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: READMEs

**Files:**
- Modify: `README.md`
- Create: `apps/client/README.md`, `packages/core/README.md`, `packages/bots/README.md`

The texts are written during this task from the code as it stands, covering every §10 item:

- **Root README:**
  - what Laddorious is, and the repo map (`apps/` vs `packages/`);
  - setup (Node 24, pnpm 11) and every script;
  - how the apps and libraries relate, and the visibility rule;
  - changing rules safely: the engine tests, golden snapshots (`vitest -u` only for intended changes) and the simulator;
  - CI, and where specs and plans live.
- **Client README:**
  - local development and building;
  - deploying `dist` to Cloudflare Pages step by step, with Netlify and Vercel notes;
  - testing on a real phone over Wi-Fi (`pnpm dev --host`), and the §9.4 checklist (frame rate on Auto and Low, notch and home-bar clearance, the 44 px targets, rotation, pause on lock);
  - how asset slots work and how to drop in a `.glb`;
  - the dev overlay and the seed field;
  - the e2e tests and the test hook.
- **Core README:** what the package exports, and its determinism rules (no clock, no unseeded randomness, plain-JSON state, `step` never mutates).
- **Bots README:** the exports (`RandomBot`, `HeuristicBot`, `makeBots`, `scoreCard`) and the policies; bots see only `viewFor` output.

- [ ] **Step 1: Write the READMEs**

Write the four files.

- [ ] **Step 2: Check every command the READMEs name**

Run each `pnpm` command the READMEs give, with a dry-run form where a command is long-running (`pnpm dev` and `pnpm e2e` are already exercised). Expected: none fails as unknown.

- [ ] **Step 3: Commit**

```bash
git add README.md apps/client/README.md packages/core/README.md packages/bots/README.md
git commit -m "docs: write the READMEs for the repo, the client, core and bots

How to set up, test, change rules safely, deploy the client (Cloudflare
Pages, with Netlify and Vercel notes), test on a phone, drop in .glb
models, and what core and bots export (spec #2 §10).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Phase gate and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Local only: the project memory

- [ ] **Step 1: Run everything from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E "Test Files|Tests "
pnpm build 2>&1 | grep -E "built|error"
pnpm e2e 2>&1 | tail -3
git status --short
```

Expected: no errors; `Test Files  55 passed (55)` and `Tests  412 passed (412)`; `✓ built`; `9 passed`; only `.claude/` untracked.

- [ ] **Step 2: Update the handoff note**

In `docs/superpowers/HANDOFF.md`:

1. Retitle it `# Handoff — 3D client (Spec #2) complete`.
2. Add a Phase 6 row: **done**, merged locally, citing this plan and its commits.
3. Give the suite size and the e2e count.
4. Replace "Next step" with the open choices:
   - **Spec #3**, the multiplayer server. It was suggested next, tested first on the user's own network (memory `multiplayer-lan-testing`).
   - **Spec #4**, the Blender art pass, through the asset slots.
   - Fixes for the deferred minors listed in Open items.
5. Add the Phase 5 and Phase 6 deferred minors to Open items.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: hand off after phase 6 (spec #2 complete)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Update the project memory**

- In `handoff.md`: "Spec #2 (3D client, Phases 1-6) is done and merged to `main` locally. Next: the user picks Spec #3 (server) or Spec #4 (art)."
- In `continue-through-phase-6.md`: note that the standing order is fulfilled.
- In `MEMORY.md`: update the index lines to match.

After Task 5:

1. Self-review the whole branch against §9.3–§9.5, §10 and this Review Focus, and say it was a self-review.
2. Merge `client/phase-6` into `main` locally (fast-forward), confirm the suite on `main`, and delete the branch.
3. Report every ruling and deferred minor from Phases 3–6 to the user.
