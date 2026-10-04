# Phase 2 — Client Scaffold, Local Host and Match Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** `pnpm dev` opens a dev page where "Play with bots" runs a full 4-player bot match through `LocalMatchService` and a Web Worker host, shown as a live text log with the window timer and the final rankings.

**Architecture:** A new `apps/client` (Vite + React + TypeScript). The engine and the bots run only in a Web Worker. There, `LocalHost` (a plain class, tested with fake timers) owns the match state, the window timers and the bots, and posts the human seat nothing but `viewFor` and `eventsFor` output. On the main thread, `WorkerMatchSession` implements spec §4.3's `MatchSession` over the worker messages, and `LocalMatchService` runs the matchmaking states. A throwaway React dev page drives both. Phases 3–5 replace it with the director, the 3D board and the real screens.

**Tech Stack:** React 19.3, Vite 8.3 with `@vitejs/plugin-react` 6.1, TypeScript 6.0 (strict), Vitest 5 with jsdom 29 and React Testing Library 16, ESLint 10 with `@eslint-react/eslint-plugin` 5, pnpm 11.5 workspaces, Node ≥ 24.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md` (§3 scripts, all of §4, the §7.4 palette tokens; decisions C4, C7, C8, C13, C14). Phase index: `docs/superpowers/plans/2026-10-04-3d-client-phases.md`.

**Dry run:** every file in this plan was built and run once in a scratch copy of the repository (not in the repo itself). There the full suite passed (30 files, 224 tests), and typecheck, lint and the production build were clean. In the browser, the dev server ran a full bot match to the rankings, and the production build started one. If a step's output differs from its `Expected:` line, stop and find out why before going on.

## Global Constraints

- Client folders (spec §4.1): `src/app/`, `src/service/`, `src/worker/`. The `director/`, `scene/`, `assets/`, `hud/` and `ui/` folders arrive in later phases.
- Visibility (§4.2): the main thread only ever receives `viewFor(state, me)` and `eventsFor(events, me)`. The rng seed never comes back from the worker. The page makes `seed` and `rngSeed` with `crypto.getRandomValues`, posts both in `create` (§4.4), and keeps neither.
- `PieceId`, `Profile`, `SeatInfo`, `MatchmakingState`, `MatchService`, `Matchmaking`, `PlayerAction`, `MatchUpdate` and `MatchSession` are exactly as in spec §4.3.
- Worker messages (§4.4): main → worker `create { seats, seed, rngSeed }`, `action { action, windowId }`, `playbackDone { windowId }`, `pause`, `resume`, `leave`; worker → main `update { update }`, `rejected { error }`, `failed { message }`.
- Window timing (C13, §4.4): a new window waits for the human seat's `playbackDone`, capped at **12 s**, then counts down `awaiting.durationMs`. Each awaited bot acts **0.6–2.5 s** into the countdown. On expiry the host steps `{ type: 'timeout', windowId }`. `pause` and `resume` freeze and restore every timer (C14). `endsAt` is epoch ms (`Date.now()`), the one clock the page and the worker share.
- Matchmaking (§4.4, C7, C8): `searching` about every **250 ms**; bots take seats about **420 ms** apart; "Play with bots" appears after **15 s**; a bot match is you plus 3 bots.
- Seats: seat 0 is you in coral `#ff5470`. The bots are Mochi `#3b82f6`, Pip `#a3e635` and Juno `#8b5cf6`, taking the pieces you didn't choose in picker order `knight, pawn, meeple, dragon`. Player ids are `p0`–`p3`.
- Colours come only from tokens: `src/app/theme.ts` for TypeScript, CSS custom properties in `src/app/theme.css` for the page (§7.4).
- Touch first: buttons are at least 44 px tall, and nothing needs a keyboard (§7.3).
- No three.js, React Three Fiber, drei or Zustand in this phase. Each one is added by the phase that first uses it.
- `packages/core` keeps its determinism lint rules and `packages/*` keep the no-`node:*` rule. The engine and the bots are bundled only into the worker chunk.
- pnpm 11 refuses releases younger than its minimum release age (one day). Every `pnpm add` below uses a caret range whose floor is already old enough, and pnpm picks the newest version that passes.
- CI runs `pnpm install --frozen-lockfile`, so `pnpm-lock.yaml` changes are committed with the task that made them.
- Commit messages end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run every command from the repository root `E:\AI Project\laddorious`, on branch `client/phase-2`. Work inline with no subagents; every review is a self-review.

## Review Focus

1. **A phone hides the page mid-match** (screen lock, app switch). Expected: no window expires and no bot moves while hidden; on return the countdown resumes with the time that was left, and the page receives the new end time. Pinned in Task 2 (pause tests, including the playback cap) and Task 6 (the page calls `pause`/`resume` on `visibilitychange`).
2. **Double taps and late taps in matchmaking.** A second "Play with bots", or "Cancel" after the bots started filling, must not start two matches or strand the table. Pinned in Task 4.
3. **The worker script never loads** (bad deploy, blocked chunk). Without handling, `onmessage` never fires and the page waits forever. Expected: the session reports `failed`. Pinned in Task 3 ("reports a worker that fails to load as a failed match").
4. **A screen subscribes after the first update has arrived** (a React effect that runs after the worker answered). Expected: messages that arrive before the first subscriber are held for it, so the match still starts on screen. Pinned in Task 3 ("holds messages that arrive before the first subscriber").
5. **A message that cannot cross the worker boundary.** A class instance or a function in an update throws `DataCloneError`, and only in a real worker. Expected: every message is plain data. Pinned in Tasks 2 and 3: the host tests clone every message with `structuredClone`, and the loopback worker clones both directions.

---

## Before Task 1: commit the plan

The plan, the Phase 2 row of the phase index and the handoff note were written with the plan.

- [ ] **Commit them**

```bash
git add docs/superpowers/plans/2026-10-04-client-phase-2-local-match.md docs/superpowers/plans/2026-10-04-3d-client-phases.md docs/superpowers/HANDOFF.md
git commit -m "docs: add the phase 2 plan (client scaffold, local host, match service)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: The client package and pausable timers

**Files:**
- Create: `apps/client/package.json`, `apps/client/tsconfig.json`, `apps/client/src/worker/timers.ts`, `apps/client/test/timers.test.ts`
- Modify: `package.json` (typecheck script), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the workspace packages `@laddorious/core` and `@laddorious/bots`.
- Produces: package `@laddorious/client` (private, ESM). `class PausableTimers` with `set(key: string, ms: number, fn: () => void): void` (replaces a timer with the same key; set while paused, it starts frozen), `has(key: string): boolean`, `dueAt(key: string): number | undefined` (epoch ms; a frozen timer counts as if resumed now), `clear(key: string): void`, `clearAll(): void`, `pause(): void`, `resume(): void`.

- [ ] **Step 1: Record the baseline**

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  24 passed (24)` and `Tests  180 passed (180)`.

- [ ] **Step 2: Create the package**

Create `apps/client/package.json`:

```json
{
  "name": "@laddorious/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@laddorious/bots": "workspace:*",
    "@laddorious/core": "workspace:*"
  }
}
```

