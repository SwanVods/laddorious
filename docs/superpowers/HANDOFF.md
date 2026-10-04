# Handoff — 3D client, after Phase 3

**Written:** 2026-10-04, at the end of the session that designed Spec #2 and built its Phase 1; updated the same day at the end of Phases 2 and 3.
**For:** the next Claude Code session on this repo. Read this file, then the spec and the phase index, before doing anything.
**Keep it current:** when Phase 4 starts, update the "Where things stand" and "Next step" sections or delete this file.

---

## Where things stand

| Done | Where it lives |
|---|---|
| Spec #1: deterministic rules engine, seeded board generator, simulator | `docs/superpowers/specs/2026-10-03-game-core-design.md`, `packages/core`, `apps/sim` |
| Bonus roll on a 6 removed (one die per round; extra rolls become a future card) | `docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md`; merged to `main` |
| Spec #2 (3D client, menu, matchmaking UI, bot matches): **approved** | `docs/superpowers/specs/2026-10-04-3d-client-design.md` |
| Spec #2 split into six phases | `docs/superpowers/plans/2026-10-04-3d-client-phases.md` |
| **Phase 1** (restructure and bots package): **done, merged to `main`** | `docs/superpowers/plans/2026-10-04-client-phase-1-restructure.md`; commits `089ef8c`, `56888ee` |
| **Phase 2** (client scaffold, local host, match service): **done, merged to `main`** | `docs/superpowers/plans/2026-10-04-client-phase-2-local-match.md`; commits `92afaa2`, `ec93aaa`, `05e8392`, `4535390`, `750a3ca`, `6e43716`, `611440a`, `19a9b80` |
| **Phase 3** (director and presentation state): **done, merged to `main`** | `docs/superpowers/plans/2026-10-04-client-phase-3-director.md`; commits `e11674d`, `f159d0e`, `437ca0f`, `ef9ddf5`, `d1cf3e3` |
| **Phase 4** (the 3D scene): **plan written**, being executed on `client/phase-4` | `docs/superpowers/plans/2026-10-04-client-phase-4-3d-scene.md` |

After Phase 3 the full suite is 33 test files, 248 tests, all passing. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean. There is no git remote.

## Next step: Phase 4

**Phase 4: the 3D scene.** Spec sections: §5.3 (camera), §6 (scene, assets, performance).

**It ends with:** a full bot match animated in 3D (board, pieces, slides, pads, dice, camera rules, asset slots, quality levels, dev overlay) with a minimal ROLL button.

**Status:** the plan is written (`docs/superpowers/plans/2026-10-04-client-phase-4-3d-scene.md`) and being executed on `client/phase-4`. Its ledger is at `.superpowers/sdd/2026-10-04-client-phase-4-3d-scene/progress.md`.

How to run it: the user asked on 2026-10-04 to continue through Phase 6 without stopping (memory `continue-through-phase-6`). Branch `client/phase-4` from `main`, write the plan with `superpowers:writing-plans`, execute it inline with `superpowers:executing-plans` (TDD, commit per task), self-review the branch, merge it locally, then go on to Phase 5.

What Phase 3 left for Phase 4:

- The director's store (`src/director/director.ts`) is what the scene renders. `presentation` is the board between beats. `beat` is the step on stage, with `startedAt`, `durationMs` and `after`; animate from `presentation` towards `beat.after`. `settled` is the latest finished update, for the HUD.
- `src/app/DevBoard.tsx` shows the mapping the scene needs: the serpentine tile layout, stack offsets (`stackOn`), side-by-side face-offs and the start row.
- Beat kinds and durations are in `src/director/beats.ts` (`BEAT_MS`, the §5.1 starting values). Tune them against the 3D animations.
- Board colours are in `src/app/theme.ts` (`BOARD_COLORS`); the sky, fog and podium tokens of §7.4 join it.
- The user okayed making the 3D objects with the Blender MCP (memory `blender-for-3d-objects`), but asked to keep the plan unchanged. Spec §6.3 has code-built defaults behind asset slots, with `.glb` overrides for the Spec #4 art pass.

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

