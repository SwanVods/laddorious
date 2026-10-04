# Handoff — 3D client, after Phase 1

**Written:** 2026-10-04, at the end of the session that designed Spec #2 and built its Phase 1.
**For:** the next Claude Code session on this repo. Read this file, then the spec and the phase index, before doing anything.
**Keep it current:** when Phase 2 starts, update the "Where things stand" and "Next step" sections or delete this file.

---

## Where things stand

| Done | Where it lives |
|---|---|
| Spec #1: deterministic rules engine, seeded board generator, simulator | `docs/superpowers/specs/2026-10-03-game-core-design.md`, `packages/core`, `apps/sim` |
| Bonus roll on a 6 removed (one die per round; extra rolls become a future card) | `docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md`; merged to `main` |
| Spec #2 (3D client, menu, matchmaking UI, bot matches): **approved** | `docs/superpowers/specs/2026-10-04-3d-client-design.md` |
| Spec #2 split into six phases | `docs/superpowers/plans/2026-10-04-3d-client-phases.md` |
| **Phase 1** (restructure and bots package): **done, merged to `main`** | `docs/superpowers/plans/2026-10-04-client-phase-1-restructure.md`; commits `089ef8c`, `56888ee` |
| **Phase 2** (client scaffold, local host, match service): **plan written**, to be executed on `client/phase-2` once the user approves it | `docs/superpowers/plans/2026-10-04-client-phase-2-local-match.md` |

After Phase 1 the full suite is 24 test files, 180 tests, all passing. `pnpm typecheck` and `pnpm lint` are clean. The `client/spec-2` branch was merged into `main` and deleted; there is no git remote.

## Next step: Phase 2

**Status (2026-10-04):** the plan is written: `docs/superpowers/plans/2026-10-04-client-phase-2-local-match.md`, on branch `client/phase-2`. Its code was dry-run in a scratch copy first (all tests, typecheck, lint, build, and a full match in the browser). Once the user approves the plan, execute it task by task (steps 4 and 5 below). Where the list under "What Phase 2 has to build" and the plan differ, the plan wins.

**Phase 2: client scaffold, local host and match service.** Spec sections: §3 (scripts), §4 (all), §7.4 (palette tokens only).

**It ends with:** `pnpm dev` opens a dev page. Pressing "Play with bots" runs a full 4-player bot match through `LocalMatchService` and the Web Worker host, shown as a live text log with the window timer and the final rankings. No 3D yet, no director yet.

How to run it, the way the user wants:

