# Laddorious

An online Snake & Ladders party game: simultaneous rounds, collisions, Mystery cards, and seeded procedural boards.

This repository holds **sub-project 1** — the deterministic rules engine, the seeded board generator and a headless simulator ([design](docs/superpowers/specs/2026-10-03-game-core-design.md)) — and the web client being built from [Spec #2](docs/superpowers/specs/2026-10-04-3d-client-design.md). The server comes later.

## Packages

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`. No clock, no unseeded randomness — a match replays exactly from its config, seed and inputs. |
| `packages/bots` | `@laddorious/bots` | Random and heuristic bots that play from a player's view. Browser-safe; shared by the simulator, and later the client and server. |
| `apps/sim` | `@laddorious/sim` | Batch runner, metrics and the `sim` CLI. |
| `apps/client` | `@laddorious/client` | The web client (Vite + React). For now a dev page that runs a bot match through the local match service and the Web Worker host. |

Libraries live in `packages/`, deployable apps in `apps/`.

## Commands

```bash
pnpm install
pnpm test        # unit, property and golden tests
pnpm typecheck
pnpm lint
pnpm dev         # client dev server on http://localhost:5173
pnpm build       # client production build into apps/client/dist

pnpm sim board --seed daily-2026-10-03                   # print a generated board and its analysis
pnpm sim run --matches 1000 --players 4 --policy heuristic --out report.json --log match0.json
pnpm sim replay match0.json                               # verify a recorded match replays to the same hash
```
