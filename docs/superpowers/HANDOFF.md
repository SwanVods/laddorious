# Handoff — Spec #4 (multiplayer server) complete

**Written:** 2026-10-04, at the end of the session that designed Spec #2 and built its Phase 1; updated the same day at the end of Phases 2, 3 and 4, on 2026-10-08 at the end of Phases 5 and 6 (Spec #2 complete), again after the polish pass the user asked for once they had played it, after Spec #3 (sound) and after Spec #4 (the multiplayer server, 2026-10-09).
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
| **Spec #3, sound design** (Claude-made, in code with Tone.js 15.1.22): 42 effects and two music loops from the approved sound board, a pure beat-to-sound mapping, mute and volume settings, a quick mute button, Tone loaded as its own chunk after the first tap. **Done, merged to `main`** | `docs/superpowers/specs/2026-10-09-sound-design.md`, `docs/superpowers/specs/2026-10-09-sound-board.html` (the approved sounds), `docs/superpowers/plans/2026-10-09-sound-design.md`; commits `cc1547d`, `f78ffa2`, `09f7dab`, `b3dcb2d`, `afadd08`, `750cc32`, `3dca2f0`, `fbfc419`, `e80ba07` |
| **Spec #4, the multiplayer server** (Cloudflare Workers + Durable Objects): quick match with real players, bots on request after your own 15 s, away seats that run on timeouts (no bot plays for them), rejoin within 60 s (also after a reload), clock sync, the unreachable-server fallback to offline bots, `pnpm serve` for Wi-Fi play and a deploy guide. **Done, merged to `main`.** Not deployed: deploying is the user's step | `docs/superpowers/specs/2026-10-09-multiplayer-server-design.md`, `docs/superpowers/plans/2026-10-09-multiplayer-server.md`, `apps/server/README.md` (the Wi-Fi and Cloudflare guide); commits `66d2908`, `a068693`, `6cd4220`, `9c20922`, `9def4c2`, `4381de9`, `948c5ea`, `0c9440a`, `65d4386`, `048a1ee`, `c519334`, `7ed8abd`, `a91dfa5`, `60de741` |
| **Spec #5, the art pass, Step 1 of 3** (the Blender build and the pieces): `art/` builds models headless with `pnpm art`, sculpted as one continuous surface each (`art/lib/sculpt.py`, after the user's first review); seven pieces (the rook, top hat and rubber duck are new; protocol 2), the die and the crown; a contract test per model file; `pnpm shots`. **Approved, merged to `main`** (`2819556`) | `docs/superpowers/specs/2026-10-09-art-pass-design.md`, `docs/superpowers/plans/2026-10-09-art-pass-step1.md`, `art/README.md` |
| **Spec #5, the art pass, Step 2 of 3** (the board): tiles, launch rockets, landing flags, whirlpools and exit splats on instanced slots (`useSlotMesh`); shadow stand-ins for the pieces, die and crown (spec A12). After the user's first Step 2 review (A13, A14): paths hidden until a piece stands on their start, rides them, or a player taps an end; each jump's ends paired by colour and symbol; rounder, taller tiles; a taller pad; a lighter die; lighter pieces on Low quality. **Done on branch `art/spec-5`, awaiting the user's second Step 2 review** | `docs/superpowers/plans/2026-10-09-art-pass-step2.md` (Tasks 1–9, then R1–R7); commits `1da042b` … `d935fad`, `81ba04c`, then `1487062`, `278f884`, `0ae940e`, `ae08600`, `2e36fb2`, `7f2a13b`, `7d29028` |
| **Polish pass** (after the user played Spec #2): your die in the centre, thinner slide lanes that never cross, the card pick closing on pick, a 30 s card window, card bubbles, hands without duplicates, and a ranks reveal after the winner cam. **Done, merged to `main`** | `docs/superpowers/specs/2026-10-08-polish-pass-design.md`, `docs/superpowers/plans/2026-10-08-polish-pass.md`; commits `e1d0e96`, `a8ffd37`, `2bfd0c3`, `9eb4742`, `b281271`, `03a392b`, `d17b21b`, `a59c244`, `8a230bb`; browser fix `fa8b190` |

After Spec #4 the full suite is 76 test files, 597 tests, all passing, and `pnpm e2e` passes 11 Playwright tests (about 6 minutes): 3 tests × 3 offline projects, and 2 two-player tests in the `online` project against `wrangler dev` (the server's real 15 s bot offer makes them slower). The whole-match test also checks that sound started, played and recorded no errors. 1,000 simulated four-player matches take about 8 s (spec #1's target is under 10 s); the median match is 21 rounds. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (Vite warns about the three.js chunk size). There is no git remote, so the CI workflow has never run.

On `art/spec-5` after Spec #5 Step 2's review rounds: 89 test files and 702 tests pass, and `pnpm e2e` passes all 17 (about 8 minutes). A busy match stays under 150,000 triangles on High and 100,000 on Low (`art/test/budget.test.ts`).

## Next step: the user reviews Spec #5 Step 2

**Requested at the fifth Step 2 look (2026-10-14), not started yet:**
1. Low quality shows the jump ends as images on the tiles; the 3D objects (rockets, flags, whirlpools, splats) only on High.
2. The board's tiles wider.
3. Pieces that land on a rocket or a flag animate or stand aside so they don't clash with it, one piece or several.
4. Pieces' name tags hidden, shown on hover or tap.
5. On the finish tile, the crown animates and sits on top of the piece that finishes.

Spec #4 (the multiplayer server) is done and merged to `main` (2026-10-09). Two things are the user's own steps:

- **Try it on the Wi-Fi:** `pnpm serve` builds the game for the local server, starts `wrangler dev` on port 8787 on every network interface, and prints the addresses to open on phones (memory `multiplayer-lan-testing`).
- **Deploy to Cloudflare:** follow `apps/server/README.md` (`wrangler login`, then `pnpm deploy:cloudflare`). Claude never deploys or touches the Cloudflare account (memory `hosting-cloudflare`).

**Spec #5, the Blender art pass,** is under way on branch `art/spec-5`. Step 1 (the pipeline, the seven pieces, the die and the crown) was approved and merged to `main`. Step 2 (the board) went through one review round: the user's notes (hidden paths, pairs by colour and symbol, tap to see a path, rounder taller tiles, a taller pad, a lighter die, lighter pieces on Low) are built, and the board awaits the user's second look in the Step 2 section of the review page <https://claude.ai/artifact/Gk8E6V9hf18euZWULr4Sa4>. After approval, the branch is merged to `main` locally, and plan 3 (`docs/superpowers/plans/2026-10-09-art-pass-step3.md`, the world) runs. **Room for Step 3:** a busy match leaves about 18,700 triangles on High and 50,700 on Low; plan 3's world needs about 32,000 at its limits, so its models have to come in under those limits (the user asked to trim while making things look better by shape and colour).

The roadmap was renumbered on 2026-10-08 (sound design became #3). Older docs (spec #2, the phase plans) keep the old numbers: server = #3, art = #4.

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
- **Docs matter to the user:** they asked for README files that explain how to maintain and deploy the app. The root, `apps/client`, `packages/core` and `packages/bots` have them. Keep them current, and keep the root README's package table current as packages appear. `packages/host` and `apps/server` (with the Wi-Fi and deploy guide) have READMEs since Spec #4.

## Repository facts

- **Layout:** `apps/` holds deployables (`sim`, `client`, `server`); `packages/` holds libraries (`core`, `bots`, `host`).
- **Toolchain:** TypeScript strict, pnpm 11.5 workspaces, Node ≥ 24, Vitest, fast-check, ESLint flat config, tsx.
- **Commands:** `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm dev` (client on http://localhost:5173), `pnpm build` (into `apps/client/dist`), `pnpm e2e` (Playwright; first run `pnpm --filter @laddorious/client exec playwright install chromium`), `pnpm sim board --seed <s>`, `pnpm sim run …`, `pnpm sim replay <log>`, `pnpm serve` (game + server on port 8787 for Wi-Fi play), `pnpm dev:online` (Vite dev server against a local Worker), `pnpm deploy:cloudflare` (the user's step only).
- **pnpm settings:** `pnpm-workspace.yaml` sets `allowBuilds` for `esbuild` (Vite needs it), `workerd` and `sharp` (wrangler's runtime) and a `minimumReleaseAgeExclude` list. A very new dependency release can be refused until it ages; add an exclusion only when one is needed.
- **Engine API** (`@laddorious/core`):
  - `createMatch`, `step(state, input) → { state, events }`, `awaiting`, `viewFor`, `eventsFor` and `hashState`.
  - Errors are `ConfigError`, `InvariantError` and `InputErrorCode`.
  - Useful types are `PlayerView`, `GameEvent`, `ChallengeChoice`, `Awaiting` and `PlayerId`.
  - The engine reads no clock and no unseeded randomness; lint bans `Date`, `performance` and `Math.random` in `packages/core/src`.
  - Since the polish pass: the card window is 30 s; a hand never holds the same card twice (`drawCard` takes an exclude list, `Offer.seen` records what a hand showed); the board generator is version 3 and keeps snake lanes `LANE_CLEARANCE` apart, measured on `laneCenterline` from `board/layout.ts`, the same curve the client draws (`lanesTouch` is the fast check).
- **Match host** (`@laddorious/host`): `MatchHost` runs one match for any mix of humans and bots (`create`, `action`, `playbackDone`, `setAway`, `resync`, `pause`/`resume`, `stop`, `onEnd`), plus `PausableTimers`, `FAST`, `buildSeats`, `randomHex` and the wire protocol (`PROTOCOL_VERSION`, `LobbyIn/Out`, `MatchIn/Out`). The client's offline worker (`src/worker/localHost.ts`) is a thin adapter onto it.
- **Server** (`apps/server`, a Cloudflare Worker): `LobbyCore` (`src/lobby.ts`) and `MatchRoom` (`src/room.ts`) are plain classes tested in Node with fake sockets; `LobbyDO`/`MatchDO` are thin Durable Object wrappers; `src/validate.ts` checks every frame (8 KB, 30 a second, field ranges). `wrangler.toml` pins `compatibility_date = "2026-10-01"`; `wrangler` is 4.148.0. `pnpm --filter @laddorious/server exec wrangler deploy --dry-run --outdir .wrangler/dry-run` bundles without an account.
- **Online client:** `src/service/onlineMatchService.ts` (lobby socket, `serverUrl`, `rejoin`), `onlineSession.ts` (match socket, clock offset, backoff reconnect), `savedSeat.ts` (the seat in `sessionStorage`), `hud/presence.ts` (toasts). `VITE_SERVER` picks online (`same-origin` or `ws(s)://…`) or offline (unset) at build time.
- **Bots** (`@laddorious/bots`): `RandomBot`, `HeuristicBot`, `makeBots(seats, policy, seed, afkPercent)` and `scoreCard`. They are browser-safe.
- **Client tests and lint:** component tests start with `// @vitest-environment jsdom`; every other test runs in Node. React and React Hooks rules come from `@eslint-react/eslint-plugin` (`eslint-plugin-react` stops at ESLint 9). jsdom stays on 29 while this machine's Node is 24.14 (jsdom 30 needs 24.15). The local, untracked `.claude/launch.json` has `client` (dev server), `client-build` (serves `dist`), `server` (`wrangler dev` on 8787 with the current `dist`) and `online` (`pnpm serve`) entries for the preview pane. When the browser pane is hidden, pointer clicks can't land; drive two-tab online checks through the DOM.
- **Director:** `src/director/` is plain TypeScript (presentation state, beat timelines, the `Director` on a `zustand/vanilla` store). Its whole-match test plays a real match through the director and fails on any presentation drift, so run it after changing beat or presentation rules.
- **Polish pass client parts:** `src/hud/CenterDie.tsx` (my roll in the centre), `src/hud/bubbles.ts` (card bubble lifetimes; `PlayerColumn.tsx` draws each as one line beside the player's row, with `CARD_SUMMARIES` from `labels.ts`), `src/hud/ranks.ts` and the `ranks` beat in `director/beats.ts` (the ranks reveal; the director doesn't log it twice and `bannerFor` skips it).
- **Screens:** `src/app/App.tsx` routes the screens; `src/hud/model.ts`, `labels.ts`, `record.ts` and `feed.ts` are the pure HUD model; `test/tokens.test.ts` fails on any colour outside `src/app/theme.ts` and `theme.css`; `test/support/scripted.ts` drives matchmaking and sessions in component tests.
- **Scene:** `src/scene/` holds the 3D scene. Rules are pure and unit-tested (`layout.ts`, `quality.ts`, `motion.ts`, `camera.ts`); the components read the director's store once per frame. `test/scene.test.tsx` renders the scene graph with `@react-three/test-renderer` and fails above 100 draw calls or 150k triangles, so run it after adding anything to the scene.
- **e2e:** `apps/client/e2e/game.spec.ts` and `apps/client/playwright.config.ts`. `pnpm e2e` builds with `vite build --mode e2e` into `apps/client/dist-e2e` and serves it on port 4180. Only that build has `window.__laddoriousTest` (`src/app/testMode.ts`): the host plays every seat with short windows (`FAST` in `packages/host/src/matchHost.ts`), and director beats run at 5% (`timeScale`). The `online` project (`e2e/online.spec.ts`) builds with `VITE_SERVER=same-origin` into `apps/client/dist-online-e2e` and serves it with `wrangler dev` on port 8788 with `FAST=1`.
- **CI:** `.github/workflows/ci.yml` has a `check` job (typecheck, lint, test, build) and an `e2e` job (Playwright Chromium, traces uploaded on failure).
- **Environment:** Windows 11. Both PowerShell and Git Bash are available. The repo is at `E:\AI Project\laddorious`.
- **Superpowers ledger:** executing-plans keeps its ledger at `.superpowers/sdd/<plan-basename>/progress.md` (scratch, not committed). Delete it when a phase finishes.

## Reference material

- **Mockups** are private to the user and can be read with the Artifact tool (`action: "read"`):
  - In-match HUD: <https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR>. Use it for layout and behaviour only; its colours predate the palette.
  - Main menu and matchmaking: <https://claude.ai/artifact/7FTpDqWjPR5RFtW7ai6BJt>. Use the "Tangerine Dusk" tab.
  - Ignore <https://claude.ai/artifact/Wni8KFMBGKAWpHjXubnVMo> (abandoned art directions).
- **Project memory** (loaded automatically in this project): `no-subagents`, `no-bonus-roll`, `client-platform`, `client-visual-direction`, `blender-for-3d-objects`, `multiplayer-lan-testing`, `hosting-cloudflare`, `sound-design-spec3`, `future-board-themes`, `continue-through-phase-6`, `phase5-prototype-method`, `handoff`.
- **Full transcript of the previous session**, for exact wording of past decisions: `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\eadbf1bc-7371-4ee6-ba92-8fb27d38fa24.jsonl`.

## Open items

- **Blender:** on 2026-10-04 the user okayed using it to make the client's 3D objects (memory `blender-for-3d-objects`). On 2026-10-09 a build run inside the user's open Blender (through the MCP link) crashed it; the bug is fixed (`art/lib/export.py` kept the scene graph's copies of materials), and since then every build and preview runs headless (`pnpm art`, `blender --background --factory-startup --python art/preview.py -- out.png ids`), never in the user's Blender.
- **Deferred Phase 4 minors** (from the self-review; not fixed):
  - The crown is placed at tile 100 directly (`src/scene/Surroundings.tsx`), not at the board's last tile.
  - `webglAvailable()` (`src/scene/MatchScene.tsx`) never releases its probe context.
  - Textures and geometries built with `useMemo` in the scene (chevrons, swirl, die atlas, sky, piece and die geometries) are not disposed on unmount; only the board overlay and slide ribbons are.
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
- **Deferred Spec #3 minors** (from the self-review; not fixed):
  - Dev builds only: React StrictMode runs effects twice, so the card-fan (C1) and MATCH FOUND / countdown (Q2, Q3) sounds play twice in dev; production plays them once.
  - Music changes fade out then in (0.4 s + 0.8 s) rather than overlapping, since Tone has one transport.
  - The in-game sounds weren't listened to after integration (Claude can't hear); they're a straight port of the approved board, checked by tests, the e2e sound check and a dev-build run with no warnings. Worth a listen on a phone.
- **Deferred Spec #4 minors** (from the self-review; not fixed):
  - The lobby socket has no silence check: a half-open lobby socket freezes the overlay's clock, and its seat becomes an away seat once someone calls in bots.
  - A duplicated browser tab copies `sessionStorage`, so the two tabs take the same seat from each other in a loop.
  - A match that fails to start shows the server's raw error text in the unreachable overlay.
  - A session that never connected at all ends with "The match carried on without you" after 60 s.
  - The Away badge and the "Reconnecting…" pill were checked through the DOM only (the browser pane was hidden); worth a look on a phone.
- **Deferred Spec #5 Step 1 minors** (from the self-review; not fixed):
  - Sculpted models don't rebuild byte for byte (Blender's SDF nodes differ at float level), so `pnpm art` with no ids rewrites every sculpted file; rebuild only the models you change.
  - A match entered without the menu (a resumed online seat) hasn't preloaded the models, so they pop in from the stand-ins once.
  - The online e2e tests don't check for slot warnings; the offline whole-match test does.
- **Deferred Spec #5 Step 2 minors** (from the self-review; not fixed):
  - Opening a match compiles every shader in its first frame: one 15 s task on a fresh browser under SwiftShader (the same on `main` since Step 1), a short hitch on a phone. `renderer.compileAsync` during the MATCH FOUND countdown would spread it. The e2e tests now wait 60 s for the match screen.
  - The shadow stand-ins are also drawn, unseen, in the main pass: one extra draw call per piece, die and crown.
  - `useSlotMesh` clones the prepared materials on each quality change and never disposes the copies.
  - The vortex's spiral ridges show small kinks close up (about 20° of turn per ring).
  - A match entered without the menu hasn't preloaded the board's models either, so they pop in from the stand-ins once.
  - The whirlpool and splat stay within radius 0.43 (the lane clearance rule), so the whirlpool's symbol is a little smaller than the approved mockup's.
  - A card that removes a jump can change the style of a later jump that had collided with it in the pair assignment (rare).
  - The crown has no Low file: thinned to 30% it lost its points, so it stays one 6,000-triangle model on Low.
- **Spec #4 follow-ups the spec left out:** Durable Object hibernation with alarms if traffic grows, private rooms, saving matches across restarts (M8, M9, §11).
- **Spec #5** (Blender art pass): design approved (`docs/superpowers/specs/2026-10-09-art-pass-design.md`), one plan per step: `docs/superpowers/plans/2026-10-09-art-pass-step1.md` (pipeline and pieces, merged), `-step2.md` (the board, awaiting review), `-step3.md` (the world, next). Each step ends with the user's review in the game.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), particles.
