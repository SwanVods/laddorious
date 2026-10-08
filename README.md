# Laddorious

An online Snakes & Ladders party game for 4 players:

- **Simultaneous rounds:** everyone rolls one die at the same time.
- **Collisions:** players who land on the same square settle it in a face-off. Two players play Rock, Paper, Scissors; three or four play Minority, where the odd one out wins.
- **Mystery cards:** purple "?" squares offer cards that move, shield or attack.
- **Boards:** every board is generated from a seed.

This repository holds:

- **Spec #1:** the deterministic rules engine, the seeded board generator and a headless simulator ([design](docs/superpowers/specs/2026-10-03-game-core-design.md)).
- **Spec #2:** the 3D web client, with the main menu, matchmaking, a full match against bots and the end screen ([design](docs/superpowers/specs/2026-10-04-3d-client-design.md)).

The multiplayer server (Spec #3) and the art pass (Spec #4) come later.

## Repository map

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor`, plus the board generator. No clock, no unseeded randomness: a match replays exactly from its config, seed and inputs. [README](packages/core/README.md) |
| `packages/bots` | `@laddorious/bots` | Random and heuristic bots that play from a player's view. Browser-safe; used by the simulator and the client, and later the server. [README](packages/bots/README.md) |
| `apps/sim` | `@laddorious/sim` | Batch runner, metrics and the `sim` CLI. |
| `apps/client` | `@laddorious/client` | The web client (Vite, React, React Three Fiber): the main menu, matchmaking, a 4-player match against the simulator's bots in 3D with the full HUD, and the end screen. The engine and bots run in a Web Worker behind the `MatchService` interface. [README](apps/client/README.md) |

Libraries live in `packages/` and deployable apps in `apps/`.

## Setup

You need Node 24 or newer and pnpm 11. The root `package.json` pins `pnpm@11.5.0`; `corepack enable` installs it.

```bash
corepack enable
pnpm install
```

pnpm refuses dependency releases younger than a day (a supply-chain guard set in `pnpm-workspace.yaml`). If an install says a version is too new, use the previous release or wait a day.

## Scripts

```bash
pnpm test        # unit, property, golden and component tests (Vitest)
pnpm typecheck   # every package, the client and the e2e tests
pnpm lint        # ESLint, including the engine's determinism rules
pnpm dev         # the client's dev server on http://localhost:5173
pnpm build       # the client's production build into apps/client/dist
pnpm e2e         # Playwright end-to-end tests (see apps/client/README.md)

pnpm sim board --seed daily-2026-10-03                   # print a generated board and its analysis
pnpm sim run --matches 1000 --players 4 --policy heuristic --out report.json --log match0.json
pnpm sim replay match0.json                               # check a recorded match replays to the same hash
```

`pnpm sim run` also takes `--seed <base>` and `--afk <percent>` (bots that sit out whole windows).

## How the parts fit together

- **`@laddorious/core`** is a pure state machine. A host feeds it inputs (rolls, picks, timeouts) and gets back the new state and the events that happened. All randomness comes from seeded streams stored in the state.
- **`@laddorious/bots`** decides what a seat would do, looking only at `viewFor(state, seat)`.
- **The simulator** runs thousands of bot matches to measure match length, fairness and card balance.
- **The client** runs the engine and the bots in a Web Worker. The worker's host owns the timers, and the screens talk to it through the `MatchService` interface.

**The visibility rule:** the client only ever receives what a remote player would, which is `viewFor(state, me)` and `eventsFor(events, me)`. Other players' hands, picks and card targets, and the secret RNG seed, never reach the main thread. That is what lets the Spec #3 server replace the local worker without changing the screens.

## Changing the rules safely

1. **Engine tests** (`packages/core/test`) cover each rule, with property tests (fast-check) for invariants such as no lost players and no mutated inputs.
2. **Golden matches** (`packages/core/test/golden.test.ts`) snapshot whole seeded matches: rounds, winner, event counts and a state hash. Any change to rules, RNG use or event shapes shows up as a snapshot diff. Update the snapshots only for intended changes, and read the diff first:

   ```bash
   pnpm vitest run packages/core/test/golden.test.ts -u
   ```

3. **The simulator** shows what a rule change does to the game: compare `pnpm sim run` reports before and after (match length, comeback rate, card win rates).
4. **The client's director test** plays a whole real match through the client's playback layer and fails if what it shows drifts from the engine's view.

## CI

GitHub Actions (`.github/workflows/ci.yml`):

- a `check` job runs typecheck, lint, test and the client build;
- an `e2e` job installs Playwright's Chromium and runs `pnpm e2e`, uploading traces when it fails.

## Specs, plans and handoff

- Designs: `docs/superpowers/specs/`.
- Phase plans: `docs/superpowers/plans/`. The client was built in six phases; see `2026-10-04-3d-client-phases.md`.
- Where things stand and what's next: `docs/superpowers/HANDOFF.md`.