Create `apps/client/tsconfig.json`. The base config loads Node's types, but the client runs in browsers, so it compiles against the DOM lib with no ambient types:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "types": []
  },
  "include": ["src", "test"]
}
```

Run: `pnpm install`
Expected: completes without errors; `git status --short pnpm-lock.yaml` shows it modified (a new `apps/client` importer).

- [ ] **Step 3: Write the failing test**

Create `apps/client/test/timers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PausableTimers } from '../src/worker/timers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PausableTimers', () => {
  it('fires once after its delay, then forgets the key', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(timers.has('a')).toBe(false);
  });

  it('replaces a timer set again under the same key', () => {
    const timers = new PausableTimers();
    const first = vi.fn();
    const second = vi.fn();
    timers.set('a', 1000, first);
    timers.set('a', 500, second);
    vi.advanceTimersByTime(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports when a timer is due, and clear and clearAll cancel', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    timers.set('b', 2000, fn);
    timers.set('c', 3000, fn);
    expect(timers.dueAt('b')).toBe(2000);
    expect(timers.dueAt('missing')).toBeUndefined();
    timers.clear('a');
    expect(timers.has('a')).toBe(false);
    timers.clearAll();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    expect(timers.has('b') || timers.has('c')).toBe(false);
  });

  it('freezes every timer while paused and resumes it with the time that was left', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(400);
    timers.pause();
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    expect(timers.dueAt('a')).toBe(10_400 + 600);
    timers.resume();
    expect(timers.dueAt('a')).toBe(11_000);
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('starts a timer set while paused frozen, with its full delay', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.pause();
    timers.set('a', 1000, fn);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    timers.resume();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/timers.test.ts`
Expected: FAIL with `Failed to resolve import "../src/worker/timers"`.

- [ ] **Step 5: Implement the timers**

Create `apps/client/src/worker/timers.ts`:

```ts
interface Entry {
  fn: () => void;
  /** The delay still to run: the full delay when set, the time left after a pause. */
  remaining: number;
  /** Epoch ms when an armed timer fires. */
  dueAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/** Named one-shot timers that can all be frozen and resumed together (spec #2 C14). */
export class PausableTimers {
  private readonly entries = new Map<string, Entry>();
  private paused = false;

  /** Run fn after ms, replacing any timer with the same key. While paused, the timer starts frozen. */
  set(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    const entry: Entry = { fn, remaining: ms, dueAt: 0, handle: null };
    this.entries.set(key, entry);
    if (!this.paused) this.arm(key, entry);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Epoch ms when the timer fires; a frozen timer counts as if it resumed now. */
  dueAt(key: string): number | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    return this.paused ? Date.now() + entry.remaining : entry.dueAt;
  }

  clear(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.handle !== null) clearTimeout(entry.handle);
    this.entries.delete(key);
  }

  clearAll(): void {
    for (const key of [...this.entries.keys()]) this.clear(key);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const entry of this.entries.values()) {
      if (entry.handle !== null) clearTimeout(entry.handle);
      entry.handle = null;
      entry.remaining = Math.max(0, entry.dueAt - now);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const [key, entry] of this.entries) this.arm(key, entry);
  }

  private arm(key: string, entry: Entry): void {
    entry.dueAt = Date.now() + entry.remaining;
    entry.handle = setTimeout(() => {
      this.entries.delete(key);
      entry.fn();
    }, entry.remaining);
  }
}
```

- [ ] **Step 6: Run the test again**

Run: `pnpm vitest run apps/client/test/timers.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Typecheck the client and run the full gate**

`package.json`, in `scripts`:

```json
    "typecheck": "tsc -p packages/core && tsc -p packages/bots && tsc -p apps/sim && tsc -p apps/client",
```

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  25 passed (25)` and `Tests  185 passed (185)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 8: Commit**

```bash
git add apps/client package.json pnpm-lock.yaml
git commit -m "feat(client): add the client package and pausable timers

The match host's countdowns, playback caps and bot delays must all
freeze while the page is hidden (spec #2 C14).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The match contract and the local match host

**Files:**
- Create: `apps/client/src/service/matchService.ts`, `apps/client/src/worker/protocol.ts`, `apps/client/src/worker/localHost.ts`, `apps/client/test/support/fixtures.ts`, `apps/client/test/localHost.test.ts`

**Interfaces:**
- Consumes: `PausableTimers` (Task 1). From `@laddorious/core`: `createMatch`, `step`, `awaiting`, `viewFor`, `eventsFor` and the types `GameEvent`, `Input`, `InputError`, `MatchState`, `PlayerId`, `PlayerView`, `ChallengeChoice`, `InputErrorCode`. From `@laddorious/bots`: `makeBots(seats, 'heuristic', seed, 0)` and `Bot`.
- Produces:
  - `src/service/matchService.ts`: the spec §4.3 types (`PieceId`, `Profile`, `SeatInfo`, `MatchmakingState`, `MatchService`, `Matchmaking`, `PlayerAction`, `MatchUpdate`, `MatchSession`), plus `PIECES: readonly PieceId[]` in picker order.
  - `src/worker/protocol.ts`: `ToHost`, `FromHost` and `interface HostWorker { postMessage(msg: ToHost): void; onmessage: ((e: MessageEvent<FromHost>) => void) | null; onerror: ((e: ErrorEvent) => void) | null; terminate(): void }`.
  - `src/worker/localHost.ts`: `PLAYBACK_CAP_MS = 12_000`, `BOT_DELAY_MIN_MS = 600`, `BOT_DELAY_MAX_MS = 2_500`, `class LocalHost { constructor(post: (msg: FromHost) => void); handle(msg: ToHost): void }`.
  - `test/support/fixtures.ts`: `SEATS: SeatInfo[]` (you on the knight, then Mochi, Pip and Juno).

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/support/fixtures.ts`:

```ts
import type { SeatInfo } from '../../src/service/matchService';

/** The table a "Play with bots" match makes when you chose the knight. */
export const SEATS: SeatInfo[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', color: '#ff5470', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', color: '#3b82f6', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', color: '#a3e635', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
];
```

Create `apps/client/test/localHost.test.ts`:

```ts
import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, LocalHost, PLAYBACK_CAP_MS } from '../src/worker/localHost';
import type { FromHost } from '../src/worker/protocol';
import { SEATS } from './support/fixtures';

const SECRET = 'secret-rng-seed-7f3a';

/** A host on a fresh match. Messages are cloned like postMessage would, so anything uncloneable fails here. */
function startHost(seed = 'board-seed') {
  const sent: FromHost[] = [];
  const host = new LocalHost((msg) => sent.push(structuredClone(msg)));
  host.handle({ type: 'create', seats: SEATS, seed, rngSeed: SECRET });
  const updates = () => sent.filter((m) => m.type === 'update').map((m) => m.update);
  const last = () => updates().at(-1)!;
  const events = () => updates().flatMap((u) => u.events);
  return { host, sent, updates, last, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LocalHost window timing', () => {
  it('opens round 1 with every seat awaited and no countdown until playback is done', () => {
    const { updates, last } = startHost();
    expect(updates()).toHaveLength(1);
    expect(last().view.round).toBe(1);
    expect(last().view.awaiting).toMatchObject({ windowId: 1, window: 'dice', players: ['p0', 'p1', 'p2', 'p3'] });
    expect(last().timer).toBeNull();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS - 1);
    expect(updates()).toHaveLength(1); // no countdown, and no bot has rolled
  });

  it('starts the countdown as soon as the human seat reports playback done', () => {
    const { host, last } = startHost();
    vi.advanceTimersByTime(3000);
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(last().timer).toEqual({ windowId: 1, endsAt: 3000 + DEFAULT_WINDOWS.diceMs });
  });

  it('starts the countdown after the 12 s cap when playback never finishes', () => {
    const { last } = startHost();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it('ignores playbackDone for another window, and a repeated one', () => {
    const { host, updates } = startHost();
    host.handle({ type: 'playbackDone', windowId: 7 });
    expect(updates()).toHaveLength(1);
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(updates()).toHaveLength(2);
  });

  it('lets each bot act between 0.6 s and 2.5 s into the countdown', () => {
    const { host, last, events } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MIN_MS - 1);
    expect(last().view.awaiting.players).toEqual(['p0', 'p1', 'p2', 'p3']);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1);
    expect(last().view.awaiting.players).toEqual(['p0']);
    const rolled = events().filter((e) => e.type === 'DieRolled').map((e) => e.player);
    expect(rolled.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('times the window out at endsAt: the human seat rolls automatically and the next window waits for playback', () => {
    const { host, last, events } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs - 1);
    expect(last().view.awaiting.windowId).toBe(1);
    vi.advanceTimersByTime(1);
    expect(events()).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: true }));
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
    expect(last().timer).toBeNull();
  });

  it('plays a whole match to the end on timers alone when the human never acts', () => {
    const { last } = startHost();
    vi.runAllTimers();
    expect(last().view.phase.kind).toBe('finished');
    expect(last().view.awaiting.window).toBe('none');
    expect(last().timer).toBeNull();
  });
});

describe('LocalHost visibility (spec #2 §4.2)', () => {
  it('sends only the human seat its own view and events, and never the rng seed', () => {
    const { sent, updates, events } = startHost();
    vi.runAllTimers();
    for (const u of updates()) {
      expect(u.view.me).toBe('p0');
      if (u.view.myOffer) expect(u.view.myOffer.player).toBe('p0');
      for (const e of u.events) expect(e.visibility === 'public' || e.visibility.private === 'p0').toBe(true);
    }
    // The bots were offered cards (their picks were revealed), but their hands never arrived.
    expect(events().some((e) => e.type === 'CardSelected' && e.player !== 'p0')).toBe(true);
    expect(events().some((e) => e.type === 'MysteryOffered' && e.player !== 'p0')).toBe(false);
    expect(JSON.stringify(sent)).not.toContain(SECRET);
  });
});

describe('LocalHost inputs', () => {
  it("applies the human seat's action, even before the countdown starts", () => {
    const { host, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    expect(last().view.awaiting.players).toEqual(['p1', 'p2', 'p3']);
    expect(last().timer).toBeNull();
  });

  it('rejects a bad action with the engine error code and leaves the match unchanged', () => {
    const { host, sent, updates, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 99 });
    host.handle({ type: 'action', action: { type: 'pickCard', slot: 0 }, windowId: 1 });
    expect(sent.filter((m) => m.type === 'rejected').map((m) => m.error.code)).toEqual(['STALE_INPUT', 'WRONG_PHASE']);
    expect(updates()).toHaveLength(1);
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().view.awaiting.players).not.toContain('p0');
  });
});

describe('LocalHost pause and resume (spec #2 C14)', () => {
  it('freezes the countdown and the bots while paused, and sends the new end time on resume', () => {
    const { host, updates, last } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    const endsAt = last().timer!.endsAt;
    host.handle({ type: 'pause' });
    vi.advanceTimersByTime(60_000);
    expect(updates()).toHaveLength(2); // no bot rolled and the window did not time out
    host.handle({ type: 'resume' });
    expect(last().timer).toEqual({ windowId: 1, endsAt: endsAt + 60_000 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs);
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('freezes the playback cap too', () => {
    const { host, last } = startHost();
    host.handle({ type: 'pause' });
    vi.advanceTimersByTime(60_000);
    expect(last().timer).toBeNull();
    host.handle({ type: 'resume' });
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).not.toBeNull();
  });
});

describe('LocalHost failures', () => {
  it('fails and stops when the match cannot be created', () => {
    const sent: FromHost[] = [];
    const host = new LocalHost((msg) => sent.push(msg));
    host.handle({ type: 'create', seats: [SEATS[0]!, SEATS[0]!], seed: 's', rngSeed: 'r' });
    expect(sent).toEqual([{ type: 'failed', message: 'player ids must be unique' }]);
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(sent).toHaveLength(1);
  });

  it('fails and stops when a timer throws, such as an engine InvariantError', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.at(-1)).toEqual({ type: 'failed', message: 'board corrupted' });
    const count = sent.length;
    vi.runAllTimers();
    host.handle({ type: 'resume' });
    expect(sent).toHaveLength(count);
  });

  it('stops on leave', () => {
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'leave' });
    const count = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(count);
  });
});
```

The match outcome doesn't depend on the bots' random delays: each seat's dice, cards and choices come from its own seeded stream, and every bot acts before its window can expire. So the whole-match tests are deterministic for the fixed seeds.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/localHost.test.ts`
Expected: FAIL with `Failed to resolve import "../src/worker/localHost"`.

- [ ] **Step 3: Write the match contract (spec §4.3)**

Create `apps/client/src/service/matchService.ts`:

```ts
import type { ChallengeChoice, GameEvent, InputErrorCode, PlayerId, PlayerView } from '@laddorious/core';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService
// implements it with a Web Worker; the online service (Spec #3) will implement it over the network.

export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

/** Piece picker order. Bots take the pieces you didn't choose, in this order (§4.4). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon'];

export interface Profile {
  nickname: string;
  piece: PieceId;
}

export interface SeatInfo {
  playerId: PlayerId;
  nickname: string;
  piece: PieceId;
  color: string;
  bot: boolean;
}

export type MatchmakingState =
  | { kind: 'searching'; elapsedMs: number; seats: Array<SeatInfo | null> } // index 0 = you
  | { kind: 'filling'; seats: Array<SeatInfo | null> } // bots taking empty seats
  | { kind: 'found'; session: MatchSession }
  | { kind: 'cancelled' };

export interface MatchService {
  findMatch(profile: Profile): Matchmaking;
}

export interface Matchmaking {
  onState(cb: (s: MatchmakingState) => void): () => void;
  cancel(): void; // ignored once filling has started
  playWithBots(): void; // ignored unless searching; idempotent
}

export type PlayerAction =
  | { type: 'roll' }
  | { type: 'challengePick'; challengeId: string; choice: ChallengeChoice }
  | { type: 'reroll'; slot: number }
  | { type: 'pickCard'; slot: number };

export interface MatchUpdate {
  view: PlayerView; // viewFor(state, me) after this step
  events: GameEvent[]; // eventsFor(events, me) produced by this step
  timer: { windowId: number; endsAt: number } | null; // null while waiting for playback or when no window is open
}

export interface MatchSession {
  me: PlayerId;
  seats: SeatInfo[];
  onUpdate(cb: (u: MatchUpdate) => void): () => void;
  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void;
  onFailed(cb: (e: { message: string }) => void): () => void;
  send(action: PlayerAction): void; // the session stamps the current windowId
  playbackDone(windowId: number): void;
  pause(): void; // local only; the online service ignores it
  resume(): void;
  leave(): void;
}
```

- [ ] **Step 4: Write the worker protocol (§4.4)**

Create `apps/client/src/worker/protocol.ts`:

```ts
import type { InputError } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, SeatInfo } from '../service/matchService';

/** Main thread → host worker (spec #2 §4.4). Plain objects, so they survive structured cloning. */
export type ToHost =
  | { type: 'create'; seats: SeatInfo[]; seed: string; rngSeed: string }
  | { type: 'action'; action: PlayerAction; windowId: number }
  | { type: 'playbackDone'; windowId: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'leave' };

/** Host worker → main thread: only what a remote player would receive (§4.2). */
export type FromHost =
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'failed'; message: string };

/** The part of a Worker that the session uses, so tests can stand in for one. */
export interface HostWorker {
  postMessage(msg: ToHost): void;
  onmessage: ((e: MessageEvent<FromHost>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  terminate(): void;
}
```

- [ ] **Step 5: Implement the host**

Create `apps/client/src/worker/localHost.ts`:

```ts
import { makeBots, type Bot } from '@laddorious/bots';
import { awaiting, createMatch, eventsFor, step, viewFor, type GameEvent, type Input, type MatchState, type PlayerId } from '@laddorious/core';
import type { PlayerAction, SeatInfo } from '../service/matchService';
import type { FromHost, ToHost } from './protocol';
import { PausableTimers } from './timers';

/** How long a new window waits for the human seat's playbackDone before its countdown starts anyway (C13). */
export const PLAYBACK_CAP_MS = 12_000;
/** Each awaited bot acts at a random moment this far into the countdown (§4.4). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 2_500;

/**
 * One local match (spec #2 §4.4): the engine state, the window timers and the bots.
 * A plain class so tests can drive it with fake timers; host.worker.ts runs it in a Web Worker.
 * Everything it posts is what the human seat may see (§4.2).
 */
export class LocalHost {
  private match: MatchState | null = null;
  private me: PlayerId = '';
  private bots: Record<PlayerId, Bot> = {};
  /** The window the current timers belong to. */
  private windowId = 0;
  private stopped = false;
  private readonly timers = new PausableTimers();

  constructor(private readonly post: (msg: FromHost) => void) {}

  handle(msg: ToHost): void {
    this.guard(() => {
      switch (msg.type) {
        case 'create':
          this.create(msg.seats, msg.seed, msg.rngSeed);
          return;
        case 'action':
          this.act(msg.action, msg.windowId);
          return;
        case 'playbackDone':
          if (msg.windowId === this.windowId && this.timers.has('playback')) this.startCountdown();
          return;
        case 'pause':
          this.timers.pause();
          return;
        case 'resume':
          this.timers.resume();
          if (this.timers.has('countdown')) this.sendUpdate([]); // the countdown now ends later
          return;
        case 'leave':
          this.stop();
          return;
      }
    });
  }

  private create(seats: SeatInfo[], seed: string, rngSeed: string): void {
    const human = seats.find((s) => !s.bot);
    if (!human) throw new Error('a local match needs a human seat');
    this.me = human.playerId;
    this.bots = makeBots(seats.filter((s) => s.bot).map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
    this.match = createMatch({ seed, rngSeed }, seats.map((s) => ({ id: s.playerId })));
    this.afterStep([]);
  }

  /** The human seat's input. Engine errors go back as `rejected`; the match is unchanged. */
  private act(action: PlayerAction, windowId: number): void {
    const result = step(this.state(), { ...action, player: this.me, windowId });
    if (!result.ok) {
      this.post({ type: 'rejected', error: result.error });
      return;
    }
    this.match = result.state;
    this.afterStep(result.events);
  }

  /** Bot and timeout inputs are built from the current state, so a rejection here is a host bug. */
  private apply(input: Input): void {
    const result = step(this.state(), input);
    if (!result.ok) throw new Error(`host input rejected: ${result.error.code} ${result.error.message}`);
    this.match = result.state;
    this.afterStep(result.events);
  }

  private afterStep(events: GameEvent[]): void {
    const aw = awaiting(this.state());
    if (aw.windowId !== this.windowId) {
      // A new window: no countdown until the human seat has watched the events (C13).
      this.timers.clearAll();
      this.windowId = aw.windowId;
      if (aw.window !== 'none') this.timers.set('playback', PLAYBACK_CAP_MS, () => this.guard(() => this.startCountdown()));
    } else if (this.timers.has('countdown')) {
      this.scheduleBots(); // a bot that rerolled a card still has to pick
    }
    this.sendUpdate(events);
  }

  private startCountdown(): void {
    this.timers.clear('playback');
    const aw = awaiting(this.state());
    this.timers.set('countdown', aw.durationMs, () => this.guard(() => this.apply({ type: 'timeout', windowId: aw.windowId })));
    this.scheduleBots();
    this.sendUpdate([]);
  }

  private scheduleBots(): void {
    for (const id of awaiting(this.state()).players) {
      const bot = this.bots[id];
      const key = `bot:${id}`;
      if (!bot || this.timers.has(key)) continue;
      const delay = BOT_DELAY_MIN_MS + Math.random() * (BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS);
      this.timers.set(key, delay, () =>
        this.guard(() => {
          const input = bot.decide(viewFor(this.state(), id));
          if (input !== 'idle') this.apply(input);
        }),
      );
    }
  }

  private sendUpdate(events: GameEvent[]): void {
    const endsAt = this.timers.dueAt('countdown');
    this.post({
      type: 'update',
      update: {
        view: viewFor(this.state(), this.me),
        events: eventsFor(events, this.me),
        timer: endsAt === undefined ? null : { windowId: this.windowId, endsAt },
      },
    });
  }

  /** Every entry point runs here: an escaping exception (an engine InvariantError included) ends the match. */
  private guard(fn: () => void): void {
    if (this.stopped) return;
    try {
      fn();
    } catch (err) {
      this.stop();
      this.post({ type: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  }

  private stop(): void {
    this.stopped = true;
    this.timers.clearAll();
  }

  private state(): MatchState {
    if (!this.match) throw new Error('no match yet: create comes first');
    return this.match;
  }
}
```

How it fits the engine: `createMatch` opens round 1's dice window itself and drops that step's events, so the first update has `events: []`. Every challenge pick round opens a new window id; a Mystery reroll does not. That is why "the window changed" is tested with `awaiting(state).windowId`, and why a bot that rerolled gets a fresh delay in the same window.

- [ ] **Step 6: Run the tests again**

Run: `pnpm vitest run apps/client/test/localHost.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 7: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  26 passed (26)` and `Tests  200 passed (200)`.

- [ ] **Step 8: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the match contract and the local match host

MatchService and friends exactly as spec #2 §4.3, the worker message
protocol (§4.4), and LocalHost: the engine, the window timers and the
heuristic bots for one match. Countdowns wait for playbackDone (capped
at 12 s), bots act 0.6-2.5 s in, expiry steps a timeout, pause freezes
everything, and only viewFor/eventsFor output leaves the host.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The host worker and the main-thread session

**Files:**
- Create: `apps/client/src/worker/host.worker.ts`, `apps/client/src/service/workerSession.ts`, `apps/client/test/workerSession.test.ts`
- Modify: `apps/client/test/support/fixtures.ts` (replaced whole)

**Interfaces:**
- Consumes: `LocalHost` and `HostWorker`, `ToHost`, `FromHost` (Task 2); the §4.3 types.
- Produces:
  - `src/worker/host.worker.ts`: the worker entry; no exports.
  - `src/service/workerSession.ts`: `class WorkerMatchSession implements MatchSession`, constructed as `new WorkerMatchSession(worker: HostWorker, seats: SeatInfo[], seeds: { seed: string; rngSeed: string })`. The constructor posts `create`. `me` is the seat with `bot: false`. `send` stamps the latest update's `view.awaiting.windowId`. Messages that arrive before the first subscriber of their kind are held for it. A worker `error` event becomes `failed`. `leave()` posts `leave`, terminates the worker and goes quiet.
  - `test/support/fixtures.ts`: `SEATS`, `openingUpdate(): MatchUpdate`, `class FakeWorker` (`posted`, `terminated`, `reply(msg)`, `crash(message)`), `loopbackWorker(): HostWorker & { fromHost: FromHost[] }`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/client/test/support/fixtures.ts` with:

```ts
import { createMatch, viewFor } from '@laddorious/core';
import type { MatchUpdate, SeatInfo } from '../../src/service/matchService';
import { LocalHost } from '../../src/worker/localHost';
import type { FromHost, HostWorker, ToHost } from '../../src/worker/protocol';

/** The table a "Play with bots" match makes when you chose the knight. */
export const SEATS: SeatInfo[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', color: '#ff5470', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', color: '#3b82f6', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', color: '#a3e635', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
];

/** Round 1's opening update for SEATS, as the host sends it before playback is done. */
export function openingUpdate(): MatchUpdate {
  const state = createMatch({ seed: 'fixture' }, SEATS.map((s) => ({ id: s.playerId })));
  return { view: viewFor(state, 'p0'), events: [], timer: null };
}

/** Records what the session posts; `reply` and `crash` play the worker's side. */
export class FakeWorker implements HostWorker {
  posted: ToHost[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<FromHost>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  postMessage(msg: ToHost): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(msg: FromHost): void {
    this.onmessage?.({ data: msg } as MessageEvent<FromHost>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

/** A real LocalHost in this thread. Messages are cloned and delivered on a later tick, like postMessage. */
export function loopbackWorker(): HostWorker & { fromHost: FromHost[] } {
  let terminated = false;
  const worker = {
    fromHost: [] as FromHost[],
    onmessage: null as ((e: MessageEvent<FromHost>) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
    postMessage(msg: ToHost): void {
      const copy = structuredClone(msg);
      setTimeout(() => {
        if (!terminated) host.handle(copy);
      }, 0);
    },
    terminate(): void {
      terminated = true;
    },
  };
  const host = new LocalHost((msg) => {
    const copy = structuredClone(msg);
    worker.fromHost.push(copy);
    setTimeout(() => worker.onmessage?.({ data: copy } as MessageEvent<FromHost>), 0);
  });
  return worker;
}
```

Create `apps/client/test/workerSession.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchUpdate } from '../src/service/matchService';
import { WorkerMatchSession } from '../src/service/workerSession';
import { FakeWorker, SEATS, loopbackWorker, openingUpdate } from './support/fixtures';

const SEEDS = { seed: 'board-seed', rngSeed: 'secret-rng-seed' };

describe('WorkerMatchSession', () => {
  it('starts the match with a create message, and its human seat is me', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    expect(worker.posted).toEqual([{ type: 'create', seats: SEATS, seed: 'board-seed', rngSeed: 'secret-rng-seed' }]);
    expect(session.me).toBe('p0');
    expect(session.seats).toBe(SEATS);
  });

  it("stamps each action with the latest update's window", () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    session.onUpdate(() => {});
    const update = openingUpdate();
    worker.reply({ type: 'update', update: { ...update, view: { ...update.view, awaiting: { ...update.view.awaiting, windowId: 4 } } } });
    session.send({ type: 'roll' });
    expect(worker.posted.at(-1)).toEqual({ type: 'action', action: { type: 'roll' }, windowId: 4 });
  });

  it('posts playbackDone, pause and resume', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    session.playbackDone(3);
    session.pause();
    session.resume();
    expect(worker.posted.slice(1)).toEqual([{ type: 'playbackDone', windowId: 3 }, { type: 'pause' }, { type: 'resume' }]);
  });

  it('holds messages that arrive before the first subscriber and hands them over', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const update = openingUpdate();
    worker.reply({ type: 'update', update });
    worker.reply({ type: 'rejected', error: { code: 'STALE_INPUT', message: 'late' } });
    worker.reply({ type: 'failed', message: 'boom' });
    const got: unknown[] = [];
    session.onUpdate((u) => got.push(u));
    session.onRejected((e) => got.push(e));
    session.onFailed((e) => got.push(e));
    expect(got).toEqual([update, { code: 'STALE_INPUT', message: 'late' }, { message: 'boom' }]);
  });

  it('reports a worker that fails to load as a failed match', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const failures: Array<{ message: string }> = [];
    session.onFailed((e) => failures.push(e));
    worker.crash('');
    expect(failures).toEqual([{ message: 'the match worker stopped' }]);
  });

  it('stops delivering to a listener that unsubscribed', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: MatchUpdate[] = [];
    const off = session.onUpdate((u) => got.push(u));
    worker.reply({ type: 'update', update: openingUpdate() });
    off();
    worker.reply({ type: 'update', update: openingUpdate() });
    expect(got).toHaveLength(1);
  });

  it('leaves by posting leave and terminating the worker, then goes quiet', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: MatchUpdate[] = [];
    session.onUpdate((u) => got.push(u));
    session.leave();
    expect(worker.posted.at(-1)).toEqual({ type: 'leave' });
    expect(worker.terminated).toBe(true);
    session.send({ type: 'roll' });
    worker.reply({ type: 'update', update: openingUpdate() });
    expect(worker.posted.at(-1)).toEqual({ type: 'leave' });
    expect(got).toEqual([]);
  });
});