- **Layout:** `apps/` holds deployables (`sim`, `client`, and `server` in Spec #3); `packages/` holds libraries (`core`, `bots`).
- **Toolchain:** TypeScript strict, pnpm 11.5 workspaces, Node ≥ 24, Vitest, fast-check, ESLint flat config, tsx.
- **Commands:** `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm dev` (client on http://localhost:5173), `pnpm build` (into `apps/client/dist`), `pnpm sim board --seed <s>`, `pnpm sim run …`, `pnpm sim replay <log>`.
- **pnpm settings:** `pnpm-workspace.yaml` sets `allowBuilds: esbuild: true` (Vite needs it) and a `minimumReleaseAgeExclude` list. A very new dependency release can be refused until it ages; add an exclusion only when one is needed.
- **Engine API** (`@laddorious/core`):
  - `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor` and `hashState`.
  - Errors are `ConfigError`, `InvariantError` and `InputErrorCode`.
  - Useful types are `PlayerView`, `GameEvent`, `ChallengeChoice`, `Awaiting` and `PlayerId`.
  - The engine reads no clock and no unseeded randomness; lint bans `Date`, `performance` and `Math.random` in `packages/core/src`.
- **Bots** (`@laddorious/bots`): `RandomBot`, `HeuristicBot`, `makeBots(seats, policy, seed, afkPercent)` and `scoreCard`. They are browser-safe.
- **Client tests and lint:** component tests start with `// @vitest-environment jsdom`; every other test runs in Node. React and React Hooks rules come from `@eslint-react/eslint-plugin` (`eslint-plugin-react` stops at ESLint 9). jsdom stays on 29 while this machine's Node is 24.14 (jsdom 30 needs 24.15). The local, untracked `.claude/launch.json` has `client` (dev server) and `client-build` (serves `dist`) entries for the preview pane.
- **Director:** `src/director/` is plain TypeScript (presentation state, beat timelines, the `Director` on a `zustand/vanilla` store). Its whole-match test plays a real match through the director and fails on any presentation drift, so run it after changing beat or presentation rules.
- **Environment:** Windows 11. Both PowerShell and Git Bash are available. The repo is at `E:\AI Project\laddorious`.
- **Superpowers ledger:** executing-plans keeps its ledger at `.superpowers/sdd/<plan-basename>/progress.md` (scratch, not committed). Delete it when a phase finishes.

## Reference material

- **Mockups** are private to the user and can be read with the Artifact tool (`action: "read"`):
  - In-match HUD: <https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR>. Use it for layout and behaviour only; its colours predate the palette.
  - Main menu and matchmaking: <https://claude.ai/artifact/7FTpDqWjPR5RFtW7ai6BJt>. Use the "Tangerine Dusk" tab.
  - Ignore <https://claude.ai/artifact/Wni8KFMBGKAWpHjXubnVMo> (abandoned art directions).
- **Project memory** (loaded automatically in this project): `no-subagents`, `no-bonus-roll`, `client-platform`, `client-visual-direction`, `blender-for-3d-objects`, `multiplayer-lan-testing`, `handoff`.
- **Full transcript of the previous session**, for exact wording of past decisions: `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\eadbf1bc-7371-4ee6-ba92-8fb27d38fa24.jsonl`.

## Open items

- **Blender MCP:** on 2026-10-04 the user okayed using it to make the client's 3D objects (memory `blender-for-3d-objects`), so raise it when planning Phase 4 (the 3D scene) as well as Spec #4 (the art pass). It times out on connect: in Blender, the user should Disconnect, then Connect, in the MCP panel first.
- **Spec #3** (multiplayer server: matchmaking queue, rooms, server-side engine) implements the online `MatchService`. Not started; suggested after Phase 5, tested first on the user's own network (memory `multiplayer-lan-testing`).
- **Spec #4** (Blender art pass: `.glb` files for the asset slots in spec §6.3). Not started.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), sound and particles.
