# Phase 1 — Repository Restructure and Bots Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** Split the repository into deployable `apps/` and shared `packages/`. The simulator moves to `apps/sim`, and the bots move into a new browser-safe `@laddorious/bots` package that the client and future server can share.

**Architecture:** A pure move-and-extract refactor with no behaviour change. `packages/sim` becomes `apps/sim`. `bots.ts` and its tests move to `packages/bots`, and the simulator imports them from `@laddorious/bots`. An ESLint rule keeps every `packages/*` library free of Node built-ins, so it can run in a browser.

**Tech Stack:** pnpm workspaces (pnpm 11.5), TypeScript (strict, `tsconfig.base.json`), Vitest, ESLint flat config, Node ≥ 24.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md` (§3 Repository layout, decisions C5 and C6). Phase index: `docs/superpowers/plans/2026-10-04-3d-client-phases.md`.

## Global Constraints

- `apps/` holds deployables (`client`, `sim`, later `server`); `packages/` holds libraries (`core`, `bots`).
- `RandomBot`, `HeuristicBot`, `makeBots` and `scoreCard` move from `sim` into `@laddorious/bots` unchanged.
- Root scripts keep working: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm sim …`.
- `packages/core` keeps its determinism lint rules (no `Date`, `performance`, `Math.random`).
- Libraries in `packages/*` must not import Node built-ins (`node:*`).
- CI runs `pnpm install --frozen-lockfile`, so `pnpm-lock.yaml` changes must be committed.
- Commit messages end with two trailer lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01QHRaSykaop3Xu5guUaBYw4`
- Run every command from the repository root `E:\AI Project\laddorious`, on branch `client/spec-2`.

## Review Focus

1. **Moved tests silently stop running.** If Vitest's include pattern misses `apps/*`, the suite still passes, just with fewer tests. Pinned by checking exact counts (Task 1: 23 files and 178 tests; Task 2: 24 files and 180 tests).
2. **CI fails on the lockfile.** Moving and adding workspace packages changes `pnpm-lock.yaml`. Pinned by `pnpm install --frozen-lockfile` succeeding after each commit.
3. **`pnpm sim` points at the old path.** Pinned by running `pnpm sim board` and `pnpm sim run` in Task 1 and Task 2.
4. **A Node import sneaks into a library and breaks the browser build.** Pinned by the ESLint rule in Task 2, which is first seen failing on a throwaway `node:fs` import.
5. **Leftovers in `packages/`.** A stale `packages/sim` folder would confuse the workspace. Pinned by listing `packages/` in Task 1.

---

### Task 1: Move the simulator to `apps/sim`

**Files:**
- Move: `packages/sim/` → `apps/sim/` (with `git mv`)
- Modify: `pnpm-workspace.yaml`, `package.json` (scripts), `vitest.config.ts`, `README.md` (package table), `pnpm-lock.yaml` (regenerated)

**Interfaces:**
- Consumes: nothing new.
- Produces: the simulator at `apps/sim` (package name `@laddorious/sim`, unchanged). The workspace now globs `apps/*` and `packages/*`. Vitest includes `apps/*/test/**/*.test.ts`.

- [ ] **Step 1: Record the baseline**

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  23 passed (23)` and `Tests  178 passed (178)`.

- [ ] **Step 2: Move the package**

```bash
mkdir -p apps
git mv packages/sim apps/sim
ls packages apps
```

Expected: `packages` lists only `core`; `apps` lists `sim`.

`apps/sim/tsconfig.json` extends `../../tsconfig.base.json`, which is still the right relative path from `apps/sim`, so it needs no change.

- [ ] **Step 3: Run the tests to see the pattern miss the moved files**

Run: `pnpm test 2>&1 | tail -5`
Expected: the run passes but reports fewer files and tests than the baseline (the four `sim` test files are no longer included). This is the silent failure the next step fixes.

- [ ] **Step 4: Point the workspace, scripts and Vitest at `apps/*`**

`pnpm-workspace.yaml`: change the `packages:` list to

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

and leave the other keys (`allowBuilds`, `minimumReleaseAgeExclude`) as they are.

`package.json`, in `scripts`:

```json
    "typecheck": "tsc -p packages/core && tsc -p apps/sim",
    "sim": "tsx apps/sim/src/bin.ts"
```

