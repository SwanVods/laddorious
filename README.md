# Laddorious

An online Snakes & Ladders party game for 4 players:

- **Simultaneous rounds:** everyone rolls one die at the same time.
- **Collisions:** players who land on the same square settle it in a face-off. Two players play Rock, Paper, Scissors; three or four play Minority, where the odd one out wins.
- **Mystery cards:** purple "?" squares offer cards that move, shield or attack.
- **Boards:** every board is generated from a seed.

This repository holds:

- **Spec #1:** the deterministic rules engine, the seeded board generator and a headless simulator ([design](docs/superpowers/specs/2026-10-03-game-core-design.md)).
- **Spec #2:** the 3D web client, with the main menu, matchmaking, a full match against bots and the end screen ([design](docs/superpowers/specs/2026-10-04-3d-client-design.md)).
- **Spec #3:** sound design. Every sound effect and both music loops are made in code with Tone.js, with mute and volume settings ([design](docs/superpowers/specs/2026-10-09-sound-design.md)).
- **Spec #4:** the multiplayer server. Quick match with real players, bots on request, and rejoining within 60 s, on Cloudflare Workers and Durable Objects ([design](docs/superpowers/specs/2026-10-09-multiplayer-server-design.md)).
- **Spec #5 (in progress):** the art pass, Blender models for the pieces, the board and the world ([design](docs/superpowers/specs/2026-10-09-art-pass-design.md)).

## Repository map

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor`, plus the board generator. No clock, no unseeded randomness: a match replays exactly from its config, seed and inputs. [README](packages/core/README.md) |
| `packages/bots` | `@laddorious/bots` | Random and heuristic bots that play from a player's view. Browser-safe; used by the simulator and the client, and later the server. [README](packages/bots/README.md) |
| `packages/host` | `@laddorious/host` | The match host: one match's engine state, timers and bots for any mix of humans and bots, plus the wire protocol. The offline worker and the server both run it. [README](packages/host/README.md) |
| `apps/sim` | `@laddorious/sim` | Batch runner, metrics and the `sim` CLI. |
| `apps/client` | `@laddorious/client` | The web client (Vite, React, React Three Fiber): the main menu, matchmaking, a 4-player match against the simulator's bots in 3D with the full HUD, and the end screen. The engine runs in a Web Worker behind the `MatchService` interface, or on the server when `VITE_SERVER` is set. [README](apps/client/README.md) |
| `apps/server` | `@laddorious/server` | The multiplayer server: a Cloudflare Worker with a lobby and one Durable Object per match. It also serves the built game. [README](apps/server/README.md) |
| `art/` | — | The Blender build scripts for the game's 3D models, and their contract tests. [README](art/README.md) |

Libraries live in `packages/` and deployable apps in `apps/`.

## Setup

You need Node 24 or newer and pnpm 11. The root `package.json` pins `pnpm@11.5.0`; `corepack enable` installs it.

```bash
corepack enable
pnpm install
```

pnpm 11 refuses dependency releases younger than a day by default, as a supply-chain guard. If an install says a version is too new, use the previous release or wait a day. `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` lists the few exceptions.

## Scripts

```bash
pnpm test        # unit, property, golden and component tests (Vitest)
pnpm typecheck   # every package, the client and the e2e tests
pnpm lint        # ESLint, including the engine's determinism rules
pnpm dev         # the client's dev server on http://localhost:5173
pnpm build       # the client's production build into apps/client/dist
pnpm serve       # play on your Wi-Fi: the game and server on port 8787 (see apps/server/README.md)
pnpm dev:online  # the dev server against a local multiplayer server
pnpm deploy:cloudflare  # build and deploy to Cloudflare (needs `wrangler login`; see apps/server/README.md)
pnpm e2e         # Playwright end-to-end tests (see apps/client/README.md)
pnpm art         # rebuild the Blender models (needs Blender 5.2; see art/README.md)
pnpm shots       # screenshots of the menu and a match, for reviewing models
pnpm cards       # the card editor, local only (see Cards below)