describe('WorkerMatchSession with a real host', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays a whole match: playback reported at once, the human rolls in every dice window', () => {
    const worker = loopbackWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const updates: MatchUpdate[] = [];
    let rolledIn = -1;
    session.onUpdate((u) => {
      updates.push(u);
      const aw = u.view.awaiting;
      if (u.timer === null && aw.window !== 'none') session.playbackDone(aw.windowId);
      if (aw.window === 'dice' && aw.players.includes(session.me) && rolledIn !== aw.windowId) {
        rolledIn = aw.windowId;
        session.send({ type: 'roll' });
      }
    });
    vi.runAllTimers();
    expect(updates.at(-1)!.view.phase.kind).toBe('finished');
    const myRolls = updates.flatMap((u) => u.events).filter((e) => e.type === 'DieRolled' && e.player === 'p0');
    expect(myRolls.length).toBe(updates.at(-1)!.view.round);
    expect(myRolls.every((e) => e.type === 'DieRolled' && !e.auto)).toBe(true);
    expect(worker.fromHost.some((m) => m.type === 'rejected' || m.type === 'failed')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/workerSession.test.ts`
Expected: FAIL with `Failed to resolve import "../src/service/workerSession"`.

- [ ] **Step 3: Implement the session**

Create `apps/client/src/service/workerSession.ts`:

```ts
import type { InputError, PlayerId } from '@laddorious/core';
import type { FromHost, HostWorker, ToHost } from '../worker/protocol';
import type { MatchSession, MatchUpdate, PlayerAction, SeatInfo } from './matchService';

/** Fans values out to listeners. Values that arrive before the first listener are held for it. */
class Channel<T> {
  private readonly listeners = new Set<(value: T) => void>();
  private held: T[] | null = [];

  emit(value: T): void {
    if (this.held) this.held.push(value);
    else for (const cb of this.listeners) cb(value);
  }

  on(cb: (value: T) => void): () => void {
    this.listeners.add(cb);
    const held = this.held ?? [];
    this.held = null;
    for (const value of held) cb(value);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

/** The main-thread side of a local match: a MatchSession that talks to the host worker (spec #2 §4.4). */
export class WorkerMatchSession implements MatchSession {
  readonly me: PlayerId;
  private windowId = 0;
  private left = false;
  private readonly updates = new Channel<MatchUpdate>();
  private readonly rejections = new Channel<InputError>();
  private readonly failures = new Channel<{ message: string }>();

  /** Starts the match. The seeds go to the worker and are not kept here: the rng seed must stay secret (§4.2). */
  constructor(
    private readonly worker: HostWorker,
    readonly seats: SeatInfo[],
    seeds: { seed: string; rngSeed: string },
  ) {
    this.me = seats.find((s) => !s.bot)!.playerId;
    worker.onmessage = (e) => this.receive(e.data);
    // The worker script itself failed (it could not load, or threw outside the host's guard).
    worker.onerror = (e) => this.failures.emit({ message: e.message || 'the match worker stopped' });
    worker.postMessage({ type: 'create', seats, seed: seeds.seed, rngSeed: seeds.rngSeed });
  }

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    return this.updates.on(cb);
  }

  onRejected(cb: (e: InputError) => void): () => void {
    return this.rejections.on(cb);
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    return this.failures.on(cb);
  }

  send(action: PlayerAction): void {
    this.post({ type: 'action', action, windowId: this.windowId });
  }

  playbackDone(windowId: number): void {
    this.post({ type: 'playbackDone', windowId });
  }

  pause(): void {
    this.post({ type: 'pause' });
  }

  resume(): void {
    this.post({ type: 'resume' });
  }

  leave(): void {
    this.post({ type: 'leave' });
    this.left = true;
    this.worker.terminate();
  }

  private post(msg: ToHost): void {
    if (!this.left) this.worker.postMessage(msg);
  }

  private receive(msg: FromHost): void {
    if (this.left) return;
    switch (msg.type) {
      case 'update':
        this.windowId = msg.update.view.awaiting.windowId;
        this.updates.emit(msg.update);
        return;
      case 'rejected':
        this.rejections.emit(msg.error);
        return;
      case 'failed':
        this.failures.emit({ message: msg.message });
        return;
    }
  }
}
```

Create `apps/client/src/worker/host.worker.ts`:

```ts
import { LocalHost } from './localHost';
import type { FromHost, ToHost } from './protocol';

// The worker's global scope, typed by hand: the client compiles against the DOM lib, not WebWorker.
const scope = self as unknown as {
  postMessage(msg: FromHost): void;
  onmessage: ((e: MessageEvent<ToHost>) => void) | null;
};

const host = new LocalHost((msg) => scope.postMessage(msg));
scope.onmessage = (e) => host.handle(e.data);
```

`host.worker.ts` is five lines of glue with no unit test; Task 7 runs it in a real browser.

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/workerSession.test.ts apps/client/test/localHost.test.ts`
Expected: PASS, 2 files, 23 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  27 passed (27)` and `Tests  208 passed (208)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the host worker and the main-thread match session

WorkerMatchSession implements MatchSession over the worker messages:
it stamps actions with the current window, holds messages for late
subscribers, turns a worker error into failed, and terminates the
worker on leave. A loopback test plays a whole match through it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The local match service

**Files:**
- Create: `apps/client/src/app/theme.ts`, `apps/client/src/service/localMatchService.ts`, `apps/client/test/localMatchService.test.ts`

**Interfaces:**
- Consumes: `WorkerMatchSession` (Task 3), `HostWorker` (Task 2), `PIECES` and the §4.3 types (Task 2), `FakeWorker` (Task 3 fixtures).
- Produces:
  - `src/app/theme.ts`: `SEAT_COLORS = { you: '#ff5470', bots: ['#3b82f6', '#a3e635', '#8b5cf6'] } as const`.
  - `src/service/localMatchService.ts`: `SEARCH_TICK_MS = 250`, `BOT_SEAT_MS = 420`, `class LocalMatchService implements MatchService`, constructed as `new LocalMatchService(createWorker: () => HostWorker)`. `findMatch(profile)` returns a `Matchmaking` whose `onState(cb)` calls `cb` with the current state at once, then with every change.

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/localMatchService.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_SEAT_MS, LocalMatchService, SEARCH_TICK_MS } from '../src/service/localMatchService';
import type { MatchmakingState, Profile } from '../src/service/matchService';
import { FakeWorker } from './support/fixtures';

const ARI: Profile = { nickname: 'Ari', piece: 'meeple' };

/** A service whose workers are fakes, with every matchmaking state recorded. */
function startSearch(profile = ARI) {
  const workers: FakeWorker[] = [];
  const service = new LocalMatchService(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const matchmaking = service.findMatch(profile);
  const states: MatchmakingState[] = [];
  matchmaking.onState((s) => states.push(s));
  const last = () => states.at(-1)!;
  const filled = () => states.filter((s) => s.kind === 'filling').map((s) => s.seats.filter((seat) => seat !== null).length);
  return { matchmaking, states, last, filled, workers };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LocalMatchService', () => {
  it('reports searching every 250 ms with you in seat 0 and three open seats', () => {
    const { states } = startSearch();
    vi.advanceTimersByTime(4 * SEARCH_TICK_MS);
    expect(states.map((s) => (s.kind === 'searching' ? s.elapsedMs : s.kind))).toEqual([0, 250, 500, 750, 1000]);
    expect(states[0]).toEqual({
      kind: 'searching',
      elapsedMs: 0,
      seats: [{ playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false }, null, null, null],
    });
  });

  it('never finds a real player', () => {
    const { last, workers } = startSearch();
    vi.advanceTimersByTime(10 * 60_000);
    expect(last().kind).toBe('searching');
    expect(workers).toHaveLength(0);
  });

  it('fills the open seats with bots 420 ms apart, then finds the match', () => {
    const { matchmaking, last, filled } = startSearch();
    matchmaking.playWithBots();
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(BOT_SEAT_MS - 1);
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(filled()).toEqual([1, 2]);
    vi.advanceTimersByTime(2 * BOT_SEAT_MS);
    expect(filled()).toEqual([1, 2, 3, 4]);
    expect(last().kind).toBe('found');
    vi.advanceTimersByTime(10_000);
    expect(last().kind).toBe('found'); // searching stopped for good
  });

  it('seats Mochi, Pip and Juno in their colours, on the pieces you did not choose, in picker order', () => {
    const { matchmaking, last } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    const found = last();
    if (found.kind !== 'found') throw new Error(`expected found, got ${found.kind}`);
    expect(found.session.me).toBe('p0');
    expect(found.session.seats).toEqual([
      { playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false },
      { playerId: 'p1', nickname: 'Mochi', piece: 'knight', color: '#3b82f6', bot: true },
      { playerId: 'p2', nickname: 'Pip', piece: 'pawn', color: '#a3e635', bot: true },
      { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
    ]);
  });

  it('starts one worker with two different random seeds', () => {
    const { matchmaking, workers } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    expect(workers).toHaveLength(1);
    const create = workers[0]!.posted[0];
    if (create?.type !== 'create') throw new Error('expected a create message first');
    expect(create.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.rngSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.seed).not.toBe(create.rngSeed);
  });

  it('cancels while searching, then ignores play with bots', () => {
    const { matchmaking, states, last, workers } = startSearch();
    matchmaking.cancel();
    expect(last()).toEqual({ kind: 'cancelled' });
    const count = states.length;
    matchmaking.playWithBots();
    vi.advanceTimersByTime(10_000);
    expect(states).toHaveLength(count);
    expect(workers).toHaveLength(0);
  });

  it('ignores cancel once filling has started, and a second play with bots: one match starts', () => {
    const { matchmaking, states, workers } = startSearch();
    matchmaking.playWithBots();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(BOT_SEAT_MS);
    matchmaking.cancel();
    vi.advanceTimersByTime(10 * BOT_SEAT_MS);
    expect(states.filter((s) => s.kind === 'found')).toHaveLength(1);
    expect(states.some((s) => s.kind === 'cancelled')).toBe(false);
    expect(workers).toHaveLength(1);
  });

  it('stops calling a listener that unsubscribed', () => {
    const service = new LocalMatchService(() => new FakeWorker());
    const states: MatchmakingState[] = [];
    const off = service.findMatch(ARI).onState((s) => states.push(s));
    off();
    vi.advanceTimersByTime(1000);
    expect(states).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/localMatchService.test.ts`
Expected: FAIL with `Failed to resolve import "../src/service/localMatchService"`.

- [ ] **Step 3: Implement the seat colours and the service**

Create `apps/client/src/app/theme.ts`:

```ts
// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the 3D world's tokens join this file in Phase 4.

/** Seat colours: coral for you, then the three bots in seat order. */
export const SEAT_COLORS = {
  you: '#ff5470',
  bots: ['#3b82f6', '#a3e635', '#8b5cf6'],
} as const;
```

Create `apps/client/src/service/localMatchService.ts`:

```ts
import { SEAT_COLORS } from '../app/theme';
import type { HostWorker } from '../worker/protocol';
import { PIECES, type Matchmaking, type MatchmakingState, type MatchService, type Profile, type SeatInfo } from './matchService';
import { WorkerMatchSession } from './workerSession';

/** How often `searching` reports the elapsed time, and the pause between bots taking seats (spec #2 §4.4). */
export const SEARCH_TICK_MS = 250;
export const BOT_SEAT_MS = 420;

const BOT_NAMES = ['Mochi', 'Pip', 'Juno'] as const;

/** Seat 0 is you; the bots take the pieces you didn't choose, in picker order. */
function seatsFor(profile: Profile): SeatInfo[] {
  const pieces = PIECES.filter((p) => p !== profile.piece);
  return [
    { playerId: 'p0', nickname: profile.nickname, piece: profile.piece, color: SEAT_COLORS.you, bot: false },
    ...BOT_NAMES.map((nickname, i) => ({
      playerId: `p${i + 1}`,
      nickname,
      piece: pieces[i]!,
      color: SEAT_COLORS.bots[i]!,
      bot: true,
    })),
  ];
}

/** 128 random bits as hex, from the platform's secure generator. */
function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Matchmaking that never finds a real player; "Play with bots" fills the empty seats (spec #2 C7). */
export class LocalMatchService implements MatchService {
  constructor(private readonly createWorker: () => HostWorker) {}

  findMatch(profile: Profile): Matchmaking {
    return new LocalMatchmaking(seatsFor(profile), this.createWorker);
  }
}

class LocalMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private readonly startedAt = Date.now();
  private readonly table: Array<SeatInfo | null>;
  private readonly ticker: ReturnType<typeof setInterval>;
  private state: MatchmakingState;

  constructor(
    private readonly seats: SeatInfo[],
    private readonly createWorker: () => HostWorker,
  ) {
    this.table = [seats[0]!, null, null, null];
    this.state = this.searching();
    this.ticker = setInterval(() => this.emit(this.searching()), SEARCH_TICK_MS);
  }

  /** Calls cb with the current state at once, then with every change. */
  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  cancel(): void {
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'filling', seats: [...this.table] });
    this.seatBot(1);
  }

  private seatBot(seat: number): void {
    setTimeout(() => {
      this.table[seat] = this.seats[seat]!;
      this.emit({ kind: 'filling', seats: [...this.table] });
      if (seat < this.seats.length - 1) {
        this.seatBot(seat + 1);
        return;
      }
      const session = new WorkerMatchSession(this.createWorker(), this.seats, { seed: randomSeed(), rngSeed: randomSeed() });
      this.emit({ kind: 'found', session });
    }, BOT_SEAT_MS);
  }

  private searching(): MatchmakingState {
    return { kind: 'searching', elapsedMs: Date.now() - this.startedAt, seats: [...this.table] };
  }

  private emit(s: MatchmakingState): void {
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
```

The "Play with bots after 15 s" rule (C7) is a screen rule, so it lives with the dev page (Task 6), not here: `playWithBots()` works at any moment while searching. The dev-only seed field of §4.4 ("dev builds may set the seed from a hidden field on the menu") arrives with the menu in Phase 5.

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/localMatchService.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  28 passed (28)` and `Tests  216 passed (216)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the local match service

Searching ticks every 250 ms and never finds a real player. Play with
bots seats Mochi, Pip and Juno 420 ms apart on the pieces you didn't
choose, then starts the match worker with two fresh random seeds.
Double presses and a late cancel cannot start a second match.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dev log lines

**Files:**
- Create: `apps/client/src/app/devLog.ts`, `apps/client/test/devLog.test.ts`

**Interfaces:**
- Consumes: the `GameEvent` and `PlayerId` types from `@laddorious/core`.
- Produces: `formatEvent(event: GameEvent, names: ReadonlyMap<PlayerId, string>): string`. It writes one line: the event type (with ` (private)` for a private event), then `key=value` for each field. Strings that are player ids, including inside lists and as record keys, become nicknames, and objects are written as JSON.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/devLog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatEvent } from '../src/app/devLog';

const NAMES = new Map([
  ['p0', 'You'],
  ['p1', 'Mochi'],
]);

describe('formatEvent', () => {
  it('writes the event type, then each field, with player ids as nicknames', () => {
    const line = formatEvent({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false, visibility: 'public' }, NAMES);
    expect(line).toBe('DieRolled player=Mochi natural=4 face=4 forced=false auto=false');
  });

  it('renames ids inside lists and records', () => {
    const line = formatEvent(
      { type: 'ChallengeResolved', challengeId: 'c3', pickRound: 1, picks: { p0: 'rock', p1: null }, winner: 'p0', losers: ['p1'], outcome: 'win', visibility: 'public' },
      NAMES,
    );
    expect(line).toBe('ChallengeResolved challengeId=c3 pickRound=1 picks={"You":"rock","Mochi":null} winner=You losers=["Mochi"] outcome=win');
  });

  it('marks private events', () => {
    const line = formatEvent({ type: 'ChallengePickEcho', challengeId: 'c3', player: 'p0', choice: 'rock', visibility: { private: 'p0' } }, NAMES);
    expect(line).toBe('ChallengePickEcho (private) challengeId=c3 player=You choice=rock');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/devLog.test.ts`
Expected: FAIL with `Failed to resolve import "../src/app/devLog"`.

- [ ] **Step 3: Implement the formatter**

Create `apps/client/src/app/devLog.ts`:

```ts
import type { GameEvent, PlayerId } from '@laddorious/core';

/** One dev-log line: the event type, then each field, with player ids shown as nicknames. */
export function formatEvent(event: GameEvent, names: ReadonlyMap<PlayerId, string>): string {
  const { type, visibility, ...fields } = event;
  const parts = Object.entries(fields).map(([key, value]) => {
    const shown = rename(value, names);
    return `${key}=${typeof shown === 'object' && shown !== null ? JSON.stringify(shown) : String(shown)}`;
  });
  return [visibility === 'public' ? type : `${type} (private)`, ...parts].join(' ');
}

function rename(value: unknown, names: ReadonlyMap<PlayerId, string>): unknown {
  if (typeof value === 'string') return names.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => rename(v, names));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [names.get(k) ?? k, rename(v, names)]));
  }
  return value;
}
```

One generic rule covers all 23 event types and any added later. Player ids `p0`–`p3` can't collide with the engine's other ids (challenges `c…`, effects `e…`, edits `x…`, jumps `j…`, kebab-case card ids).

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/devLog.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  29 passed (29)` and `Tests  219 passed (219)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): format engine events as dev log lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The dev match page, React lint rules and jsdom tests

**Files:**
- Create: `apps/client/src/app/DevMatchPage.tsx`, `apps/client/test/DevMatchPage.test.tsx`
- Modify: `apps/client/package.json` (dependencies, through `pnpm add`), `apps/client/tsconfig.json`, `package.json` (devDependencies, through `pnpm add`), `vitest.config.ts`, `eslint.config.js`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the §4.3 types (Task 2), `formatEvent` (Task 5), `SEATS` and `openingUpdate` (Task 3 fixtures).
- Produces: `PLAY_WITH_BOTS_AFTER_MS = 15_000` and `function DevMatchPage({ service }: { service: MatchService })`. The page's rules:
  - "Find match" searches with the dev profile `{ nickname: 'You', piece: 'knight' }`.
  - "Play with bots" appears once `elapsedMs ≥ 15 000`.
  - On `found` it subscribes to the session in the same tick, and it calls `playbackDone(windowId)` for every update with `timer === null` on an open window (nothing animates yet).
  - It shows a status line (round, window, who is awaited, seconds left), the last 40 log lines and, at the end, the rankings.
  - It calls `pause`/`resume` on `visibilitychange`.
  - "Leave" ends the session and returns to the start.

- [ ] **Step 1: Add React, Testing Library, jsdom and the React lint plugin**

```bash
pnpm --filter @laddorious/client add react@^19.3.0 react-dom@^19.3.0
pnpm --filter @laddorious/client add -D @types/react@^19.3.0 @types/react-dom@^19.3.0 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2
pnpm add -Dw jsdom@^29.1.1 @eslint-react/eslint-plugin@^5.23.5
```

Expected: each completes without errors or peer warnings.

- jsdom is a root devDependency because Vitest loads it from the root. Use jsdom 29: jsdom 30 requires Node ≥ 24.15, and this machine has 24.14.1.
- `@eslint-react/eslint-plugin` replaces `eslint-plugin-react`, which stops at ESLint 9 (this repo uses ESLint 10). Its `recommended-typescript` preset also carries `rules-of-hooks` and `exhaustive-deps`, so it covers both the React rules and the React Hooks rules.

- [ ] **Step 2: Turn on JSX and collect `.tsx` tests**

`apps/client/tsconfig.json`, in `compilerOptions`, add the `jsx` line:

```json
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "jsx": "react-jsx",
    "types": []
  },
```

`vitest.config.ts`, replace the whole file with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
  },
});
```

Component tests choose jsdom with a `// @vitest-environment jsdom` first line, so every other test keeps running in Node.

- [ ] **Step 3: Write the failing component test**

Create `apps/client/test/DevMatchPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevMatchPage, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/DevMatchPage';
import type { Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';

/** Matchmaking the test drives by hand. */
class ScriptedMatchmaking implements Matchmaking {
  private listener: ((s: MatchmakingState) => void) | null = null;
  cancel = vi.fn();
  playWithBots = vi.fn();

  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }

  emit(s: MatchmakingState): void {
    act(() => this.listener?.(s));
  }
}

/** A session the test drives by hand. */
class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private failed: ((e: { message: string }) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {};
  }

  onRejected(): () => void {
    return () => {};
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    this.failed = cb;
    return () => {};
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  fail(message: string): void {
    act(() => this.failed?.({ message }));
  }
}

function startSearch() {
  const matchmaking = new ScriptedMatchmaking();
  const findMatch = vi.fn(() => matchmaking);
  render(<DevMatchPage service={{ findMatch }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Find match' }));
  return { matchmaking, findMatch };
}

function startMatch() {
  const { matchmaking } = startSearch();
  const session = new ScriptedSession();
  matchmaking.emit({ kind: 'found', session });
  return session;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DevMatchPage', () => {
  it('searches with the dev profile and offers Play with bots only after 15 s', () => {
    const { matchmaking, findMatch } = startSearch();
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'You', piece: 'knight' });
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS - 250, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByText('Finding players… 14 s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('logs each update, reports playback at once and counts the window down', () => {
    const session = startMatch();
    const opening = openingUpdate();
    session.update(opening);
    expect(session.playbackDone).toHaveBeenCalledWith(1);
    expect(screen.getByText('Round 1 · dice window · waiting for You, Mochi, Pip, Juno · waiting for playback')).toBeTruthy();

    const roll: GameEvent = { type: 'DieRolled', player: 'p1', natural: 5, face: 5, forced: false, auto: false, visibility: 'public' };
    session.update({ ...opening, events: [roll], timer: { windowId: 1, endsAt: 12_000 } });
    expect(screen.getByText(/DieRolled player=Mochi natural=5/)).toBeTruthy();
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 12 s$/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 7 s$/)).toBeTruthy();
    expect(session.playbackDone).toHaveBeenCalledTimes(1);
  });

  it('shows the final rankings when the match is over', () => {
    const session = startMatch();
    const { view } = openingUpdate();
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.getByText('Round 21 · match over')).toBeTruthy();
    expect(screen.getByText('1. Pip — tile 100')).toBeTruthy();
    expect(screen.getByText('4. Mochi — tile 41')).toBeTruthy();
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('pauses the match while the page is hidden', () => {
    const session = startMatch();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('logs a failed match, and Leave ends the session and returns to the start', () => {
    const session = startMatch();
    session.fail('board corrupted');
    expect(screen.getByText(/FAILED board corrupted/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Find match' })).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/app/DevMatchPage"`. The first jsdom run on a machine can take about 15 s to start; later runs take about 1 s.

- [ ] **Step 5: Implement the page**

Create `apps/client/src/app/DevMatchPage.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, MatchUpdate, Profile, SeatInfo } from '../service/matchService';
import { formatEvent } from './devLog';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;

const PROFILE: Profile = { nickname: 'You', piece: 'knight' };
const LOG_TAIL = 40;

/**
 * Phase 2's dev page: matchmaking, then a bot match shown as a live text log with the
 * window timer and the final rankings. Later phases replace it with the board and the real screens.
 */
export function DevMatchPage({ service }: { service: MatchService }) {
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [mm, setMm] = useState<MatchmakingState | null>(null);
  const [latest, setLatest] = useState<MatchUpdate | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const session = mm?.kind === 'found' ? mm.session : null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // A hidden page pauses the local match (C14).
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  function findMatch() {
    setLatest(null);
    setLog([]);
    const next = service.findMatch(PROFILE);
    setMatchmaking(next);
    next.onState((s) => {
      setMm(s);
      if (s.kind === 'found') watch(s.session);
    });
  }

  function watch(match: MatchSession) {
    const names = new Map(match.seats.map((seat) => [seat.playerId, seat.nickname]));
    const append = (lines: string[]) => setLog((prev) => [...prev, ...lines]);
    match.onUpdate((u) => {
      setNow(Date.now());
      setLatest(u);
      append(u.events.map((e) => formatEvent(e, names)));
      // Nothing animates yet, so playback is done as soon as an update arrives (Phase 3 plays beats first).
      if (u.timer === null && u.view.awaiting.window !== 'none') match.playbackDone(u.view.awaiting.windowId);
    });
    match.onRejected((e) => append([`REJECTED ${e.code}: ${e.message}`]));
    match.onFailed((e) => append([`FAILED ${e.message}`]));
  }

  function leave() {
    session?.leave();
    setMatchmaking(null);
    setMm(null);
  }

  const phase = latest?.view.phase;

  return (
    <main className="dev">
      <h1>LADDORIOUS · dev match</h1>
      {(mm === null || mm.kind === 'cancelled') && (
        <button type="button" className="primary" onClick={findMatch}>
          Find match
        </button>
      )}
      {(mm?.kind === 'searching' || mm?.kind === 'filling') && (
        <section className="plate">
          <p>{mm.kind === 'searching' ? `Finding players… ${Math.floor(mm.elapsedMs / 1000)} s` : 'Bots are taking the open seats…'}</p>
          <Seats seats={mm.seats} />
          {mm.kind === 'searching' && (
            <div className="row">
              <button type="button" onClick={() => matchmaking?.cancel()}>
                Cancel
              </button>
              {mm.elapsedMs >= PLAY_WITH_BOTS_AFTER_MS && (
                <button type="button" className="accent" onClick={() => matchmaking?.playWithBots()}>
                  Play with bots
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {session && (
        <section className="plate">
          <Seats seats={session.seats} />
          {latest && <p className="status">{statusLine(latest, session.seats, now)}</p>}
          {phase?.kind === 'finished' && (
            <ol className="rankings">
              {phase.rankings.map((r) => (
                <li key={r.player}>{`${r.rank}. ${nickname(session.seats, r.player)} — tile ${r.position}`}</li>
              ))}
            </ol>
          )}
          <button type="button" onClick={leave}>
            Leave
          </button>
        </section>
      )}
      {log.length > 0 && <pre className="log">{log.slice(-LOG_TAIL).join('\n')}</pre>}
    </main>
  );
}

function Seats({ seats }: { seats: Array<SeatInfo | null> }) {
  return (
    <ul className="seats">
      {seats.map((seat, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a seat's position is its identity
        <li key={i} className={seat ? undefined : 'open'} style={seat ? { borderColor: seat.color } : undefined}>
          {seat ? `${seat.nickname} · ${seat.piece}${seat.bot ? ' · bot' : ''}` : 'open seat'}
        </li>
      ))}
    </ul>
  );
}

function statusLine(u: MatchUpdate, seats: SeatInfo[], now: number): string {
  const { round, awaiting: aw } = u.view;
  if (aw.window === 'none') return `Round ${round} · match over`;
  const who = aw.players.map((id) => nickname(seats, id)).join(', ');
  const time = u.timer ? `${Math.max(0, Math.ceil((u.timer.endsAt - now) / 1000))} s` : 'waiting for playback';
  return `Round ${round} · ${aw.window} window · waiting for ${who} · ${time}`;
}

function nickname(seats: SeatInfo[], id: PlayerId): string {
  return seats.find((s) => s.playerId === id)?.nickname ?? id;
}
```

Your seat has no controls in this phase (the ROLL button comes in Phase 4, the popups in Phase 5), so the engine's timeouts play it. Your die is rolled when the 12 s dice window expires, and your challenge and card picks are made at random when those windows expire.

- [ ] **Step 6: Run the test again**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 7: Add the React rules, watching them bite first**

`eslint.config.js`: add the import at the top, next to the others:

```js
import eslintReact from '@eslint-react/eslint-plugin';
```

and add this block after the `packages/*/src/**/*.ts` block, before the closing `);`:

```js
  {
    // React and React Hooks rules for the client (spec #2 §3).
    files: ['apps/client/**/*.{ts,tsx}'],
    extends: [eslintReact.configs['recommended-typescript']],
  },
```

Prove the rules bite, then remove the probe:

```bash
cat > apps/client/src/app/LintProbe.tsx <<'EOF'
import { useState } from 'react';

export function LintProbe({ items, on }: { items: string[]; on: boolean }) {
  if (on) useState(0);
  return <ul>{items.map((i) => <li>{i}</li>)}</ul>;
}
EOF
pnpm lint; echo "lint exit $?"
rm apps/client/src/app/LintProbe.tsx
```

Expected: lint reports `LintProbe.tsx` with `@eslint-react/rules-of-hooks` ("React Hook "useState" is called conditionally") and `@eslint-react/no-missing-key` ("Missing 'key' for element when rendering list"), and exits non-zero.

Run: `pnpm lint`
Expected: no errors and no warnings.

- [ ] **Step 8: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  30 passed (30)` and `Tests  224 passed (224)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 9: Commit**

```bash
git add apps/client package.json pnpm-lock.yaml vitest.config.ts eslint.config.js
git commit -m "feat(client): add the dev match page with React lint rules and jsdom tests

The dev page runs matchmaking and shows a match as a live log with the
window timer and the final rankings. React and React Hooks rules come
from @eslint-react (eslint-plugin-react stops at ESLint 9); component
tests run in jsdom (spec #2 §3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Run it in the browser: Vite, `pnpm dev` and `pnpm build`

**Files:**
- Create: `apps/client/vite.config.ts`, `apps/client/index.html`, `apps/client/src/main.tsx`, `apps/client/src/app/theme.css`, `apps/client/src/app/dev.css`
- Modify: `apps/client/package.json` (scripts; dependencies through `pnpm add`), `apps/client/tsconfig.json`, `package.json` (scripts), `README.md`, `pnpm-lock.yaml`
- Local only (not committed): `.claude/launch.json`, the preview pane's server list

**Interfaces:**
- Consumes: `DevMatchPage` (Task 6), `LocalMatchService` (Task 4), `host.worker.ts` (Task 3).
- Produces: `pnpm dev` (dev server on http://localhost:5173), `pnpm build` (static files in `apps/client/dist`), and the §7.4 HUD tokens as CSS custom properties: `--sky-top`, `--sky-mid`, `--sky-horizon`, `--ink`, `--plate`, `--paper`, `--paper-alt`, `--muted-on-paper`, `--muted-on-plate`, `--highlight`, `--primary`, `--primary-hover`, `--accent`, `--panel-header`, `--backdrop-light`, `--backdrop-dark`.

- [ ] **Step 1: Add Vite**

```bash
pnpm --filter @laddorious/client add -D vite@^8.3.2 @vitejs/plugin-react@^6.1.1
```

Expected: completes without errors or peer warnings.

- [ ] **Step 2: Write the app entry, the tokens and the page styles**

Create `apps/client/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});
```

Create `apps/client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Laddorious</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/client/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DevMatchPage } from './app/DevMatchPage';
import './app/theme.css';
import './app/dev.css';
import { LocalMatchService } from './service/localMatchService';