1. Create a branch from `main`, for example `client/phase-2`.
2. Use the `superpowers:writing-plans` skill to write `docs/superpowers/plans/2026-10-04-client-phase-2-<name>.md` (or today's date) against the code as it is now. Follow the format of the Phase 1 plan: Global Constraints, Review Focus, tasks with exact code, `Expected:` lines and a commit step per task.
3. Show the plan to the user and **wait for approval before writing code**.
4. Execute it with `superpowers:executing-plans`, **inline** (no subagents). TDD on every step. Commit at the end of every task.
5. Finish with a self-review of the whole branch (say that it was a self-review), then `superpowers:finishing-a-development-branch`.

What Phase 2 has to build, from the spec:

- **`apps/client`**: Vite + React + TypeScript, with React Three Fiber, drei and Zustand added now or in Phase 4 (the plan decides). Folders per spec §4.1: `app/`, `service/`, `worker/` (and later `director/`, `scene/`, `assets/`, `hud/`, `ui/`).
- **Root scripts**: `pnpm dev` (client dev server), `pnpm build` (client production build). `pnpm e2e` arrives in Phase 6. Add `apps/client` to `pnpm typecheck`.
- **Vitest**: the client's component tests run in jsdom. The root config already includes `apps/*/test/**`.
- **ESLint**: add React and React Hooks rules for `apps/client`. The determinism rules stay on `packages/core`; the no-`node:*` rule stays on `packages/*`.
- **`MatchService` interface**, exactly as in spec §4.3 (`findMatch`, `Matchmaking`, `MatchSession`, `MatchUpdate`, `PlayerAction`, `SeatInfo`, `PieceId`).
- **`LocalMatchService`** (§4.4): emits `searching` about every 250 ms and never finds a real player. `playWithBots()` moves to `filling` and adds bots about 420 ms apart, then emits `found`. Seat 0 is you in coral `#ff5470`. The bots are Mochi (`#3b82f6`), Pip (`#a3e635`) and Juno (`#8b5cf6`), taking the pieces you didn't choose, in picker order. "Play with bots" appears after 15 s (C7).
- **`LocalHost`**, a plain class that can be tested without a worker, plus `host.worker.ts` and the worker client. The message protocol is in §4.4. Timing rules:
  - The host waits for `playbackDone(windowId)` from the human seat, capped at 12 s, before starting the countdown.
  - Bots decide 0.6–2.5 s after the countdown starts.
  - On expiry the host calls `step({ type: 'timeout', windowId })`.
  - `pause` and `resume` freeze and restore every timer.
  - Step errors go back as `rejected`; an escaping exception or `InvariantError` sends `failed`.
- **Visibility rule** (§4.2): the main thread only ever gets `viewFor(state, me)` and `eventsFor(events, me)`. The secret `rngSeed` never leaves the worker. `seed` and `rngSeed` come from `crypto.getRandomValues`.
- **Palette tokens** (§7.4) as CSS variables, so the dev page already uses Tangerine Dusk.

The four phases after it (director, 3D scene, HUD and screens, e2e/CI/docs) are described in the phase index. Write each one's plan only when that phase starts.

## How this user works (follow these)

- **Never use subagents.** No Agent tool, no forks, no Workflow runs, no skill step that dispatches a reviewer or implementer. Do the reviews yourself and say they were self-reviews.
- **Commit at the end of every task.** Ask before merging or pushing; the user decides that at the end of a phase.
- **One phase at a time.** Each phase ends in something that runs. The plan for a phase is written when it starts and approved before any code.
- **Approvals are short:** "approved", "proceed", "go ahead", "correct". The user often brainstorms visually: when a look or layout is in question, show an HTML artifact mockup before writing it into a spec.
- **Visual rules** (spec §6–§7, memory `client-visual-direction`):
  - Pieces are board-game pieces (knight, pawn, meeple, dragon head), not beans.
  - The UI is chunky, outlined and toy-like (Lilita One + Fredoka), in the **Tangerine Dusk** palette. Never Fall Guys-style pastels.
  - Squares are classic multicoloured; "?" squares are purple with a painted glyph, no floating boxes.
  - Snakes are flat "vacuum" slides; ladders are launch pads.
  - The player list is a slim TFT-style column on the right.
  - Face-off and card pick are centred popups over a dimmed board, only for involved players; everyone else sees a waiting pill.
- **Platform** (memory `client-platform`): web first and phone-ready (touch first, landscape, phone performance budget). iOS and Android come later through Capacitor. No keyboard-only actions, no desktop-only layouts.
- **Docs matter to the user:** they asked for README files that explain how to maintain and deploy the app. Phase 6 delivers READMEs for the root, `apps/client` (local dev, build, Cloudflare Pages deploy step by step with Netlify and Vercel notes, phone testing, asset slots), `packages/core` and `packages/bots`. Keep the root README's package table current as packages appear.

## Repository facts

- **Layout:** `apps/` holds deployables (`sim` now, `client` next, `server` in Spec #3); `packages/` holds libraries (`core`, `bots`).
- **Toolchain:** TypeScript strict, pnpm 11.5 workspaces, Node ≥ 24, Vitest, fast-check, ESLint flat config, tsx.
- **Commands:** `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm sim board --seed <s>`, `pnpm sim run …`, `pnpm sim replay <log>`.
- **pnpm settings:** `pnpm-workspace.yaml` sets `allowBuilds: esbuild: true` (Vite needs it) and a `minimumReleaseAgeExclude` list. A very new dependency release can be refused until it ages; add an exclusion only when one is needed.
- **Engine API** (`@laddorious/core`):
  - `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor` and `hashState`.
  - Errors are `ConfigError`, `InvariantError` and `InputErrorCode`.
  - Useful types are `PlayerView`, `GameEvent`, `ChallengeChoice`, `Awaiting` and `PlayerId`.
  - The engine reads no clock and no unseeded randomness; lint bans `Date`, `performance` and `Math.random` in `packages/core/src`.
- **Bots** (`@laddorious/bots`): `RandomBot`, `HeuristicBot`, `makeBots(seats, policy, seed, afkPercent)` and `scoreCard`. They are browser-safe.
- **Environment:** Windows 11. Both PowerShell and Git Bash are available. The repo is at `E:\AI Project\laddorious`.
- **Superpowers ledger:** executing-plans keeps its ledger at `.superpowers/sdd/<plan-basename>/progress.md` (scratch, not committed). Delete it when a phase finishes.

## Reference material

- **Mockups** are private to the user and can be read with the Artifact tool (`action: "read"`):
  - In-match HUD: <https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR>. Use it for layout and behaviour only; its colours predate the palette.
  - Main menu and matchmaking: <https://claude.ai/artifact/7FTpDqWjPR5RFtW7ai6BJt>. Use the "Tangerine Dusk" tab.
  - Ignore <https://claude.ai/artifact/Wni8KFMBGKAWpHjXubnVMo> (abandoned art directions).
- **Project memory** (loaded automatically in this project): `no-subagents`, `no-bonus-roll`, `client-platform`, `client-visual-direction`, `handoff`.
- **Full transcript of the previous session**, for exact wording of past decisions: `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\eadbf1bc-7371-4ee6-ba92-8fb27d38fa24.jsonl`.

## Open items

- **Blender MCP:** on 2026-10-04 the user okayed using it to make the client's 3D objects (memory `blender-for-3d-objects`), so raise it when planning Phase 4 (the 3D scene) as well as Spec #4 (the art pass). It times out on connect: in Blender, the user should Disconnect, then Connect, in the MCP panel first.
- **Spec #3** (multiplayer server: matchmaking queue, rooms, server-side engine) implements the online `MatchService`. Not started.
- **Spec #4** (Blender art pass: `.glb` files for the asset slots in spec §6.3). Not started.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), sound and particles.
