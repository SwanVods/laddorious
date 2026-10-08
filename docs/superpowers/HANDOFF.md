# Handoff — 3D client, Phase 5 in progress

**Written:** 2026-10-04, at the end of the session that designed Spec #2 and built its Phase 1; updated the same day at the end of Phases 2, 3 and 4, and on 2026-10-08 with the Phase 5 prototype.
**For:** the next Claude Code session on this repo. Read this file, then the spec and the phase index, before doing anything.
**Keep it current:** after each Phase 5 prototype task, when the Phase 5 plan is written, and when Phase 5 ends, update the "Where things stand" and "Next step" sections.

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
| **Phase 5** (HUD and screens): **in progress as a prototype** in a scratch copy of the repo (not committed); branch `client/phase-5` has no commits yet and no plan | see "Next step" below |

After Phase 4 the full suite is 42 test files, 294 tests, all passing. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (Vite warns about the three.js chunk size). There is no git remote.

## Next step: Phase 5, prototype then plan

**Phase 5: HUD and screens.** Spec sections: §7 (screens, HUD, input, palette and type), §8 (error handling).

**It ends with:** the whole game per the spec, in Tangerine Dusk, on desktop and landscape phones: menu, matchmaking, match HUD and popups, end screen, settings, rotate screen, error screen and leave dialog.