const service = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevMatchPage service={service} />
  </StrictMode>,
);
```

Create `apps/client/src/app/theme.css`:

```css
/* Tangerine Dusk HUD tokens (spec #2 §7.4). Colours used from TypeScript live in theme.ts. */
:root {
  --sky-top: #0b4a5a;
  --sky-mid: #2f8f8a;
  --sky-horizon: #ffc184;
  --ink: #0f2e36;
  --plate: rgba(9, 38, 45, 0.86);
  --paper: #fff7ec;
  --paper-alt: #e2f3ee;
  --muted-on-paper: #46707a;
  --muted-on-plate: #a8d0d2;
  --highlight: #5ff0c5;
  --primary: #ff7a1a;
  --primary-hover: #ff9140;
  --accent: #ff5470;
  --panel-header: #147676;
  --backdrop-light: rgba(5, 30, 36, 0.5);
  --backdrop-dark: rgba(5, 30, 36, 0.86);
}
```

The fog, board and podium colours of §7.4 belong to the 3D world, so they join `theme.ts` in Phase 4. Lilita One and Fredoka load with the real screens in Phase 5.

Create `apps/client/src/app/dev.css`:

```css
/* Phase 2 dev page. Every colour is a theme.css token. */
body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(var(--sky-top), var(--sky-mid) 60%, var(--sky-horizon));
  color: var(--paper);
  font-family: system-ui, sans-serif;
}

