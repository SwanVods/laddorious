# Laddorious — Spec #2: 3D Client (Menu, Matchmaking UI, Match vs Bots)

- **Date:** 2026-10-04
- **Status:** Approved
- **Builds on:** [Spec #1](2026-10-03-game-core-design.md) (engine, generator, simulator) and its [bonus-roll amendment](2026-10-04-remove-bonus-roll-design.md)
- **Mockups** (private to the owner): in-match screen <https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR> (layout and behaviour; its colours predate the palette), main menu and matchmaking <https://claude.ai/artifact/7FTpDqWjPR5RFtW7ai6BJt> (use the "Tangerine Dusk" tab)

---

## 1. Context

### 1.1 What this spec delivers

A playable 3D client for Laddorious that runs in desktop browsers and in landscape on phone browsers:

1. A main menu with a guest profile and piece choice.
2. A matchmaking screen whose "Play with bots" fallback starts a match.
3. A full 4-player match against the simulator's heuristic bots, running on the unchanged engine.
4. An end screen.

The client is built phone-ready, because native mobile apps will later be produced from the same code with Capacitor.

### 1.2 Roadmap after this spec

*Renumbered 2026-10-08 at the user's request: Spec #3 is now **sound design**, the multiplayer server is **Spec #4** and the Blender art pass is **Spec #5**. The rest of this spec keeps the original numbers (server = #3, art = #4).*

| # | Spec | What |
|---|---|---|
| 2 | **this spec** | 3D client, menu, matchmaking UI, local bot matches |
| 3 | later | Multiplayer server: matchmaking queue, rooms, server-side engine, network play. Implements the online `MatchService` from §4.3. |
| 4 | later | Blender art pass: pieces, die, pads, vortex, crown and island as `.glb` files that drop into the asset slots (§6.3) |
| — | later | Capacitor packaging and store builds; card catalogue (sub-project c); sound and particles |

### 1.3 Non-goals

- Real matchmaking, rooms and online play (Spec #3).
- Accounts, friends and login: nicknames are guest-only.
- Capacitor packaging and store builds.
- Sound, particle polish, Blender models and new cards.
- Engine rule changes. The engine is used as it is.

---

## 2. Decision log

| # | Topic | Decision |
|---|---|---|
| C1 | Technology | Web client: TypeScript, Vite, React, React Three Fiber (three.js), drei. Unity and Godot were rejected because both need the engine rewritten and two rule sets kept in sync. |
| C2 | Mobile | Phone-ready now: touch first, landscape, a phone performance budget. iOS and Android apps come later from the same build via Capacitor. |
| C3 | Client architecture | The event "director": engine events become a timeline of animation beats played on a separate presentation state, which snaps to the engine's view at the end. |
| C4 | Engine location | The engine and bots run in a Web Worker behind a `MatchService` interface that mirrors the future server. |
| C5 | Repository layout | `apps/` holds deployables (`client`, `sim`, later `server`); `packages/` holds libraries (`core`, `bots`). |
| C6 | Bots | `RandomBot` and `HeuristicBot` move from `sim` into a new `@laddorious/bots` package that the client, sim and future server share. |
| C7 | Matchmaking in this spec | The full UI ships, and the local service never finds a real player. "Play with bots" appears after 15 s and fills the empty seats. |
| C8 | Match size | The queue is for 4-player matches; a bot match is you plus 3 bots. |
| C9 | Profile | A guest nickname (default `Guest` + 4 digits, 1–16 characters) and a piece choice, both saved in `localStorage`. |
| C10 | Visual direction | Board-game pieces (knight, pawn, meeple, dragon head) in glossy plastic; classic multicoloured board; purple "?" squares; flat dark vacuum slides; launch pads. A chunky, outlined, toy-like UI (Lilita One + Fredoka) with bouncy motion, in an original palette (C16), not Fall Guys' pastel candy colours. |
| C16 | Palette | **Tangerine Dusk** (§7.4): teal sky melting into apricot, tangerine primary action, mint highlights, coral for your piece. Chosen over Lagoon Lime and Berry Forest. |
| C17 | The animations, against the mockup (amended 2026-10-14) | **Turning:** flips, wobbles and the idle sway turn an inner layer about the piece's own side axis, which the camera sees side-on (pieces face along their rows). **Hops:** each eases in and out along the ground and lands with a short squash; the hop up onto a stack is slower (1.4 times) and higher. **Nothing overlaps:** pieces stand by their measured sizes (`assets/pieceSizes.ts`, checked against the models): a stacked piece sits on the head of the one below; a face-off pair stands nose to nose with a small gap, three-quarters toward the camera; three or four stand in a ring; on a rocket's or flag's tile pieces stand a little toward the camera, clear of the end in its corner. **Face-off:** my face-off opens on the collision (COLLISION!, the pieces still stacked), then the top piece hops down beside the other; after a win the loser backflips away (1.8 high) and lands with a squash, then the winner settles. **Camera:** it follows each player's slide, launch, dodge and knock-back (a knock-back I won stays on me). **Pauses:** 0.7 s after the last die roll, dice still up, and 0.6 s after each card and its moves; a pause holds the moment before it on screen. | The user, 2026-10-14: the wobble, stacking and face-off "worse than from the artifact"; no overlapping; the camera following each resolution; ease in and out; pauses after the last roll and after each card. |
| C18 | Adjustments (amended 2026-10-15) | **Admin settings:** `public/tuning.json`, read at startup and checked value by value (a bad or missing value keeps its default), holds the camera distances, zoom limits and easing, the beat timings and HUD options (the client README lists every key). **Camera:** after the last roll it reaches my piece sooner (a 0.4 s pause, easing 3.2); while others face off and I don't, it frames their tile; the overview starts 15% closer and zooms by mouse wheel or pinch, within limits. **Phones:** the card bubbles and the bottom card queue give way to a compact list under the action log. **Full screen:** a round button in the menu and in matches, where the browser allows it. | The user, 2026-10-15. |
| C11 | Decision UI | Face-off and card pick are centred popups over a dimmed board with no panel behind them, shown only to involved players. Everyone else sees a waiting pill. The card pick mirrors TFT augments. |
| C12 | Camera | Whole board while everyone rolls; follows your own piece while moves and cards resolve; swoops only for your own moments. |
| C13 | Timers vs animation | Window countdowns start only after the client reports that playback has finished (`playbackDone`), capped at 12 s. |
| C14 | Pausing | A local bot match pauses while the page is hidden and resumes on return. |
| C15 | Docs | Root README plus READMEs for `apps/client`, `packages/core` and `packages/bots`, covering maintenance and deployment. |
| C16 | The user's known issues (amended 2026-10-14) | **Cards:** they resolve one at a time, last place first (spec #1 D22); each card's beat opens with a 450 ms lead-in while the camera frames its caster, or the caster and its target, then its effect plays and the camera follows any piece it moves. The card-pick popup closes once cards resolve. **Face-off:** my own face-off plays its FACE-OFF! intro alone (1.5 s), then the pick popup; at the result the popup shows both picks for a second, closes, and only then YOU WIN / YOU LOSE / DRAW shows. A face-off lasts until its loser is knocked back, so the pieces hold their spots through the result; the loser backflips away and the winner settles in the middle of the tile. **Stacking:** a piece that lands on another wobbles for 0.8 s and the one under it squashes once. **Peek at the board** shows the overview. **HUD:** four smaller feed lines; no icon for an idle player (the eye went); a tag hides while its piece's die shows; the player column starts lower, clear of the round buttons. **Menu:** the arrows alone choose the piece, named on the plate; a chunky stroked gear; the Sound switch is on while sound plays. **Sound:** every tap or key wakes the audio once Tone is loaded, so a slow first load no longer leaves it silent. | The user's "Known issues" list, 2026-10-14. |

---

## 3. Repository layout

```
apps/
  client/            NEW   Vite + React + React Three Fiber
  sim/               MOVED from packages/sim (simulator CLI, unchanged apart from importing @laddorious/bots)
packages/
  core/              unchanged rules engine
  bots/              NEW   RandomBot, HeuristicBot, makeBots, scoreCard (moved from sim, with their tests)
docs/
```

- `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
- Root scripts keep working: `pnpm test`, `pnpm typecheck` and `pnpm lint` cover every package. `pnpm sim …` points at `apps/sim`. New scripts: `pnpm dev` (client dev server), `pnpm build` (client production build) and `pnpm e2e` (Playwright).
- `vitest.config.ts` includes `apps/*/test/**` and `packages/*/test/**`. The client's component tests run in a jsdom environment.
- ESLint adds React and React Hooks rules for `apps/client`. The determinism rules stay scoped to `packages/core`.
- `apps/server` arrives in Spec #3 and follows the same pattern.

### 3.1 How each part deploys

| Part | Build output | Deploy target |
|---|---|---|
| `apps/client` | Static files (`vite build` → `apps/client/dist`) | Any static host or CDN. The README documents Cloudflare Pages step by step, with notes for Netlify and Vercel. Capacitor later wraps the same `dist`. |
| `apps/sim` | Run from source with `tsx` | Developer tool; not deployed |
| `packages/core`, `packages/bots` | Nothing on their own | Bundled into whichever app imports them |
| `apps/server` (Spec #3) | One bundled Node program in a Docker image | A host that keeps WebSocket connections open |

---

## 4. Client architecture

### 4.1 Modules (`apps/client/src`)

| Folder | Responsibility |
|---|---|
| `app/` | Screen routing (Menu, Matchmaking, Match, End, Error), profile and settings store, the error boundary |
| `service/` | The `MatchService` interface, `LocalMatchService`, and the worker client that talks to the host |
| `worker/` | `host.worker.ts` entry point and `LocalHost`, a plain class holding the match state, timers and bots, testable without a worker |
| `director/` | Turns engine events into beats; holds the presentation state. Plain TypeScript, no React. |
| `scene/` | React Three Fiber components: board, pieces, dice, slides, pads, crown, island, camera rig, menu podium |
| `assets/` | Asset slot registry: code-built defaults and optional `.glb` overrides |
| `hud/` | Stage bar, event feed, player column, your-piece panel, roll button, waiting pill, popups (face-off, card pick), toasts |
| `ui/` | Shared buttons, dialogs, the rotate screen and the settings dialog |

UI and presentation state use Zustand stores. Engine state lives only in the worker; the client holds the latest `PlayerView`.

### 4.2 The visibility rule

The client only ever receives what a remote player would receive: `viewFor(state, me)` and `eventsFor(events, me)`. Hidden Mystery hands, other players' picks and locked card targets never reach the main thread. The secret RNG seed never leaves the worker. This makes the Spec #3 online service a drop-in replacement.

### 4.3 MatchService interface

```ts
type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

interface Profile { nickname: string; piece: PieceId }

interface SeatInfo { playerId: PlayerId; nickname: string; piece: PieceId; color: string; bot: boolean }

type MatchmakingState =
  | { kind: 'searching'; elapsedMs: number; seats: Array<SeatInfo | null> }   // index 0 = you
  | { kind: 'filling'; seats: Array<SeatInfo | null> }                      // bots taking empty seats
  | { kind: 'found'; session: MatchSession }
  | { kind: 'cancelled' };

interface MatchService {
  findMatch(profile: Profile): Matchmaking;
}

interface Matchmaking {
  onState(cb: (s: MatchmakingState) => void): () => void;
  cancel(): void;          // ignored once filling has started
  playWithBots(): void;    // ignored unless searching; idempotent
}

type PlayerAction =
  | { type: 'roll' }
  | { type: 'challengePick'; challengeId: string; choice: ChallengeChoice }
  | { type: 'reroll'; slot: number }
  | { type: 'pickCard'; slot: number };

interface MatchUpdate {
  view: PlayerView;                 // viewFor(state, me) after this step
  events: GameEvent[];              // eventsFor(events, me) produced by this step
  timer: { windowId: number; endsAt: number } | null;   // null while waiting for playback or when no window is open
}

interface MatchSession {
  me: PlayerId;
  seats: SeatInfo[];
  onUpdate(cb: (u: MatchUpdate) => void): () => void;
  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void;
  onFailed(cb: (e: { message: string }) => void): () => void;
  send(action: PlayerAction): void;       // the session stamps the current windowId
  playbackDone(windowId: number): void;
  pause(): void;                          // local only; the online service ignores it
  resume(): void;
  leave(): void;
}
```

### 4.4 Local service and host

- **Matchmaking.** `LocalMatchService.findMatch` emits `searching` about every 250 ms with seat 0 filled and three empty seats. It never finds a real player. `playWithBots()` moves to `filling`, adds bots one seat at a time (≈420 ms apart), then emits `found` with a session.
- **Seats.** Seat 0 is you in coral `#ff5470`. Bots are Mochi (blue `#3b82f6`), Pip (lime `#a3e635`) and Juno (violet `#8b5cf6`), and take the pieces you didn't choose, in picker order.
- **Worker messages** (structured-clone objects):
  - main → worker: `create { seats, seed, rngSeed }`, `action { action, windowId }`, `playbackDone { windowId }`, `pause`, `resume`, `leave`
  - worker → main: `update { update }`, `rejected { error }`, `failed { message }`
- **Seeds.** `seed` and `rngSeed` are separate values from `crypto.getRandomValues`. Dev builds may set the seed from a hidden field on the menu to reproduce a board.
- **Window timing (C13).** After each step that opens a window, the host waits for `playbackDone(windowId)` from the human seat, capped at 12 s. It then starts the countdown (`endsAt = now + awaiting.durationMs`) and sends an update with `timer` set. On expiry it calls `step({ type: 'timeout', windowId })`. A stale `windowId` is impossible by construction, because the host only times the current window.
- **Bots.** When a window's countdown starts, each awaited bot decides after a random 0.6–2.5 s delay, using `HeuristicBot.decide(viewFor(state, bot))`.
- **Rejections.** `step` errors for the human seat go back as `rejected`. The client shows a toast; state is unchanged.
- **Failures.** An exception escaping the host, or an engine `InvariantError`, sends `failed` and stops the host.
- **Pause (C14).** `pause()` freezes the remaining countdown and all bot timers. `resume()` restores them. The client calls these on `visibilitychange`.

---

## 5. Director, presentation state and camera

### 5.1 Beats

Each `MatchUpdate` is turned into a timeline of beats, played in order. Simultaneous moves share a beat. Durations are starting values, tuned during implementation.

| Engine event | Beat |
|---|---|
| `DieRolled` | 3D die tumbles above the piece, then settles on the face (≈0.9 s); forced faces flash. Your own die also tumbles big in the centre of the screen and stays ≈1.85 s *(polish pass, 2026-10-08)* |
| `DiceTotaled` | Total shown in the player column; no wait. When a card makes your total differ from your face, "Move N" shows in the centre *(polish pass)* |
| `Moved` (dice) | Tile-by-tile hops, all movers together (≈0.23 s per tile + 0.07 s landing). A piece landing on an occupied tile stands on top of the stack and wobbles. |
| `Moved` (snake) | Vacuum: the piece is sucked into the vortex, a glowing orb travels the chute, the piece pops out at the tail (≈2.0 s) |
| `Moved` (ladder) | Launch-pad arc with a somersault (≈1.3 s) |
| `Moved` (knockback) | Backflip fling to the new tile (≈0.85 s) |
| `Moved` (card) | Hops, or one big leap for absolute moves (≈0.8 s) |
| `Moved` (stepBack) | Short shuffle back, one tile at a time (≈0.3 s per tile) |
| `SnakeBlocked` | Shield flash at the vortex; the piece stays (≈0.6 s) |
| `ChallengeStarted` | Stack splits into side-by-side pieces facing each other (≈0.5 s); the face-off popup opens for participants, a waiting pill for everyone else |
| `ChallengePickLocked` | Lock badge on that player; no wait |
| `ChallengeResolved` | Picks revealed over the portraits, result banner (≈1.1 s); a replay re-opens the popup |
| `MysteryOffered` (private) | Card picker opens for you |
| `CardSelected` | Face-down card chip on that player's row; once all picks are in, the cards flip together (≈1.7 s), and a one-line bubble with the card's gist pops out beside each caster's row in the player column until their card has played out *(polish pass)* |
| `CardResolved` | One beat per card in resolution order (0.9–2 s): projectile, hop, shield, stamp ("Hit", "Blocked", "Fizzled") |
| `Clash` | Clash banner over the affected players |
| `EffectAdded` / `EffectRemoved` / `EffectExpired` | HUD chips update; shield bubble appears or disappears |
| `BoardEdited` / `BoardEditExpired` | Launch pad or slide pops in or out (≈0.6 s) |
| `SafetyCapApplied` | Step-back shuffle |
| `RoundStarted` / `RoundEnded` | Stage bar updates |
| `MatchWon` | Victory sequence (≈3 s), then the ranks reveal over the overview (2nd–4th pop up from last place, ≈2.7 s for four players), then the end screen *(polish pass)* |

### 5.2 Presentation state

- The scene renders a presentation state (positions, stacks, visible effects, board edits) that the beats animate.
- When a timeline ends, the presentation state is replaced by the state derived from `view`. If they differ, the view wins and a dev warning is logged.
- When the last beat of an update finishes, the client calls `playbackDone(windowId)` for the window that update opened.
- If a new update arrives while a timeline is playing, it queues behind it. More than 3 queued updates fast-forward the backlog to the latest view.

### 5.3 Camera rules

- **Dice phase:** overview of the whole board with a gentle drift.
- **Moves and card resolution:** follows your own piece at medium distance.
- **Swoops** only for your own moments: your collision, your slide or launch, cards that target you, your Mystery pick.
- **Watch mode:** tapping a player row follows that player's piece until you tap again or press "Back to my piece".
- **Ranks reveal** *(polish pass)*: the overview, after the winner cam.
- **Reduced motion:** swoops become cuts, and idle wobble and drift stop.

---

## 6. Scene, assets and performance

### 6.1 Board and world (as in the in-match mockup)

- 100 instanced tiles (one draw call) in a serpentine 10×10 grid, 1.6 world units per tile.
- Classic colours repeat diagonally: `#ff5a5f #ffa22e #ffd83b #4fd16a #4a9dff`.
- Tile 100 is gold and has a spinning crown.
- Mystery squares are purple `#8f4dff` with a painted "?" whose colour shows rarity: Common white, Rare cyan `#6ff3ff`, Epic gold `#ffcc33`.
- One transparent overlay texture paints all tile numbers and "?" glyphs.
- When someone lands on a "?" square, it gets a pulsing ring until the Mystery phase ends.
- Slides are flat ribbons with scrolling chevrons, dark `#2a2140` with an ink edge, plus a spinning vortex at the head and an exit ring at the tail. Nothing stands taller than a piece. *(Polish pass, 2026-10-08:)* lanes are 0.30 units wide (an ink edge 0.10 wider), follow core's `laneCenterline`, and never cross: the generator keeps them `LANE_CLEARANCE` apart.
- Launch pads are a disc with chevrons, an instanced dotted arc and a target ring.
- A floating island with instanced bumpers, a few clouds and a gradient sky surround the board.

### 6.2 Pieces

- Knight, pawn, meeple and dragon head, built from extrusions and lathes in glossy clearcoat plastic, in the seat colour, at 1.3 × base scale.
- Animation: squash and stretch on hops, idle bob and sway, stacking and wobble, backflips.

### 6.3 Asset slots

- Slots: `piece.knight`, `piece.pawn`, `piece.meeple`, `piece.dragon`, `die`, `pad`, `slide.vortex`, `crown`, `island`.
- Each slot has a code-built default component and an optional `.glb` URL loaded with drei's `useGLTF` inside Suspense. A load failure falls back to the default and logs a warning.
- **Contract for Spec #4 models:**
  - 1 tile = 1.6 units; origin at the base centre (the feet); forward is +Z; Y up.
  - Pieces under 5k triangles; PBR materials; the colour channel tintable by seat colour (a material named `Seat` gets the player colour).

### 6.4 Quality and budget

| Level | Shadows | Pixel density cap | Other |
|---|---|---|---|
| High | One directional light, 1024 shadow map | 2 | Antialiasing on |
| Low | None; soft blob shadows under pieces | 1.5 | Fewer clouds |
| Auto | Starts Low on phones (coarse pointer and a short screen side under 500 px), High otherwise; steps down to Low if the frame rate averages under 45 fps for 5 s | — | — |

- **Budget:** at most 100 draw calls and 150k visible triangles in a match.
- **Target:** 60 fps on an iPhone 12 or Pixel 6 class phone, never below 30.
- A dev-only overlay shows fps, draw calls and triangles.

---

## 7. Screens, HUD and input

### 7.1 Screens

| Screen | Contents |
|---|---|
| **Main menu** (per the menu mockup) | Your piece turning on a podium among floating board tiles, with your nickname on a plate on the podium's front; profile chip top left (portrait, nickname, tap to rename); "LADDORIOUS / RACE TO 100" logo top centre; settings gear top right; piece picker bottom centre plus arrows beside the podium; PLAY bottom right with a "4-player match" label; rotating rule tips bottom left (hidden when the screen is under 450 px tall) |
| **Matchmaking** (overlay on the menu scene) | "FINDING PLAYERS", elapsed time, four seat slots (you plus searching slots), Cancel. After 15 s, "Play with bots" appears with "Taking a while? Start now and bots take the empty seats." Then the seats fill, "MATCH FOUND!", a 3-2-1 countdown, and the match screen. |
| **Match** | The in-match HUD (§7.2) over the board scene |
| **End** | Final standings on a podium (1st to 4th with pieces and nicknames); Play again (back to matchmaking) and Main menu |
| **Settings** (dialog) | Graphics quality (Auto, Low, High, each with a one-line description and the level currently in use) and Reduced motion |
| **Rotate** | Shown whenever the viewport is portrait: "Turn your phone sideways" |
| **Error** | "Something went wrong in this match", Back to menu, and in dev builds the error text with a copy button |
| **Leave match** (dialog) | Opened from a small menu button on the match screen; leaving a local match ends it and returns to the menu |

### 7.2 Match HUD (per the in-match mockup)

- **Stage bar, top centre, one row:** ROUND n, then an icon per stage (Dice, Move, Face-off, Mystery, Cards). Past stages are green, upcoming ones faint, and only the current stage shows its name. The timer for the open window follows.
- **Event feed, top left:** lines built from events; private lines (your picks, your rerolls) are dashed. It holds 5 lines on desktop and 3 on phones.
- **Player column, right edge, TFT style.** Each row has:
  - a status icon (your turn, waiting, done, pick locked, watching);
  - a name plate with the tile number;
  - a mini row with this round's dice, a "?" chip (on a Mystery square, until a card is picked), effect chips and the card chip (face-down until the reveal, then with a result dot);
  - a portrait of the piece with a rank badge.

  Your row is larger and outlined in the mint highlight. Rows re-sort by tile with a slide animation. Tap a row to watch that piece; long-press (500 ms) or hover on desktop opens the details card.
- **Your-piece panel, bottom left:** tile, rank, "Next roll" modifiers in order, and your effects in full. Collapsible on small screens.
- **Bottom centre:** the ROLL button during your dice window; otherwise the waiting pill ("Waiting for Pip to roll", "Waiting for Mochi and Juno to pick a card"), the move caption, or the card resolution queue (numbered mini cards with stamps).
- **Face-off popup** (participants only, centred, dimmed, no panel): "FACE-OFF!", tile and round, both portraits with lock states and revealed picks, Rock / Paper / Scissors buttons. With 3–4 players the buttons use the challenge's two Minority themes.
- **Card-pick popup** (players on a "?" square only): "Choose One", 3 tall cards framed by rarity, each with type, icon medallion, name, rules text, target line and any fizzle warning; a reroll button under each card; "Peek at the board"; the remaining rerolls. Tapping a card picks it immediately.
- **In-world name tags** above pieces. A piece under a stack has its tag beside the stack.

### 7.3 Layout and input rules

- **Landscape only;** portrait shows the rotate screen.
- **HUD sizes come from viewport height,** using CSS container or viewport units with pixel minimums.
- **Safe areas:** everything stays inside `env(safe-area-inset-*)`.
- **Touch targets:** at least 44 px.
- **Touch first:** tap, long-press and the popups cover every action.
- **Desktop extras:** Space to roll, 1–3 to pick in popups, Esc to close dialogs. These are never required.
- **Fullscreen:** requested on the first tap where supported (Android browsers; skipped on iOS Safari).

### 7.4 Palette and type (Tangerine Dusk)

Every colour is a design token in the client's theme file (`app/theme.ts` for the 3D world, CSS custom properties for the HUD). Nothing else hard-codes colours. The menu mockup's "Tangerine Dusk" tab shows the palette in use.

| Token | Value | Used for |
|---|---|---|
| Sky | `#0b4a5a` → `#2f8f8a` → `#ffc184` (top → horizon); fog `#ffc79a` | 3D background and fog |
| Ink | `#0f2e36` | Outlines, button borders, dark text |
| Plate | `rgba(9,38,45,.86)` | Translucent chips: feed lines, profile chip, picker tray, waiting pills |
| Paper | `#fff7ec` (alternate `#e2f3ee`) | Light panels, buttons, piece tiles |
| Muted / sub-text | `#46707a` on paper, `#a8d0d2` on plate | Secondary text |
| Highlight | mint `#5ff0c5` | Selected piece, name plates, current stage, timers, the outline on your player row and name tag |
| Primary action | tangerine `#ff7a1a` (hover `#ff9140`), ink text | PLAY and ROLL |
| Accent | coral `#ff5470` | "Play with bots", secondary calls to action, your piece and portrait |
| Panel header | `#147676` | Settings and dialog title bars |
| Dimmed backdrop | `rgba(5,30,36,.5)` → `rgba(5,30,36,.86)` | Behind popups and dialogs |
| Podium | top `#fff3e3`, band `#ff9a3d`, base `#147676`, ring `#ff5470`, island `#0f5d63` / `#ffb070` | Menu podium |
| Seats | you `#ff5470`; bots `#3b82f6`, `#a3e635`, `#8b5cf6` | Pieces, portraits, name tags |
| Board | squares `#ff5a5f #ffa22e #ffd83b #4fd16a #4a9dff`; "?" squares `#8f4dff` | Unchanged from §6.1 |

**Type:** Lilita One for display text (titles, buttons, names, numbers) and Fredoka for body text, both from Google Fonts with system fallbacks. Display text uses the ink outline (a multi-direction text shadow) like the mockups.

---

## 8. Error handling and edge cases

| Situation | Behaviour |
|---|---|
| Rejected action (stale or double tap) | Toast, e.g. "Too late, that window closed"; state unchanged |
| Host exception or engine `InvariantError` | `failed` → Error screen → Back to menu |
| WebGL unavailable | A message replaces the canvas: "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox." |
| WebGL context lost | Try to restore; if that fails, show the WebGL message |
| `.glb` slot fails to load | Code-built default plus a warning |
| `localStorage` blocked | Profile and settings kept in memory for the session |
| Page hidden mid-match | Local match pauses; resumes on return |
| Cancel during `filling`, double "Play with bots" | Ignored; one match starts |
| Update backlog over 3 | Fast-forward to the latest view (§5.2) |
| Presentation differs from the view after a timeline | View wins; dev warning |

---

## 9. Testing

### 9.1 Unit tests (Vitest)

- **Director:** event lists in, beat timelines out. Covers simultaneous dice moves; stacking on an occupied tile; the chain dice move → slide → collision → knockback onto a slide; `SnakeBlocked`; private events (`MysteryOffered` only for its owner); card resolution order; the `MatchWon` sequence.
- **`LocalHost`, a plain class with fake timers:**
  - Sessions only receive `viewFor` and `eventsFor` output; no other player's hand or locked target ever appears in an update.
  - The countdown starts only after `playbackDone`, or after the 12 s cap.
  - Bots act within their delay window.
  - Expiry sends `timeout` and the match advances.
  - `pause` and `resume` freeze and restore timers.
  - Rejected actions produce `rejected` and leave the state unchanged.
  - A host exception produces `failed`.
- **`LocalMatchService`:** `searching` updates; "Play with bots" fills three seats with the unused pieces; cancel and double-press races.
- **Profile and settings store:** defaults, nickname rules (trimmed, 1–16 characters), blocked storage.
- **Quality:** Auto's starting level from pointer and screen size, and the step-down rule.

### 9.2 Component tests (React Testing Library, jsdom)

- **Player column:** dice, "?" chip, effect chips, face-down and revealed card chips, rank order.
- **Popups:** the face-off popup renders only for participants; the card picker only for the offer's owner; reroll buttons disable after use and at the limit.
- **Waiting pill:** names the players still acting.
- **Settings:** changes are saved.

### 9.3 End-to-end tests (Playwright)

- **Projects:** desktop Chromium, plus emulated landscape iPhone 12 and Pixel 7.
- **Flow:** menu → PLAY → (clock advanced) Play with bots → a full match to the end screen → Play again → matchmaking.
- **Portrait:** the viewport shows the rotate screen.
- **Test hook:** `window.__laddoriousTest`, compiled only into test builds, speeds up animations, auto-picks for the human seat and shortens windows, so a full match runs in seconds.
- **Performance check:** during a match, `renderer.info.render.calls` stays at or under 100.

### 9.4 Manual phone check

The client README holds a short checklist for a real phone over local Wi-Fi: frame rate on Auto and Low, notch and home-bar clearance, the 44 px targets, rotation and pause on lock.

### 9.5 CI

GitHub Actions keeps typecheck, lint and test (now covering `apps/*`), and adds the client production build and the Playwright run in Chromium.

---

## 10. Documentation deliverables

- **`README.md` (root):**
  - what Laddorious is and the repo map (`apps/` vs `packages/`);
  - setup (Node 24, pnpm) and every script;
  - how the apps and libraries relate, and the visibility rule;
  - changing rules safely: engine tests, golden snapshots (`vitest -u` only for intended changes), the simulator;
  - CI;
  - where specs and plans live.
- **`apps/client/README.md`:**
  - local development and building;
  - deploying `dist` to Cloudflare Pages step by step, with notes for Netlify and Vercel;
  - testing on a real phone over Wi-Fi, and the manual phone checklist;
  - how asset slots work and how to drop in a `.glb` file;
  - the dev overlay and the seed field.
- **`packages/core/README.md` and `packages/bots/README.md`:** what each package exports and its rules (core determinism, bot policies).

---

## 11. Open items for later specs

- **Spec #3 (server):** online `MatchService`; what happens when a player leaves or disconnects mid-match (bot takeover, reconnect window); server-side timers with every player's `playbackDone`, capped at 12 s; anti-cheat.
- **Spec #4 (art):** models per the asset slot contract in §6.3.
- **Capacitor:** app shell, icons, splash screen, orientation lock, store builds.
- **Accessibility:** a non-colour cue for "?" rarity; text size options.
- **Bot difficulty levels** and nicer bot names.