pnpm sim board --seed daily-2026-10-03                   # print a generated board and its analysis
pnpm sim run --matches 1000 --players 4 --policy heuristic --out report.json --log match0.json
pnpm sim replay match0.json                               # check a recorded match replays to the same hash
```

`pnpm sim run` also takes `--seed <base>` and `--afk <percent>`. With `--afk`, random bots sit out that share of windows to exercise timeouts; heuristic bots ignore it.

## How the parts fit together

- **`@laddorious/core`** is a pure state machine. A host feeds it inputs (rolls, picks, timeouts) and gets back the new state and the events that happened. All randomness comes from seeded streams stored in the state.
- **`@laddorious/bots`** decides what a seat would do, looking only at `viewFor(state, seat)`.
- **The simulator** runs thousands of bot matches to measure match length, fairness and card balance.
- **`@laddorious/host`** runs one match: it feeds the engine bot moves, timeouts and players' actions, and sends each human only their own view.
- **The client** runs the host in a Web Worker for offline play, or talks to **the server** (a Cloudflare Worker running the same host) for online play, through the `MatchService` interface.

**The visibility rule:** the client only ever receives what a remote player would, which is `viewFor(state, me)` and `eventsFor(events, me)`. Other players' hands, picks and card targets, and the secret RNG seed, never reach the main thread. That is why the Spec #4 server could replace the local worker without changing the screens.

## Cards

Every card lives in `packages/core/src/cards/cards.json`. Edit it with the card editor:

1. `pnpm cards` opens the editor in your browser (local only; it is never deployed).
2. Pick a card to change its numbers, rarity, type, who it hits, its steps, or switch it on or off. The card's text writes itself from its steps; the preview shows it. Problems show in red and block Save.
3. Save writes the card file. Check the change with `git diff`, try it with `pnpm dev` (reload the game's tab) or `pnpm serve`, commit, then deploy (`pnpm deploy:cloudflare`).

Values like "1–6" are picked when a match starts, the same for everyone that match. A card that needs something the engine can't do yet is a **draft**: write its plan in plain words, leave it as a draft, and ask for the building block. Drafts are never dealt.

**Simulate** runs bot matches with the cards on screen (saved or not) and shows how each card does: how often it is dealt and picked, the tiles it gains or costs, and the win rate of players who played it.

## Changing the rules safely

1. **Engine tests** (`packages/core/test`) cover each rule. Property tests (fast-check) play random matches and check three things: the invariants hold after every step, a match replays exactly, and no player's private events or hand reach another player.
2. **Golden matches** (`packages/core/test/golden.test.ts`) snapshot whole seeded matches: rounds, winner, event counts and a state hash. Any change to rules, RNG use or event shapes shows up as a snapshot diff. Update the snapshots only for intended changes, and read the diff first:

   ```bash
   pnpm vitest run packages/core/test/golden.test.ts -u
   ```

3. **The simulator** shows what a rule change does to the game: compare `pnpm sim run` reports before and after (match length, comeback rate, card win rates).
4. **The client's director test** plays a whole real match through the client's playback layer and fails if what it shows drifts from the engine's view.

## CI

GitHub Actions (`.github/workflows/ci.yml`):

- a `check` job runs typecheck, lint, test and the client build;
- an `e2e` job installs Playwright's Chromium and runs `pnpm e2e`, uploading traces when it fails. The e2e run also starts `wrangler dev` for the two-player tests; no Cloudflare account is needed.

## Specs, plans and handoff

- Designs: `docs/superpowers/specs/`.
- Phase plans: `docs/superpowers/plans/`. The client was built in six phases; see `2026-10-04-3d-client-phases.md`.
- Where things stand and what's next: `docs/superpowers/HANDOFF.md`.