**Method (the user's choice, confirmed 2026-10-08; memory `phase5-prototype-method`):**

1. Build and test every task in a scratch copy of the repo.
2. Write a manifest and a replay script that re-verify each task in order (not written yet).
3. Generate the Phase 5 plan from the verified files.
4. Execute the plan on `client/phase-5` (TDD, commit per task), self-review, merge locally, then Phase 6.

**Where the prototype lives:**

- Working copy (dependencies installed): `C:\Users\ariefg\AppData\Local\Temp\claude\E--AI-Project-laddorious\faf515b9-15ae-404c-b087-030110c7339b\scratchpad\p5`. Run `pnpm test`, `pnpm typecheck` and `pnpm lint` inside it.
- Backup (in this repo, git-ignored): `.superpowers/p5-backup/p5.tar.gz`, refreshed after each task. If the Temp copy is gone, unpack it somewhere outside the repo and run `pnpm install`.
- Only `apps/client` differs from `main` (`index.html`, `src/app/theme.css`, `theme.ts`, `base.css`, `prefs.ts`, `src/director/director.ts`, `src/hud/`, `src/ui/` and their tests). Other files differ only in line endings: never copy them back.

**Prototype tasks:**

| # | Task | State |
|---|---|---|
| 1 | Tokens and fonts: colours only in `app/theme.ts` and `app/theme.css` (a test enforces it); sizes in `cqh` with pixel minimums and safe-area insets | done |
| 2 | Prefs store: profile and settings in `localStorage`, in memory if blocked; nicknames 1–16 characters, default `Guest####` | done |
| 3 | Director event log: `LoggedEvent`, `LOG_LIMIT` 300, including zero-duration beats and fast-forwarded events | done |
| 4 | `hud/labels.ts`: card info, target lines, fizzle warnings, effect chips, next-roll modifiers | done |
| 5 | `hud/record.ts` and `hud/feed.ts`: this round's dice and cards; event feed lines | done |
| 6 | `hud/model.ts`: stage bar, countdown, player rows, dock, resolution queue, face-off and card-pick popups (pure) | done |
| 7 | `ui/` primitives: Icon, PieceIcon/Portrait, DieFace, Dialog, toasts, useMediaQuery, RotateScreen | done |
| 8 | HUD panels: StageBar, EventFeed, PlayerColumn, YourPiece, `hud.css`, component tests (notes in the prototype's `PROTOTYPE.md`) | done |
| 9 | Dock (ROLL with Space, waiting pill, move caption, card queue), face-off popup (keys 1–3), card-pick popup (rerolls, "Peek at the board", keys 1–3), banners | done |
| 10 | In-world name tags; MatchScreen with watch mode and "Back to my piece", leave dialog, rejection toasts, dev stats | done (preview at `/#hud`, port 5174 via the `client-proto` launch entry) |
| 11 | Menu scene and screen: podium, floating tiles, turntable, profile chip with rename, logo, gear, piece picker, PLAY with "4-player match", rule tips (hidden under 450 px tall), dev seed field via `findMatch(profile, opts?: { seed })` | done |
| 12 | Matchmaking overlay ("Play with bots" after 15 s, MATCH FOUND, 3-2-1), end-screen podium, error screen, settings dialog | done |
| 13 | App shell: routing state machine, error boundary, pause on hidden page, fullscreen on first tap (not iOS); remove `DevMatchPage` and the dev files | done (the app now runs at `/`) |
| 14 | Phase gate and handoff | to do |

**Rulings to carry into the plan:** `findMatch(profile, opts?: { seed })` adds an optional dev seed to the §4.3 signature. It serves §4.4's hidden seed field, and Spec #3's online service ignores it.

What Phase 4 left for Phase 5:

- `src/scene/MatchScene.tsx` is the 3D board. It takes `watch` (watch mode) and `reducedMotion` (settings) props that the HUD should feed, and a `setting` that needs a remount (`key`) to change.
- The dev page (`src/app/DevMatchPage.tsx`) is the harness to replace: its ROLL button, status line and log are stand-ins for the HUD.
- The dev overlay reads `src/scene/stats.ts`; e2e (Phase 6) can read the same store for the draw-call check.
- The board overlay paints numbers in the system font and may want a repaint once the web fonts load.

## How this user works (follow these)

- **Never use subagents.** No Agent tool, no forks, no Workflow runs, no skill step that dispatches a reviewer or implementer. Do the reviews yourself and say they were self-reviews.
- **Commit at the end of every task.** Ask before pushing, publishing or anything destructive.
- **Standing order (2026-10-04, memory `continue-through-phase-6`):** run Phases 3–6 back to back. For each phase: branch `client/phase-N` from `main`, write the plan, execute inline, self-review, fast-forward merge to `main` locally, delete the branch, start the next phase. Don't stop for plan approval and don't ask before these local merges. Each phase ends in something that runs.
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
- **Scene:** `src/scene/` holds the 3D scene. Rules are pure and unit-tested (`layout.ts`, `quality.ts`, `motion.ts`, `camera.ts`); the components read the director's store once per frame. `test/scene.test.tsx` renders the scene graph with `@react-three/test-renderer` and fails above 100 draw calls or 150k triangles, so run it after adding anything to the scene.
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

- **Blender MCP:** on 2026-10-04 the user okayed using it to make the client's 3D objects (memory `blender-for-3d-objects`), for Spec #4 (the art pass). It used to time out on connect (in Blender: Disconnect, then Connect, in the MCP panel); it was reachable on 2026-10-08. Check it with `get_addon_status`.
- **Deferred Phase 4 minors** (from the self-review; not fixed):
  - The crown is placed at tile 100 directly (`src/scene/Surroundings.tsx`), not at the board's last tile.
  - `webglAvailable()` (`src/scene/MatchScene.tsx`) never releases its probe context.
  - Textures and geometries built with `useMemo` in the scene (chevrons, swirl, die atlas, sky, piece and die geometries) are not disposed on unmount; only the board overlay and slide ribbons are.
  - Only six of the nine §6.3 slots are wired: `die`, `pad` and `slide.vortex` wait for Spec #4.
- **Spec #3** (multiplayer server: matchmaking queue, rooms, server-side engine) implements the online `MatchService`. Not started; suggested after Phase 5, tested first on the user's own network (memory `multiplayer-lan-testing`).
- **Spec #4** (Blender art pass: `.glb` files for the asset slots in spec §6.3). Not started.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), sound and particles.
