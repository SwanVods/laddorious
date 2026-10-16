# Laddorious

A 3D party race to tile 100 for four players, played in the browser on desktop and phones. Made by **Feiralabs**.

- **Everyone rolls at once:** each round, all players roll one die at the same time.
- **Rockets and whirlpools:** rockets launch you up the board, whirlpools drag you back down.
- **Face-offs:** players who land on the same tile settle it. Two play Rock, Paper, Scissors; three or four play Minority, where the odd one out wins.
- **Mystery cards:** purple "?" tiles let you pick one of three cards that move, shield or attack.
- **Play anywhere:** against bots offline, online by quick match, or in a private room with friends (share its code); empty seats fill with bots.
- **Fresh boards:** every board is generated from a seed.

What changed in each release: [CHANGELOG.md](CHANGELOG.md). Every version bump adds its entry there, and the game shows it in the lobby under What's new.

## Repository map

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | The rules engine and board generator: a pure, deterministic state machine. A match replays exactly from its config, seed and inputs. [README](packages/core/README.md) |
| `packages/bots` | `@laddorious/bots` | Bots that play from a player's view. [README](packages/bots/README.md) |
| `packages/host` | `@laddorious/host` | The match host: one match's engine state, timers and bots, plus the wire protocol. [README](packages/host/README.md) |
| `apps/client` | `@laddorious/client` | The game (Vite, React, React Three Fiber): menu, matchmaking, the 3D match with its HUD, sound and the end screen. [README](apps/client/README.md) |
| `apps/server` | `@laddorious/server` | The multiplayer server on Cloudflare Workers and Durable Objects. It also serves the built game. [README](apps/server/README.md) |
| `apps/sim` | `@laddorious/sim` | A headless simulator for balance: batch runs, metrics and replays. |
| `art/` | | Blender scripts that build the game's 3D models. [README](art/README.md) |

Libraries live in `packages/`, deployable apps in `apps/`.

## Getting started

You need Node 24 or newer and pnpm 11 (pinned in `package.json`; `corepack enable` installs it).

```bash
corepack enable
pnpm install
pnpm dev
```

The game opens on http://localhost:5173 and runs offline against bots.

## Scripts

```bash
pnpm dev                # the game's dev server
pnpm build              # the production build into apps/client/dist
pnpm test               # unit, property, golden and component tests (Vitest)
pnpm typecheck          # every package, the client and the e2e tests
pnpm lint               # ESLint
pnpm e2e                # Playwright end-to-end tests
pnpm serve              # the game and server together, for play over Wi-Fi
pnpm dev:online         # the dev server against a local multiplayer server
pnpm deploy:cloudflare  # build and deploy (needs `wrangler login`)
pnpm cards              # the card editor, local only
pnpm art                # rebuild the 3D models (needs Blender)
pnpm sim run --matches 1000 --players 4 --policy heuristic --out report.json
```

## How the parts fit together

- **The engine** is a pure state machine: a host feeds it inputs (rolls, picks, timeouts) and gets back the new state and what happened. All randomness comes from seeded streams kept in the state.
- **The host** runs one match: it feeds the engine bot moves, timeouts and players' actions, and sends each player only their own view.
- **The client** runs the host in a Web Worker for offline play, or talks to the server, which runs the same host, for online play.
- **Fair by design:** a player's screen only ever receives what that player may see. Other players' cards and picks, and the random seed, never reach it.

## Cards

Every card lives in `packages/core/src/cards/cards.json`, edited with `pnpm cards`. The editor writes each card's text from its steps, checks it as you go, and can simulate bot matches to show how each card performs. A card that needs something the engine can't do yet stays a draft and is never dealt.

## Changing the rules safely

- **Engine and property tests** check every rule, that the game's invariants hold after every step, that matches replay exactly, and that no private information leaks between players.
- **Golden matches** snapshot whole seeded matches, so any change to the rules shows up as a diff. Update them only for intended changes: `pnpm vitest run packages/core/test/golden.test.ts -u`.
- **The simulator** shows what a change does to match length, comebacks and card balance.

## CI

GitHub Actions runs typecheck, lint, the tests and the build on every push, then the Playwright end-to-end tests.

## License

© 2026 Feiralabs. All rights reserved.
