# Handoff — 3D client (Spec #2) and the polish pass complete

**Written:** 2026-10-04, at the end of the session that designed Spec #2 and built its Phase 1; updated the same day at the end of Phases 2, 3 and 4, on 2026-10-08 at the end of Phases 5 and 6 (Spec #2 complete), and again after the polish pass the user asked for once they had played it.
**For:** the next Claude Code session on this repo. Read this file, then the spec and the phase index, before doing anything.
**Keep it current:** when the next spec starts and ends, update the "Where things stand" and "Next step" sections.

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
| **Phase 4** (the 3D scene): **done, merged to `main`** | `docs/superpowers/plans/2026-10-04-client-phase-4-3d-scene.md`; commits `3d9c934`, `91f41fe`, `2d00e81`, `69b79e2`, `7a7db45`, `625cd48`, `c607d59`, `809436b`, `5151604`; review fix `5ac6f4c` |
| **Phase 5** (HUD and screens): **done, merged to `main`**. Built prototype-first, then a task-by-task replay verified it before the plan was generated | `docs/superpowers/plans/2026-10-08-client-phase-5-hud-screens.md`; commits `39c8487`, `09bb185`, `5983e50`, `6cb8fb7`, `1c0b7ca`, `6130160`, `635ed3e`, `6562f11`, `43806cc`, `98862b0`, `e71f77b`, `57283f2`, `1dc5e72`; browser fix `93beb3b` |
| **Phase 6** (e2e tests, CI, READMEs): **done, merged to `main`** | `docs/superpowers/plans/2026-10-08-client-phase-6-e2e-ci-docs.md`; commits `23f829b`, `fbbb65d`, `dfcff79`, `ac85eac`, `70d1b38`; review fix `795cb06` |
| **Polish pass** (after the user played Spec #2): your die in the centre, thinner slide lanes that never cross, the card pick closing on pick, a 30 s card window, card bubbles, hands without duplicates, and a ranks reveal after the winner cam. **Done, merged to `main`** | `docs/superpowers/specs/2026-10-08-polish-pass-design.md`, `docs/superpowers/plans/2026-10-08-polish-pass.md`; commits `e1d0e96`, `a8ffd37`, `2bfd0c3`, `9eb4742`, `b281271`, `03a392b`, `d17b21b`, `a59c244`, `8a230bb`; browser fix `fa8b190` |

After the polish pass and the column card bubbles the full suite is 60 test files, 455 tests, all passing, and `pnpm e2e` passes 9 Playwright tests (3 tests × 3 projects, about 4 minutes). 1,000 simulated four-player matches take about 8 s (spec #1's target is under 10 s); the median match is 21 rounds. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (Vite warns about the three.js chunk size). There is no git remote, so the CI workflow has never run.

## Next step: Spec #3, sound design

Spec #2 and the polish pass are complete, including the column card bubbles (2026-10-09, commit `8180d2a`).

The user renumbered the roadmap on 2026-10-08: **sound design is Spec #3 and comes next**, before the server (memory `sound-design-spec3`). Older docs (spec #2, the phase plans) keep the old numbers: server = #3, art = #4.

- **Spec #3, sound design (next):** the user wants Claude to do the sound design itself. Start with superpowers:brainstorming: what the game should sound like, how sounds are made (for example synthesized in code with Web Audio, or free CC0 libraries), music or not, and how sounds hook into the director's beats and the HUD.
- **Spec #4, the multiplayer server:** matchmaking queue, rooms, and the engine on the server, behind the same `MatchService` the local worker implements. Tested first on the user's own Wi-Fi (memory `multiplayer-lan-testing`).
- **Spec #5, the Blender art pass:** `.glb` models for the asset slots (spec #2 §6.3; `apps/client/README.md` has the contract). Use the Blender MCP (memory `blender-for-3d-objects`).
- **Fixes for the deferred minors** under Open items.

The user also plans other board styles and themes later, not only the 10×10 grid (memory `future-board-themes`); the layout and the lane shape already live in one module for that (`packages/core/src/board/layout.ts`).

Each new spec starts with brainstorming and a design doc, as Specs #1 and #2 did. The standing order to run phases back to back (memory `continue-through-phase-6`) is fulfilled and doesn't carry over.

## How this user works (follow these)

- **Never use subagents.** No Agent tool, no forks, no Workflow runs, no skill step that dispatches a reviewer or implementer. Do the reviews yourself and say they were self-reviews.
- **Commit at the end of every task.** Ask before pushing, publishing or anything destructive.
- **Standing order (2026-10-04, memory `continue-through-phase-6`):** run Phases 3–6 back to back. For each phase: branch `client/phase-N` from `main`, write the plan, execute inline, self-review, fast-forward merge to `main` locally, delete the branch, start the next phase. Don't stop for plan approval and don't ask before these local merges. Each phase ends in something that runs.
- **Play-test feedback:** after playing, the user sends a list of changes. For the polish pass: questions with options (`AskUserQuestion`), a visual comparison as an HTML artifact where a look was in question, a short spec, then "approved, directly execute the implementation" (a lean plan, executed inline without a plan review stop, merged locally).
- **Approvals are short:** "approved", "proceed", "go ahead", "correct". The user often brainstorms visually: when a look or layout is in question, show an HTML artifact mockup before writing it into a spec.
- **Visual rules** (spec §6–§7, memory `client-visual-direction`):
  - Pieces are board-game pieces (knight, pawn, meeple, dragon head), not beans.
  - The UI is chunky, outlined and toy-like (Lilita One + Fredoka), in the **Tangerine Dusk** palette. Never Fall Guys-style pastels.
  - Squares are classic multicoloured; "?" squares are purple with a painted glyph, no floating boxes.
  - Snakes are flat "vacuum" slides; ladders are launch pads.
  - The player list is a slim TFT-style column on the right.
  - Face-off and card pick are centred popups over a dimmed board, only for involved players; everyone else sees a waiting pill.
- **Platform** (memory `client-platform`): web first and phone-ready (touch first, landscape, phone performance budget). iOS and Android come later through Capacitor. No keyboard-only actions, no desktop-only layouts.
- **Docs matter to the user:** they asked for README files that explain how to maintain and deploy the app. The root, `apps/client`, `packages/core` and `packages/bots` have them. Keep them current, and keep the root README's package table current as packages appear (`apps/server` in Spec #3).

## Repository facts

- **Layout:** `apps/` holds deployables (`sim`, `client`, and `server` in Spec #4); `packages/` holds libraries (`core`, `bots`).
- **Toolchain:** TypeScript strict, pnpm 11.5 workspaces, Node ≥ 24, Vitest, fast-check, ESLint flat config, tsx.
- **Commands:** `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm dev` (client on http://localhost:5173), `pnpm build` (into `apps/client/dist`), `pnpm e2e` (Playwright; first run `pnpm --filter @laddorious/client exec playwright install chromium`), `pnpm sim board --seed <s>`, `pnpm sim run …`, `pnpm sim replay <log>`.
- **pnpm settings:** `pnpm-workspace.yaml` sets `allowBuilds: esbuild: true` (Vite needs it) and a `minimumReleaseAgeExclude` list. A very new dependency release can be refused until it ages; add an exclusion only when one is needed.
- **Engine API** (`@laddorious/core`):
  - `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor` and `hashState`.
  - Errors are `ConfigError`, `InvariantError` and `InputErrorCode`.
  - Useful types are `PlayerView`, `GameEvent`, `ChallengeChoice`, `Awaiting` and `PlayerId`.
  - The engine reads no clock and no unseeded randomness; lint bans `Date`, `performance` and `Math.random` in `packages/core/src`.
  - Since the polish pass: the card window is 30 s; a hand never holds the same card twice (`drawCard` takes an exclude list, `Offer.seen` records what a hand showed); the board generator is version 3 and keeps snake lanes `LANE_CLEARANCE` apart, measured on `laneCenterline` from `board/layout.ts`, the same curve the client draws (`lanesTouch` is the fast check).
- **Bots** (`@laddorious/bots`): `RandomBot`, `HeuristicBot`, `makeBots(seats, policy, seed, afkPercent)` and `scoreCard`. They are browser-safe.
- **Client tests and lint:** component tests start with `// @vitest-environment jsdom`; every other test runs in Node. React and React Hooks rules come from `@eslint-react/eslint-plugin` (`eslint-plugin-react` stops at ESLint 9). jsdom stays on 29 while this machine's Node is 24.14 (jsdom 30 needs 24.15). The local, untracked `.claude/launch.json` has `client` (dev server) and `client-build` (serves `dist`) entries for the preview pane.
- **Director:** `src/director/` is plain TypeScript (presentation state, beat timelines, the `Director` on a `zustand/vanilla` store). Its whole-match test plays a real match through the director and fails on any presentation drift, so run it after changing beat or presentation rules.
- **Polish pass client parts:** `src/hud/CenterDie.tsx` (my roll in the centre), `src/hud/bubbles.ts` (card bubble lifetimes; `PlayerColumn.tsx` draws each as one line beside the player's row, with `CARD_SUMMARIES` from `labels.ts`), `src/hud/ranks.ts` and the `ranks` beat in `director/beats.ts` (the ranks reveal; the director doesn't log it twice and `bannerFor` skips it).
- **Screens:** `src/app/App.tsx` routes the screens; `src/hud/model.ts`, `labels.ts`, `record.ts` and `feed.ts` are the pure HUD model; `test/tokens.test.ts` fails on any colour outside `src/app/theme.ts` and `theme.css`; `test/support/scripted.ts` drives matchmaking and sessions in component tests.
- **Scene:** `src/scene/` holds the 3D scene. Rules are pure and unit-tested (`layout.ts`, `quality.ts`, `motion.ts`, `camera.ts`); the components read the director's store once per frame. `test/scene.test.tsx` renders the scene graph with `@react-three/test-renderer` and fails above 100 draw calls or 150k triangles, so run it after adding anything to the scene.
- **e2e:** `apps/client/e2e/game.spec.ts` and `apps/client/playwright.config.ts`. `pnpm e2e` builds with `vite build --mode e2e` into `apps/client/dist-e2e` and serves it on port 4180. Only that build has `window.__laddoriousTest` (`src/app/testMode.ts`): the worker plays every seat with short windows (`FAST` in `src/worker/localHost.ts`), and director beats run at 5% (`timeScale`).
- **CI:** `.github/workflows/ci.yml` has a `check` job (typecheck, lint, test, build) and an `e2e` job (Playwright Chromium, traces uploaded on failure).
- **Environment:** Windows 11. Both PowerShell and Git Bash are available. The repo is at `E:\AI Project\laddorious`.
- **Superpowers ledger:** executing-plans keeps its ledger at `.superpowers/sdd/<plan-basename>/progress.md` (scratch, not committed). Delete it when a phase finishes.

## Reference material

- **Mockups** are private to the user and can be read with the Artifact tool (`action: "read"`):
  - In-match HUD: <https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR>. Use it for layout and behaviour only; its colours predate the palette.
  - Main menu and matchmaking: <https://claude.ai/artifact/7FTpDqWjPR5RFtW7ai6BJt>. Use the "Tangerine Dusk" tab.
  - Ignore <https://claude.ai/artifact/Wni8KFMBGKAWpHjXubnVMo> (abandoned art directions).
- **Project memory** (loaded automatically in this project): `no-subagents`, `no-bonus-roll`, `client-platform`, `client-visual-direction`, `blender-for-3d-objects`, `multiplayer-lan-testing`, `continue-through-phase-6`, `phase5-prototype-method`, `handoff`.
- **Full transcript of the previous session**, for exact wording of past decisions: `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\eadbf1bc-7371-4ee6-ba92-8fb27d38fa24.jsonl`.

## Open items

- **Blender MCP:** on 2026-10-04 the user okayed using it to make the client's 3D objects (memory `blender-for-3d-objects`), for Spec #5 (the art pass). It used to time out on connect (in Blender: Disconnect, then Connect, in the MCP panel); it was reachable on 2026-10-08. Check it with `get_addon_status`.
- **Deferred Phase 4 minors** (from the self-review; not fixed):
  - The crown is placed at tile 100 directly (`src/scene/Surroundings.tsx`), not at the board's last tile.
  - `webglAvailable()` (`src/scene/MatchScene.tsx`) never releases its probe context.
  - Textures and geometries built with `useMemo` in the scene (chevrons, swirl, die atlas, sky, piece and die geometries) are not disposed on unmount; only the board overlay and slide ribbons are.
  - Only six of the nine §6.3 slots are wired: `die`, `pad` and `slide.vortex` wait for Spec #5.
- **Deferred Phase 5 minors** (from the self-review; not fixed):
  - Dev builds only (React StrictMode): MatchScreen's subscription effect disposes the director in its cleanup, so updates held before the screen mounted go to the first, discarded subscription. Today only the opening update can be held, and it has no beats, so nothing is lost.
  - On a 390 px tall screen the menu's piece picker covers part of the podium's name plate.
  - iPadOS detection uses the deprecated `navigator.platform` (MacIntel with touch points).
  - The board overlay paints tile numbers before the web fonts load (system font), carried from Phase 4.
  - The rotate screen covers the match but doesn't pause it.
  - The settings' "Right now" level doesn't reflect Auto's live step-down during a match.
- **Deferred Phase 6 minors** (from the self-review; not fixed):
  - e2e builds only: in fast mode ROLL and the popups stay live while a bot plays my seat, so a manual tap can race it and show a rejection toast.
  - e2e builds only: banners (1.7 s) and CSS animations aren't time-scaled; only director beats are.
  - The CI workflow has never run (no git remote). The deploy notes in `apps/client/README.md` were checked against the hosts' docs, not a real deploy.
- **Deferred polish-pass minors** (from the self-review; not fixed):
  - After I pick a card, the camera keeps its "my Mystery pick" swoop until the reveal settles (it reads the settled view).
  - Rank badges live inside name tags, so a tag hidden behind the camera hides its badge too (rare; the reveal uses the overview).
  - With three different cards per hand, the heuristic bots never pick Risky cards (simulator: 120 → 0 picks per 1,000 matches) and pick Defense half as often. A bot-balance note, not a rules defect.
  - Card-made slides (Snake Pit, 3 rounds) may still cross a lane; ladders aren't checked against lanes.
- **Spec #3** (sound design, done by Claude). Not started; next.
- **Spec #4** (multiplayer server: matchmaking queue, rooms, server-side engine) implements the online `MatchService`. Not started; tested first on the user's own network (memory `multiplayer-lan-testing`).
- **Spec #5** (Blender art pass: `.glb` files for the asset slots in spec #2 §6.3). Not started.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), particles.