.dev {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}

.dev button {
  min-height: 44px;
  padding: 0 18px;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.dev button.primary {
  background: var(--primary);
}

.dev button.primary:hover {
  background: var(--primary-hover);
}

.dev button.accent {
  background: var(--accent);
}

.plate,
.log {
  margin: 12px 0;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--plate);
}

.row {
  display: flex;
  gap: 12px;
}

.seats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  list-style: none;
}

.seats li {
  padding: 6px 12px;
  border: 3px solid var(--highlight);
  border-radius: 10px;
}

.seats li.open {
  border-style: dashed;
  border-color: var(--muted-on-plate);
  color: var(--muted-on-plate);
}

.status {
  color: var(--highlight);
  font-weight: 700;
}

.rankings {
  padding-left: 0;
  list-style: none;
  font-size: 1.2em;
}

.log {
  overflow-x: auto;
  color: var(--muted-on-plate);
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 3: Typecheck, and watch the CSS imports fail**

Run: `pnpm typecheck`
Expected: FAIL in `apps/client` with `error TS2882: Cannot find module or type declarations for side-effect import of './app/theme.css'` (and the same for `./app/dev.css`). TypeScript 6 checks side-effect imports, and only Vite's client types declare `*.css`.

- [ ] **Step 4: Give the client Vite's types**

`apps/client/tsconfig.json`, replace the whole file with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "test"]
}
```

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Add the scripts**

`apps/client/package.json`, add after `"type": "module",`:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
```