(`test` and `lint` stay as they are.)

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

`README.md`, replace the `## Packages` table with:

```markdown
## Packages

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`. No clock, no unseeded randomness — a match replays exactly from its config, seed and inputs. |
| `apps/sim` | `@laddorious/sim` | Bots, batch runner, metrics and the `sim` CLI. |

Libraries live in `packages/`, deployable apps in `apps/`.
```

- [ ] **Step 5: Re-link the workspace and regenerate the lockfile**

Run: `pnpm install`
Expected: completes without errors; `git status --short pnpm-lock.yaml` shows it modified (the importer path changed from `packages/sim` to `apps/sim`).

- [ ] **Step 6: Run the full gate and the CLI**

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  23 passed (23)` and `Tests  178 passed (178)` (back to the baseline).

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm sim board --seed daily-2026-10-04 | tail -2`
Expected: an `Attempts:` line and a `Median first finish:` line.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors (what CI runs).

- [ ] **Step 7: Commit**

```bash
git add -A apps packages pnpm-workspace.yaml package.json vitest.config.ts README.md pnpm-lock.yaml
git commit -m "refactor: move the simulator to apps/sim

Deployable apps now live in apps/, libraries in packages/ (spec #2 §3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QHRaSykaop3Xu5guUaBYw4"
```

---

### Task 2: Extract the bots into `@laddorious/bots`

**Files:**
- Create: `packages/bots/package.json`, `packages/bots/tsconfig.json`, `packages/bots/src/index.ts`, `packages/bots/test/index.test.ts`
- Move: `apps/sim/src/bots.ts` → `packages/bots/src/bots.ts`; `apps/sim/test/bots.test.ts` → `packages/bots/test/bots.test.ts` (with `git mv`)
- Modify: `apps/sim/package.json`, `apps/sim/src/index.ts`, `apps/sim/src/batch.ts:2`, `apps/sim/src/cli.ts:5`, `apps/sim/src/runner.ts:15`, `apps/sim/test/metrics.test.ts:3`, `apps/sim/test/runner.test.ts:2`, `package.json` (typecheck script), `eslint.config.js`, `README.md` (package table), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 1's `apps/*` workspace glob and Vitest include.
- Produces: package `@laddorious/bots` exporting `Bot` (interface), `RandomBot`, `HeuristicBot`, `scoreCard(card: CardDef, view: PlayerView): number`, `PolicyName = 'random' | 'heuristic'` and `makeBots(seats: PlayerSeat[], policy: PolicyName, seed: string, afkPercent: number): Record<string, Bot>`. Phases 2 and later import these from `@laddorious/bots`.

- [ ] **Step 1: Write the failing entry-point test**

Create `packages/bots/test/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMatch, viewFor } from '@laddorious/core';
import * as bots from '../src/index';

describe('@laddorious/bots entry point', () => {
  it('exposes both policies, the factory and the card scorer', () => {
    expect(Object.keys(bots).sort()).toEqual(['HeuristicBot', 'RandomBot', 'makeBots', 'scoreCard']);
  });

  it('makes one bot per seat that acts on a real player view', () => {
    const seats = [{ id: 'p1' }, { id: 'p2' }];
    const made = bots.makeBots(seats, 'heuristic', 'seed', 0);
    expect(Object.keys(made)).toEqual(['p1', 'p2']);
    const s = createMatch({ seed: 'b' }, seats);
    expect(made['p1']!.decide(viewFor(s, 'p1'))).toEqual({ type: 'roll', player: 'p1', windowId: 1 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/bots/test/index.test.ts`
Expected: FAIL with a "Failed to resolve import" error for `../src/index` (the package source doesn't exist yet).

- [ ] **Step 3: Create the package and move the code**

```bash
mkdir -p packages/bots/src
git mv apps/sim/src/bots.ts packages/bots/src/bots.ts
git mv apps/sim/test/bots.test.ts packages/bots/test/bots.test.ts
```

Create `packages/bots/package.json`:

```json
{
  "name": "@laddorious/bots",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@laddorious/core": "workspace:*"
  }
}
```

Create `packages/bots/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Create `packages/bots/src/index.ts`:

```ts
export * from './bots';
```

In `packages/bots/test/bots.test.ts`, change the import line
`import { HeuristicBot, RandomBot, makeBots, scoreCard } from '../src/bots';`
to
`import { HeuristicBot, RandomBot, makeBots, scoreCard } from '../src/index';`.

- [ ] **Step 4: Point the simulator at the new package**

`apps/sim/package.json`, replace `dependencies` with:

```json
  "dependencies": {
    "@laddorious/bots": "workspace:*",
    "@laddorious/core": "workspace:*"
  }
```

`apps/sim/src/index.ts`, replace the whole file with:

```ts
export * from './runner';
export * from './metrics';
export * from './batch';
```

Change these import lines:
- `apps/sim/src/batch.ts:2`: `import { makeBots, type PolicyName } from './bots';` → `import { makeBots, type PolicyName } from '@laddorious/bots';`
- `apps/sim/src/cli.ts:5`: `import type { PolicyName } from './bots';` → `import type { PolicyName } from '@laddorious/bots';`
- `apps/sim/src/runner.ts:15`: `import type { Bot } from './bots';` → `import type { Bot } from '@laddorious/bots';`
- `apps/sim/test/metrics.test.ts:3`: `import { makeBots } from '../src/bots';` → `import { makeBots } from '@laddorious/bots';`
- `apps/sim/test/runner.test.ts:2`: `import { makeBots } from '../src/bots';` → `import { makeBots } from '@laddorious/bots';`

`package.json`, in `scripts`:

```json
    "typecheck": "tsc -p packages/core && tsc -p packages/bots && tsc -p apps/sim",
```

Then link the new package: `pnpm install`
Expected: completes without errors; `pnpm-lock.yaml` gains a `packages/bots` importer.

- [ ] **Step 5: Run the entry-point test and the whole suite**

Run: `pnpm vitest run packages/bots/test`
Expected: PASS, both files (`index.test.ts` and `bots.test.ts`).

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  24 passed (24)` and `Tests  180 passed (180)` (the baseline plus the new file's 2 tests; `bots.test.ts` moved, not added).

- [ ] **Step 6: Guard the libraries against Node imports, watching the rule fail first**

Add this block to `eslint.config.js`, after the existing `packages/core/src/**/*.ts` block and before the closing `);`:

```js
  {
    // Libraries must run in browsers and on the server alike: no Node built-ins (spec #2 C6).
    files: ['packages/*/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'packages/* must stay browser-safe: no Node built-ins' }] },
      ],
    },
  },
```

Prove the rule bites, then remove the probe:

```bash
printf "import { readFileSync } from 'node:fs';\nexport const probe = readFileSync;\n" > packages/bots/src/probe.ts
pnpm lint; echo "lint exit $?"
rm packages/bots/src/probe.ts
```

Expected: lint reports `packages/bots/src/probe.ts` with "packages/* must stay browser-safe: no Node built-ins" and exits non-zero.

Run: `pnpm lint`
Expected: no errors (the probe is gone; `apps/sim` may keep using `node:fs`).

- [ ] **Step 7: Update the README table and run the full gate**

`README.md`, replace the package table rows with:

```markdown
| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`. No clock, no unseeded randomness — a match replays exactly from its config, seed and inputs. |
| `packages/bots` | `@laddorious/bots` | Random and heuristic bots that play from a player's view. Browser-safe; shared by the simulator, and later the client and server. |
| `apps/sim` | `@laddorious/sim` | Batch runner, metrics and the `sim` CLI. |
```

Run: `pnpm typecheck && pnpm lint && pnpm test 2>&1 | tail -3`
Expected: no typecheck or lint errors; `Tests  180 passed (180)`.

Run: `pnpm sim run --matches 20 --players 4 --policy heuristic --seed phase1 | head -3`
Expected: `Matches:              20` followed by the rounds and minutes lines.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 8: Commit**

```bash
git add -A packages apps package.json eslint.config.js README.md pnpm-lock.yaml
git commit -m "refactor: extract the bots into @laddorious/bots

RandomBot, HeuristicBot, makeBots and scoreCard move out of the
simulator into a browser-safe library the client and server can share
(spec #2 C6). A lint rule keeps packages/* free of Node built-ins.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QHRaSykaop3Xu5guUaBYw4"
```
