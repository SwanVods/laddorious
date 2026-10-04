# 3D Client — Phase Index

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md` (Spec #2, approved)
**Branches:** one per phase (`client/phase-N`), cut from `main` and merged back when the phase ends. Phase 1 ran on `client/spec-2`.
**Execution:** native, in-session (no subagents), one phase at a time.

Spec #2 is built in six phases. Each phase ends in something that runs, and each gets its own detailed plan, written when the phase starts against the code the earlier phases produced. A plan written six phases ahead would have to guess file names and component shapes that don't exist yet.

| # | Phase | Spec sections | Ends with (the thing that runs) | Plan |
|---|---|---|---|---|
| 1 | Repository restructure and bots package | §3, C5, C6 | `apps/sim` and `packages/bots` in place; the full test suite, typecheck and lint pass; `pnpm sim run` works from the new location | `2026-10-04-client-phase-1-restructure.md` |
| 2 | Client scaffold, local host and match service | §3 scripts, §4, §7.4 tokens | `pnpm dev` opens a dev page: "Play with bots" runs a full bot match through `LocalMatchService` and the Web Worker host, shown as a live text log with the window timer and final rankings | `2026-10-04-client-phase-2-local-match.md` |
| 3 | Director and presentation state | §5.1, §5.2 | The dev page plays each update as a beat timeline (text and a flat 2D board), calls `playbackDone`, and the host's timers wait for it | `2026-10-04-client-phase-3-director.md` |
| 4 | 3D scene | §5.3, §6 | A full bot match animated in 3D (board, pieces, slides, pads, dice, camera rules, asset slots, quality levels, dev overlay) with a minimal ROLL button | written at phase start |
| 5 | HUD and screens | §7, §8 | The whole game per the spec: menu, matchmaking, match HUD and popups, end, settings, rotate, error and leave screens, in Tangerine Dusk, on desktop and landscape phones | written at phase start |
| 6 | End-to-end tests, CI and docs | §9.3–§9.5, §10 | Playwright passing on desktop Chromium and emulated phones; CI running build, unit, component and e2e jobs; README files for the root, client, core and bots | written at phase start |

Unit and component tests are written inside the phase that builds the code (test first). Phase 6 adds the cross-cutting end-to-end tests, CI and documentation.
