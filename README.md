# Laddorious

An online Snake & Ladders party game: simultaneous rounds, collisions, Mystery cards, and seeded procedural boards.

This repository currently holds **sub-project 1** — the deterministic rules engine, the seeded board generator, and a headless simulator. Server and client come later. Design: [`docs/superpowers/specs/2026-10-03-game-core-design.md`](docs/superpowers/specs/2026-10-03-game-core-design.md).

## Packages

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@laddorious/core` | Pure rules engine: `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`. No clock, no unseeded randomness — a match replays exactly from its config, seed and inputs. |
| `apps/sim` | `@laddorious/sim` | Bots, batch runner, metrics and the `sim` CLI. |

Libraries live in `packages/`, deployable apps in `apps/`.

## Commands

```bash
pnpm install
pnpm test        # unit, property and golden tests
pnpm typecheck
pnpm lint

pnpm sim board --seed daily-2026-10-03                   # print a generated board and its analysis
pnpm sim run --matches 1000 --players 4 --policy heuristic --out report.json --log match0.json
pnpm sim replay match0.json                               # verify a recorded match replays to the same hash
```
