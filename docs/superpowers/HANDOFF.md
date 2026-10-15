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

After Spec #4 the full suite is 76 test files, 597 tests, all passing, and `pnpm e2e` passes 11 Playwright tests (about 6 minutes): 3 tests × 3 offline projects, and 2 two-player tests in the `online` project against `wrangler dev` (the server's real 15 s bot offer makes them slower). The whole-match test also checks that sound started, played and recorded no errors. 1,000 simulated four-player matches take about 8 s (spec #1's target is under 10 s); the median match is 21 rounds. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (Vite warns about the three.js chunk size). (Since 2026-10-15 the repo is on GitHub and CI runs: see the open-items batch below.)

On `art/board-theme` (2026-10-15): 97 test files and 939 tests pass; `pnpm e2e` passes 16 of 17, the online away test flaking as below. Before that, on `fix/adjustments`: 95 test files and 896 tests pass, and `pnpm e2e` passes all 17 (about 10 minutes); the online away test can still flake, for the reason in Open items. A busy match stays under 150,000 triangles on High and 100,000 on Low (`art/test/budget.test.ts`).

## Next step: after the board theme

The adjustments were approved and merged to `main` (2026-10-15). The board theme's design step came next.
- The user picked the **Sky Course** from three 3D directions (<https://claude.ai/artifact/W5hpRymv44SgtJGrjAqj78>), adding:
  - bigger squares with wider gaps;
  - TFT-style props on the platform's wings;
  - a fixed camera that pans only when zoomed in.
- The spec is `docs/superpowers/specs/2026-10-15-board-theme-design.md`. It replaces Spec #5 §4.3 and plan 3.
- **Built** on branch `art/board-theme` (plan `docs/superpowers/plans/2026-10-15-board-theme.md`, 2026-10-15): 2.3 squares on a 2.5 step (0.2 gaps; narrowed from 2.7 at the user's first review, the platform 10% narrower and the props closer); the overview ×1.25 and never turning; drag to pan when zoomed in (`camera.pan` in tuning.json); the world as placements of Blender models (`scene/world.ts`, `WorldParts.tsx`): the striped inflatable platform, the wings' props, five floating obstacles, stepping pads and clouds; the menu's podium on a little platform. Every model is a headless Blender script (lathed or sculpted). **Approved by the user and merged to `main`** (2026-10-15, `c2ff51b`).
- **Next:** the user's later-fix batch (the notes below and the deferred minors in Open items), or whatever the user brings next.
- **Room left:** a busy match prices at 95 draw calls and 154,914 triangles on High (limit 156,000 since 2026-10-15), 74 calls and 85,598 on Low (under 100,000). The trails' arrowheads are spaced by the board's step. Anything new in the match must come with a trim.
- Every 3D object is a Blender model; the artifact is a preview only (the user, 2026-10-15).

**The deferred batch (2026-10-15), done and merged:** the user's notes and the deferred minors they chose (branch `fix/deferred-batch`, then `main`):
- Low quality: rocket and flag images in the middle of their tile, as big as a "?".
- Reduced motion reduces instead of removing: gentler wobbles, rocket and flag, crown bounce, idle and menu motion, a short die tumble, a gliding camera, short CSS animations.
- Phone card info as little card bubbles under the action log, as wide as the "Your piece" panel.
- The right wing's crown is the finish tile's own crown, three times its size and still; High's triangle limit is now 156,000 (the user's call). A busy match: 95 calls, 154,914 triangles on High; 74 calls, 85,598 on Low.
- Bots pick their card at random (Risky cards get played); the simulator: median 21 rounds, picks even across types.
- Slides never cross lanes, after a card's edit too (a board rule in `boardViolations`); Snake Pit fizzles when no spot is clear.
- The rest: the crown on the board's last tile; freed WebGL probe, textures and material copies; tile numbers in the display font after fonts load; Settings' "Right now" after Auto's step-down; the zoom kept between matches; the shield flare after the projectile lands; 3–4-piece face-offs kept on their square; a match without the menu loads its models; online: lobby silence check, a duplicated tab leaves the seat to the first, plain failure messages; stable pair styles; iPad detection without `navigator.platform`; StrictMode-safe effects; LF snapshots; the online e2e checks model loads.
- **Kept as is, the user's call:** the rotate screen doesn't pause a match; tests needing new scaffolding stay deferred.
- Then the user's next notes (2026-10-15, same branch): every sound and both songs at one loudness (measured offline: about -19 dB momentary, roughly K-weighted; the effects had been 12 dB apart and the music about 13 dB under them), music and effects sliders both default to 80%; a won face-off stays apart until the knock-backs, which wait for every face-off, and the camera moves on to the undecided one; the phone card list stays through the moves cards make (a launch after Sprint). Confirmed: no full-screen button on iPhone Safari (no Fullscreen API there); iPads with Safari 16.4+ show it.

**The open-items batch (2026-10-15), branch `fix/open-items`, awaiting review:** the user said to fix every open item but two (dropped: the pads' rim facets, a Low crown), and to set up CI now the repo is public (<https://github.com/SwanVods/laddorious>; Claude may push CI fixes, feature work waits for review).
- A launching rocket crouches, lifts off with its piece on a flaring flame plume (a new Blender model, `art/models/plume.py`), and lands; the user had asked for "rocket lifts off a little".
- A scene compiles its shaders before its first frame (`scene/compileFirst.tsx`, `compileAsync`, drawing after 15 s at the latest): CI's desktop e2e froze 70 s on the first match frame.
- Shadow stand-ins draw only into the shadow map (`assets/shadowOnly.ts`): a new High match 79 -> 71 calls, 121.9k -> 114.4k triangles; a busy match prices at 86 calls, 151,319 triangles (+ the vortex and plume below).
- The vortex has 13 bowl rings (9° of turn a ring), 1,026 triangles; the whirlpool's eye symbol is 0.40 on a 0.25 cap.
- Rank badges stay in view: after the win a tag whose piece is off screen waits at the screen edge.
- The camera leaves my Mystery pick as soon as I pick (the screen's `pickedWindow`).
- Through hops the camera glides in one eased line at board height instead of bobbing with each hop (`cameraPoint` in `motion.ts`; the user felt sick from the wobble). Simulated on a 6-square hop: vertical travel 0.29 -> 0, speed changes 18.1 -> 1.5.
- Music: the player schedules each song 1.2 s ahead in the audio clock (no Tone transport), songs crossfade over 1.5 s, late notes after a stall are skipped; touch screens ask for `latencyHint: 'playback'` (the user heard stutter on Android Chrome: music and effects, menu too).
- CI (`.github/workflows/ci.yml`): the first run passed `check`; e2e failed on the desktop freeze, the `shots` project (review screenshots needing a GPU, now left out of CI) and the online flake (now skipped on CI).
- Not committed: `apps/client/public/tuning.json` has `zoomMin` 0.7 in the working tree, changed outside these commits (the user's, probably).

**The card catalogue (2026-10-15), branch `feat/card-catalog`, awaiting review** (plan `docs/superpowers/plans/2026-10-15-card-catalog.md`; no spec, the user's choice; catalogue review page <https://claude.ai/artifact/Dq7Bv38pjgthyxvPmu6EzH>):
- Every card lives in `packages/core/src/cards/cards.json`: the user's 66 Excel cards (English names and text, the Indonesian as each card's note) plus Steady Hand and Cleanse kept off; 23 on, 43 drafts, 2 off. Values like 1–6 are picked when a match starts (`${rngSeed}|cardValues`), shown in the view (`cardValues`) and on the cards. Card text is generated from the steps (`describeCard`). Every rarity needs one card on; a type may have none.
- `pnpm cards`: the local card editor (dev server only, never built): list, filters, search, edit fields, values and steps with live checks and a preview, odds, new drafts, duplicate, delete, Save (refuses stale or broken saves; doesn't reload the editor, so a game tab needs a manual reload). Simulate: 1,000 bot matches in a worker (~5 s), per-card stats and flags. First run: Switcheroo strong (47% win rate), Snake Pit fizzles often.
- The shield is a Blender bubble (`art/models/shield.py`, 832 triangles) drawn with an edge-glow shader (`scene/shieldMaterial.ts`): nearly clear face-on, its outline glowing, breathing while up and flashing when it blocks. The user's pick after the first version (a solid bubble with a band) looked like a hamster ball. A busy match on High: about 155,900 of 156,000 triangles — no room left without a trim.
- Merged to local `main` with the shield (`4bef737`); the user pushes.

**Card building blocks 4a (2026-10-15), branch `feat/card-blocks-4a`, awaiting review** (plan `docs/superpowers/plans/2026-10-15-card-blocks-4a.md`, uncommitted like every plan; no spec, the user's choice):
- A card can roll its own die: `{ die: true, negate? }`, allowed in a Move and in "Next roll + / −" only. The engine rolls it once per card (misc stream), after a target is found, and reports it as `CardResolved.roll`; texts start "Roll a die: … that many / that much".
- A card can hit everyone else (`condition 'other', pick 'all'`) or everyone (`condition 'everyone', pick 'all'`), in seat order, each attack shield blocking it for its owner alone. `CardResolved` then has `target: null`, `targets` (hit) and `blocked`. Such a card can't edit the board yet.
- The game shows it: one feed line ("Pip used Earthquake: rolled 4, hit Ana and Bo, Juno blocked it"), "Hit · rolled 4" in the card list, a hop for every hit piece, a shield flash for every blocker, the HIT!/BLOCKED! banner and the full-volume sound for anyone involved.
- The die on screen (2026-10-16, the user's ask): after the camera's lead-in the caster's 3D die tumbles above its piece for `cardRollMs` (tuning.json, 700 ms) and lands on the roll; then the card plays (projectile, hops, shield flash and its sound wait). My own card's roll also shows big in the centre (`CenterDie`), held at least 0.7 s on its face after landing. The feed line and the card list's "Hit · rolled N" still appear as the card's moment starts, before the die lands.
- The editor offers "Use the card's die" on those two fields and the targets "Everyone else" and "Everyone".
- On now: Long Shot, Tumble, Lead Weight, Sand in the Shoe, Earthquake, Retreat!, Forward!, Mud Season, Blizzard, Wind Up — 33 on, 33 drafts, 2 off. Simulate (1,000 four-player bot matches): none of the 10 flagged; Retreat! and Forward! are dealt about twice as often as the others because Misc has fewer cards on and every type is equally likely.
- Gate: 120 test files, 1,087 tests; typecheck, lint, build clean; `pnpm e2e` 16 of 17, the online away test flaking as in Open items (passed on its own rerun).
- Next: batch 4b (its own short plan). Aegis is a draft until 4b (its "snake or attack" shield).

Spec #4 (the multiplayer server) is done and merged to `main` (2026-10-09). Two things are the user's own steps:

- **Try it on the Wi-Fi:** `pnpm serve` builds the game for the local server, starts `wrangler dev` on port 8787 on every network interface, and prints the addresses to open on phones (memory `multiplayer-lan-testing`).
- **Deploy to Cloudflare:** follow `apps/server/README.md` (`wrangler login`, then `pnpm deploy:cloudflare`). Claude never deploys or touches the Cloudflare account (memory `hosting-cloudflare`).

**Spec #5, the Blender art pass,** is under way on branch `art/spec-5`. Step 1 (the pipeline, the seven pieces, the die and the crown) was approved and merged to `main`. Step 2 (the board) has been through five review rounds; the fifth round's requests (above) are built and merged to `main` (2026-10-14); the review page is <https://claude.ai/artifact/Gk8E6V9hf18euZWULr4Sa4>. The user's known-issues list came next (above); the board theme's design step replaces plan 3. **Room for the theme:** a busy match comes to 71 draw calls and about 135,700 triangles on High, 66,300 on Low, which leaves about 14,300 triangles on High and 33,700 on Low; plan 3's world needs about 32,000 at its limits, so its models have to come in well under those limits (the user asked to trim while making things look better by shape and colour).

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
- **Deferred card-catalogue minors** (2026-10-15; not fixed):
  - Card bubbles beside the player rows now show the generated text, which can be longer than the old hand-written one-liners and gets cut off; a short-summary field could come back if it bothers.
  - After a Save in the card editor, an open game tab keeps the old cards until it is reloaded (the dev server skips the hot update so the editor keeps its place).
  - A hand-edited `cards.json` with a mistake stops matches from starting (ConfigError at match creation); the editor never saves one, and `pnpm test` catches it.
  - Simulate always plays four-player matches.
- **Deferred 4a minors** (2026-10-15; not fixed):
  - A hits-everyone card with a Swap step clashes with itself and always fizzles, while its event still lists targets (they'd see HIT!); validation could refuse Swap with "everyone".
  - Bots score a several-player card as if it hit one player (Retreat! looks good to a bot though it moves the bot back too).
  - Simulate's tiles for an Everyone card count the caster's steps up and everyone else's down, so Forward! reads −4.8.
- **Dropped, the user's call (2026-10-15):** the course pads' faceted mint rim and a lighter Low crown stay as they are.
- **Deferred Phase 5 minors** (from the self-review; not fixed):
  - The rotate screen covers the match but doesn't pause it (kept as is: the user's call, 2026-10-15).
- **Deferred Phase 6 minors** (from the self-review; not fixed):
  - e2e builds only: in fast mode ROLL and the popups stay live while a bot plays my seat, so a manual tap can race it and show a rejection toast.
  - e2e builds only: banners (1.7 s) and CSS animations aren't time-scaled; only director beats are.
  - The deploy notes in `apps/client/README.md` were checked against the hosts' docs, not a real deploy.
- **Deferred polish-pass minors** (from the self-review; not fixed):
- **Deferred adjustments minors** (from the self-review; not fixed):
  - The dev server once served a stale `MatchScreen` (an edit landed between two writes) until restarted; nothing in the build.
  - Changing `tuning.json` while a match is open takes effect on the next page load, not mid-match.
- **Deferred known-issues minors** (from the self-review; not fixed):
  - The online e2e test "a player who drops shows as away, and a reload brings them back" is flaky. Cause: e2e bot matches are fast (40-50 s); while B reloads (shader compile included), the match can be won, and the room closes every socket 10 s after a win (`END_LINGER_MS` in `apps/server/src/room.ts`), so A never hears B come back and the Away badge stays. The rejoin itself works. A reliable test needs a match that can't end mid-test (new scaffolding), so it is deferred per the user's rule on multiplayer tests. CI skips it (`test.skip` when `CI` is set); it still runs locally.
  - No browser run caught my own face-off or a landing on a stack during the screenshots; the face-off steps and the wiggle are covered by unit tests.
  - No recording compares the new animations with the mockup: a face-off can't be forced in a real match, and the headless browser draws about 10 fps. A dev-only demo page that plays a scripted stack and face-off would make them easy to check.
- **Deferred Spec #5 Step 2 round 5 minors** (from the self-review; not fixed):
  - In fast e2e builds (beats × 0.05) the 3 s victory beat ends before the crown's 1.2 s flight, so it appears on the head at once; the flight is covered by unit tests, not seen in a browser.
  - The rocket and flag reactions were checked by unit tests only; no browser run caught a bot climbing at the moment of a screenshot.
  - The online "away, then back" e2e test timed out once while other test runs shared the machine (b's away mark stayed past 15 s); it passed when the online tests ran alone. Worth watching for flakiness.
- **Deferred Spec #3 minors** (from the self-review; not fixed):
  - The in-game sounds weren't listened to after integration (Claude can't hear); they're checked by tests, offline loudness measurements (2026-10-15) and the e2e sound check. The new music scheduler and the phone audio buffers (2026-10-15) are untested by ear: worth a listen on the Android phone that stuttered.
- **Deferred Spec #4 minors** (from the self-review; not fixed):
  - The Away badge and the "Reconnecting…" pill were checked through the DOM only (the browser pane was hidden); worth a look on a phone.
- **Deferred Spec #5 Step 1 minors** (from the self-review; not fixed):
  - Sculpted models don't rebuild byte for byte (Blender's SDF nodes differ at float level), so `pnpm art` with no ids rewrites every sculpted file; rebuild only the models you change.
- **Deferred Spec #5 Step 2 minors** (from the self-review; not fixed):
- **Spec #4 follow-ups the spec left out:** Durable Object hibernation with alarms if traffic grows, private rooms, saving matches across restarts (M8, M9, §11).
- **Spec #5** (Blender art pass): design approved (`docs/superpowers/specs/2026-10-09-art-pass-design.md`), one plan per step: `docs/superpowers/plans/2026-10-09-art-pass-step1.md` (pipeline and pieces, merged), `-step2.md` (the board, awaiting review), `-step3.md` (the world, next). Each step ends with the user's review in the game.
- **Later:** Capacitor packaging, the card catalogue (including the "roll again if your die shows n" card), particles.