`package.json`, in `scripts`, add after the `sim` line (add a comma to it):

```json
    "dev": "pnpm --filter @laddorious/client dev",
    "build": "pnpm --filter @laddorious/client build"
```

- [ ] **Step 6: Build, and check the engine stays in the worker**

Run: `pnpm build`
Expected: `✓ built`, with `dist/index.html`, `dist/assets/host.worker-*.js` (about 48 kB: the engine and the bots), `dist/assets/index-*.css` and `dist/assets/index-*.js` (about 226 kB).

Run: `grep -l "a match needs 2-4 players" apps/client/dist/assets/*.js`
Expected: only the `host.worker-*.js` file. The page bundle imports nothing but types from the engine.

- [ ] **Step 7: Run a full match in the browser**

`.claude/launch.json` (local preview config, not committed) holds:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "client", "runtimeExecutable": "pnpm", "runtimeArgs": ["dev"], "port": 5173 },
    { "name": "client-build", "runtimeExecutable": "pnpm", "runtimeArgs": ["--filter", "@laddorious/client", "preview"], "port": 4173 }
  ]
}
```

Start `client` with the preview tool and open http://localhost:5173. Then:

1. Press **Find match**. Expected: "Finding players… n s" counting up, with "You · knight" and three dashed open seats.
2. At 15 s, **Play with bots** appears. Press it. Expected: Mochi · pawn, Pip · meeple and Juno · dragon fill the seats one by one, with blue, lime and violet borders. Then the status line reads `Round 1 · dice window · waiting for …` and the log starts.
3. Watch a few rounds. Expected: the bots roll within about 2.5 s, your die rolls itself when the 12 s window expires (`auto=true`), and the countdown ticks. Challenge and Mystery windows come and go. No bot's `MysteryOffered` line ever appears, only their windows and `CardSelected`.
4. Check that a hidden page pauses the match. In the browser console run:

   ```js
   window.__hidden = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden }); document.dispatchEvent(new Event('visibilitychange'));
   ```

   Wait 20 s. Expected: the round and window don't change, even after your countdown runs out. Then run:

   ```js
   window.__hidden = false; document.dispatchEvent(new Event('visibilitychange'));
   ```

   Expected: the status shows the seconds that were left, and the match goes on. The browser pane keeps background tabs "visible", so switching tabs there doesn't test this. In a normal browser, switching tabs does.
5. Let the match finish. A median match is 20 rounds, about 6 minutes with your seat on timeouts; 30 rounds take about 10. Expected: `Round n · match over` and four ranking lines `1. … — tile 100` through `4. …`.
6. The console shows no errors.

Then stop `client` and start `client-build` (serves `apps/client/dist`). Open http://localhost:4173 and repeat 1–2. Expected: the match starts and reaches round 2. This shows the bundled worker loads.

- [ ] **Step 8: Update the README**

`README.md`:

- Replace the paragraph that starts "This repository currently holds" with:

  ```markdown
  This repository holds **sub-project 1** — the deterministic rules engine, the seeded board generator and a headless simulator ([design](docs/superpowers/specs/2026-10-03-game-core-design.md)) — and the web client being built from [Spec #2](docs/superpowers/specs/2026-10-04-3d-client-design.md). The server comes later.
  ```

- Add this row to the package table, after the `apps/sim` row:

  ```markdown
  | `apps/client` | `@laddorious/client` | The web client (Vite + React). For now a dev page that runs a bot match through the local match service and the Web Worker host. |
  ```

- In the `## Commands` block, add after `pnpm lint`:

  ```bash
  pnpm dev         # client dev server on http://localhost:5173
  pnpm build       # client production build into apps/client/dist
  ```

- [ ] **Step 9: Run the full gate**

Run: `pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -5`
Expected: no typecheck or lint errors; `Test Files  30 passed (30)` and `Tests  224 passed (224)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 10: Commit**

```bash
git add apps/client package.json pnpm-lock.yaml README.md
git commit -m "feat(client): serve the dev page with Vite: pnpm dev and pnpm build

The page runs in Tangerine Dusk (spec #2 §7.4 HUD tokens) and starts
the match host as a module Web Worker. The engine and the bots are
bundled only into the worker chunk.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Phase gate and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Local only: the project memory `handoff.md` (outside the repository)

**Interfaces:**
- Consumes: everything above.
- Produces: a handoff note that points the next session at Phase 3.

- [ ] **Step 1: Run the whole gate from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -5
pnpm build 2>&1 | tail -3
git status --short
```

Expected: no errors; `Test Files  30 passed (30)` and `Tests  224 passed (224)`; `✓ built`. `git status` shows only `.claude/` untracked.

- [ ] **Step 2: Update the handoff note**

Run: `git log --oneline main..client/phase-2`
Expected: the plan commit and the seven task commits, newest first. Use their short hashes below.

Make these edits in `docs/superpowers/HANDOFF.md`:

1. Replace the title line with `# Handoff — 3D client, after Phase 2`.
2. Replace the `**Keep it current:**` line with: `**Keep it current:** when Phase 3 starts, update the "Where things stand" and "Next step" sections or delete this file.`
3. Replace the Phase 2 row of the "Where things stand" table with the line below, where `HASHES` stands for the eight short hashes from the log, oldest first, each in backticks and comma-separated, as in the Phase 1 row:

   ```markdown
   | **Phase 2** (client scaffold, local host, match service): **done on `client/phase-2`**; merging is the user's call | `docs/superpowers/plans/2026-10-04-client-phase-2-local-match.md`; commits HASHES |
   ```

4. Replace the paragraph that starts "After Phase 1 the full suite" with:

   ```markdown
   After Phase 2 the full suite is 30 test files, 224 tests, all passing. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean. There is no git remote.
   ```
5. Replace everything from the `## Next step: Phase 2` heading down to (not including) `## How this user works (follow these)` with:

   ```markdown
   ## Next step: Phase 3

   **Phase 3: director and presentation state.** Spec sections: §5.1 (beats), §5.2 (presentation state).

   **It ends with:** the dev page plays each update as a beat timeline (text and a flat 2D board), calls `playbackDone` when the timeline ends, and the host's timers wait for it.

   How to run it, the same way as Phase 2:

   1. Once the user has merged Phase 2, create `client/phase-3` from `main`.
   2. Use the `superpowers:writing-plans` skill to write `docs/superpowers/plans/<that day's date>-client-phase-3-<name>.md` against the code as it is then, in the Phase 2 plan's format. When the plan relies on new tooling, dry-run it in a scratch copy first.
   3. Show the plan to the user and **wait for approval before writing code**.
   4. Execute it with `superpowers:executing-plans`, **inline** (no subagents). TDD on every step. Commit at the end of every task.
   5. Finish with a self-review of the whole branch (say that it was a self-review), then `superpowers:finishing-a-development-branch`.

   What Phase 2 left for Phase 3:

   - `DevMatchPage.watch()` in `apps/client/src/app/DevMatchPage.tsx` is where updates arrive. Today it calls `playbackDone` at once; the director goes in between.
   - `createMatch` drops round 1's opening events, so the first update has `events: []`. The director takes round 1 from the view.
   - The director is plain TypeScript in `src/director/` (spec §4.1). Zustand arrives with the first store that needs it.
   - An update can arrive while a timeline plays: it queues, and more than 3 queued updates fast-forward to the latest view (§5.2).
   ```

6. In "Repository facts", replace the `**Layout:**` line with:

   ```markdown
   - **Layout:** `apps/` holds deployables (`sim`, `client`, and `server` in Spec #3); `packages/` holds libraries (`core`, `bots`).
   ```

   and the `**Commands:**` line with:

   ```markdown
   - **Commands:** `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm dev` (client on http://localhost:5173), `pnpm build` (into `apps/client/dist`), `pnpm sim board --seed <s>`, `pnpm sim run …`, `pnpm sim replay <log>`.
   ```

   and add this bullet after the `**Bots**` bullet:

   ```markdown
   - **Client tests and lint:** component tests start with `// @vitest-environment jsdom`; every other test runs in Node. React and React Hooks rules come from `@eslint-react/eslint-plugin` (`eslint-plugin-react` stops at ESLint 9). jsdom stays on 29 while this machine's Node is 24.14 (jsdom 30 needs 24.15). The local, untracked `.claude/launch.json` has `client` (dev server) and `client-build` (serves `dist`) entries for the preview pane.
   ```

The Blender line in "Open items" was already updated when this plan was written; leave it.

- [ ] **Step 3: Delete the execution ledger**

Run: `rm -rf .superpowers/sdd/2026-10-04-client-phase-2-local-match`
Expected: the folder is gone. It was scratch, and git ignores it.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: hand off after phase 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Update the project memory**

In `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\memory\handoff.md`, replace the paragraph that starts "State on 2026-10-04" with the text below. Keep the **Why** and **How to apply** lines.

```markdown
State after Phase 2 (2026-10-04): Phases 1 and 2 are done. Phase 2 (client scaffold, local host, match service) is on `client/phase-2`, and merging it is the user's call. The next step is Phase 3 (director and presentation state): write its plan with superpowers:writing-plans on a new branch from `main`, get the user's approval, then execute inline.
```

After Task 8: self-review the whole branch (`git diff main...client/phase-2`) against the spec sections and this plan's Review Focus, and say that it was a self-review. Then follow superpowers:finishing-a-development-branch, and ask the user before merging.
