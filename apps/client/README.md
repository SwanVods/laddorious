# @laddorious/client

The Laddorious web client:

- the main menu, with your piece on a podium;
- matchmaking with real players when online, or bots; "Play with bots" appears after 15 s;
- private rooms when online: Play with friends creates a room with a 4-letter code (or a `?room=CODE` link), friends join with it, and the room's host starts the match, bots taking any empty seats;
- a 4-player match in 3D with the full HUD;
- the end screen.

It runs in desktop browsers and in landscape on phones; Capacitor builds for iOS and Android come later.

## Local development

From the repository root:

```bash
pnpm install
pnpm dev     # http://localhost:5173
pnpm build   # production build into apps/client/dist
pnpm --filter @laddorious/client preview   # serve apps/client/dist on http://localhost:4173
```

Dev builds (`pnpm dev`) add two things:

- **The stats overlay** in a match: frames per second, draw calls and triangles.
- **The board seed field** on the main menu, under the settings gear. A seed reproduces a board; the dice stay random.

## Playing online

`VITE_SERVER`, read at build time, picks where matches run:

| Value | What happens |
|---|---|
| unset | Offline only: the engine and bots run in a Web Worker. `pnpm dev` and `pnpm build` work this way. |
| `same-origin` | Online, against the Worker that served the page. `pnpm serve` and `pnpm deploy:cloudflare` build this way. |
| `ws://…` or `wss://…` | Online, against that server: for hosting the game on Pages or Netlify while the Worker runs elsewhere. |

Online builds keep the offline bots as a fallback. If the server can't be reached within 5 s, matchmaking offers **Try again** and **Play offline with bots**. A reload during a match rejoins it: the seat is kept in the tab's `sessionStorage`, and the server holds it for 60 s after a drop. See [apps/server/README.md](../server/README.md) for running the server.

## Where things are (`src/`)

| Folder | What it holds |
|---|---|
| `app/` | The app shell and routing (`App.tsx`), the screens (menu, matchmaking, match, end, error, settings), the profile and settings store (`prefs.ts`), and the design tokens (`theme.ts` for the 3D world, `theme.css` for the HUD) |
| `service/` | The `MatchService` interface, the local service and the worker session |
| `worker/` | The Web Worker host: the engine, the timers and the bots |
| `director/` | Turns engine events into animation beats on a presentation state |
| `scene/` | React Three Fiber: the board, pieces, slides, launch pads, camera, menu podium, name tags |
| `assets/` | Asset slots: the code-built stand-ins, the Blender model list (`slotFiles.ts`) and their loading |
| `hud/` | The match HUD: a pure model (`model.ts`, `labels.ts`, `record.ts`, `feed.ts`) and its components |
| `ui/` | Shared pieces: icons, portraits, dialogs, toasts, the rotate screen |

Every colour is a token in `app/theme.ts` or `app/theme.css`, and `test/tokens.test.ts` fails on a colour written anywhere else.

## Deploying

These steps host the offline game. For online play, deploy the Worker instead, which serves the game too: see [apps/server/README.md](../server/README.md).

The build is static files in `apps/client/dist` (HTML, JS, the worker script and assets). There is no server and no client-side routing, so no rewrite rules are needed.

### Cloudflare Pages, step by step

1. Push the repository to GitHub or GitLab.
2. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Connect to Git**, and pick the repository.
3. Set up the build:
   - **Framework preset:** None
   - **Build command:** `pnpm build`
   - **Build output directory:** `apps/client/dist`
   - **Root directory:** leave empty (the repository root)
   - **Environment variables:** `NODE_VERSION` = `24` and `PNPM_VERSION` = `11.5.0`. The build image installs the dependencies itself before the build command, but it doesn't read `packageManager` from `package.json`, so it needs the pnpm version spelled out.
4. **Save and Deploy.** Every push to the production branch deploys, and other branches get preview URLs.

To upload a local build instead, without Git:

```bash
pnpm build
npx wrangler pages deploy apps/client/dist --project-name laddorious
```

### Netlify

New site from Git. Base directory: empty. Build command: `pnpm build`. Publish directory: `apps/client/dist`. Environment variable: `NODE_VERSION` = `24`. Netlify uses Corepack, so it picks up pnpm 11.5.0 from `packageManager`. With the CLI: `netlify deploy --dir apps/client/dist --prod`.

### Vercel

Import the repository with the framework preset **Other**, and leave the root directory empty:

- **Build command:** `pnpm build`
- **Output directory:** `apps/client/dist`
- **Install command:** leave the default
- **Node.js version** (project settings): 24.x
- **Environment variable:** `ENABLE_EXPERIMENTAL_COREPACK` = `1`, so Vercel uses the pnpm version pinned in `packageManager`. Without it, Vercel guesses pnpm 9 or 10 from the lockfile. Don't override the install command with `pnpm install` either: Vercel then uses the oldest pnpm it has.

## Testing on a real phone

Put the phone on the same Wi-Fi as your computer, then:

```bash
pnpm dev --host
```

Open the **Network** address Vite prints (for example `http://192.168.1.20:5173`) on the phone. On Windows, allow Node through the firewall when asked. To try the production build the same way, run `pnpm build`, then `pnpm --filter @laddorious/client preview --host`.

### Manual phone checklist (spec §9.4)

- [ ] **Frame rate:** with Graphics quality on Auto, then on Low (Settings), the stats overlay in a dev build stays near 60 fps and never below 30.
- [ ] **Safe areas:** in landscape both ways, nothing sits under the notch or the home bar.
- [ ] **Touch targets:** ROLL, the face-off choices, the card-pick cards and rerolls, the piece picker and the player rows are easy to hit (44 px or larger).
- [ ] **Rotation:** turning the phone upright shows "Turn your phone sideways", and turning it back returns to the game.
- [ ] **Pause on lock:** locking the phone mid-match pauses the bots and the timers; unlocking resumes them.

## Admin settings (`public/tuning.json`)

The game reads `tuning.json` (served next to the page) when it starts, so an admin can change these without touching the code or rebuilding: edit the file on the server and players get the new values on their next load. A future admin dashboard can write the same file. Every value is checked (`src/app/tuning.ts`); a missing key keeps its default, and a bad value (a wrong type, a negative number, a zoom range that leaves out 1) falls back to its default with one warning in the browser console.

| Key | Default | What it does |
|---|---|---|
| `camera.overview.distance` | 29.3 | How far back the whole-board view sits. |
| `camera.overview.height` | 30.5 | How high it sits. |
| `camera.overview.zoomMin`, `zoomMax` | 0.45, 1.4 | How far a mouse wheel or pinch can zoom the overview (1 = as set; lower is closer). |
| `camera.pan.lockAbove`, `tapSlopPx` | 0.95, 6 | Zoomed in closer than lockAbove, a drag pans the overview over the board; at the overview it stays locked. A press moving more than tapSlopPx pixels is a drag, not a tap. |
| `camera.follow.ease` | 3.2 | How quickly the camera reaches a piece it follows (higher is quicker). |
| `camera.swoop.ease` | 2.8 | The same for the close swoop on my own moments. |
| `camera.close.height`, `back` | 5.8, 7.2 | Every close shot (following a piece, my swoops, a card, the winner) sits this high and this far back: one distance for all. |
| `timing.hopMs` | 230 | Each tile hop, in the air and landing (ms). Hop sounds follow it. |
| `timing.rollPauseMs` | 400 | The pause after the last die roll, before the pieces move (ms). |
| `timing.cardLeadMs` | 450 | Before each card plays, while the camera reaches its player (ms). |
| `timing.cardPauseMs` | 600 | The pause after each card and its moves (ms). |
| `timing.faceOffIntroMs` | 1900 | My own face-off's opening: the collision, then the hop down (ms). |
| `timing.knockbackMs` | 850 | A face-off loser's flight backwards (ms). |
| `timing.endHoldMs` | 1000 | At the end of the moves, the camera holds the last moment this long before going back to the overview (ms). |
| `hud.feedLines` | 4 | Lines in the action log (a whole number). |
| `hud.phoneCompactCards` | true | On landscape phones, card info as a compact list under the action log. |

## Graphics quality

Settings → Graphics quality:

- **High:** live shadows, antialiasing and full resolution.
- **Low:** no live shadows (soft blob shadows instead), a lower pixel density, fewer clouds, each piece's lighter model, and the rockets, flags, whirlpools and splats drawn as flat icons on their tiles (their models aren't loaded).
- **Auto:** starts Low on phones (a coarse pointer and a short screen side under 500 px) and High elsewhere. It steps down to Low when the frame rate averages under 45 fps for 5 s.

A match stays within 100 draw calls and 150,000 triangles: `test/scene.test.tsx` checks the scene graph, and the e2e tests check a live match.

## Sound

Every sound effect and both music loops are made in code with [Tone.js](https://tonejs.github.io/) 15.1.22. There are no audio files.

- **Where it lives** (`src/audio/`):
  - `sounds.ts` holds the 42 recipes and their level trims;
  - `music.ts` holds the menu and match loops;
  - `cues.ts` decides what plays when, from the director's beats;
  - `engine.ts` holds the buses, mute, music fades and ducking;
  - `SoundProvider.tsx` handles the first-tap unlock, pausing while hidden and button clicks;
  - `useMatchSound.ts` plays a match's sounds.
- **Loading:** Tone loads as its own chunk (about 80 KB gzipped) on the first tap or key, which is also when phones allow audio. While muted, it isn't loaded at all.
- **Settings:** Settings → Sound has a mute switch and Effects and Music sliders. In a match, the speaker button mutes at once. Your own moments play at full level and other players' 7 dB lower.
- **Buttons:** every button clicks (U1). Give a button `data-sound="<code>"` (with `data-sound-arg` for a variant) to play another sound, or `data-sound="none"` for silence.

To retune a sound:
1. Change its recipe in `sounds.ts`, or its level in `TRIM`.
2. Make the same change on the sound board, so the two stay in step (`test/sounds.test.ts` checks that the codes and trims match the board).
3. Listen on the board.

## Asset slots and Blender models

Every model sits in a named slot with a code-built stand-in (`src/assets/slots.tsx`, `src/assets/models.ts`). The Blender models are built from scripts in [`art/`](../../art/README.md) into `public/models/<id>.glb`.

- **`src/assets/slotFiles.ts`** lists which slots have a model, and its id.
- **Loading:** a listed slot loads its model with three.js's `GLTFLoader` through a shared cache (`assets/modelCache.ts`), and the menu preloads them all. While a model loads, or if it fails, the stand-in shows and a warning is logged once.
- **Instanced slots** (`MESH_SLOTS`: tiles, pads, targets, vortices, exits) load through `useSlotMesh` (`src/assets/slotMesh.ts`): the model becomes one geometry with a group per material, so every copy draws once per material. It returns the stand-in until the model loads and never suspends, so callers re-place their instances when it changes. The stand-ins lie flat and face +Z, like the models; rockets and flags face the camera and turn only as they react.
- **Trails** (`src/scene/tracks.ts`): a shown path is a line of chevron arrowheads (`dashPoints`), flat along a slide's lane or tilted along a rocket's flight arc (`ladderCurve`), drifting on. They pop in one by one, take the pair colour and have a dark ink outline: two instanced meshes in all, however many paths show.
- **Rockets and flags**: they stand in their tile's top-right corner (`PARTS.corner`), so pieces stack in the middle. `endReaction` makes a rocket rock as a piece launches and a flag swing and pop as one lands; flat icons only pop, and reduced motion keeps them still.
- **Landings on a stack** (`stackLandings`, `landingPose` in `src/scene/motion.ts`): the piece on top wobbles for 0.8 s and the one under it squashes once.
- **Turning pieces** (`placePiece` in `src/scene/Pieces.tsx`): the body moves, squashes and turns to face its way; flips, wobbles and the idle sway turn the inner model about the piece's own side axis (rotation x), which the camera sees side-on.
- **Nothing overlaps** (`src/scene/footprint.ts`, `src/assets/pieceSizes.ts`): pieces stand by their measured sizes, stacked head to foot, nose to nose in a face-off. `pnpm test` checks the size table against the built models and every pair of pieces as turned footprints.
- **The world** (`src/scene/world.ts`, `WorldParts.tsx`): the board stands on an inflatable platform with props on its wings, an obstacle course floats round it and clouds drift below, all Blender models placed as data and drawn instanced (the menu preloads them). They idle at a quarter of the speed and size with reduced motion.
- **Camera zoom** (`src/scene/zoom.ts`, `CameraRig.tsx`): a mouse wheel or two-finger pinch over the board zooms the overview between `camera.overview.zoomMin` and `zoomMax`; follow and swoop shots don't zoom. Zoomed in closer than `camera.pan.lockAbove`, one finger or the mouse drags the view over the board (`src/scene/pan.ts`); the camera never turns, and the pan resets when the game takes the camera. While other players face off and I don't, the camera frames their tile. The camera is lazy (2026-10-15): once on an event it stays there until the next one, my own jumps in a round come before other players', and when the moves are over it holds the last moment for `timing.endHoldMs`, then goes back to the overview, except while someone picks a card, when it stays on the last event. Pieces landing on one tile in the same beat stack in the order they land.
- **Compact card info on phones** (`src/hud/CardList.tsx`): on short screens the card bubbles and the bottom queue give way to one line per card under the action log (`hud.phoneCompactCards`).
- **Full screen** (`src/ui/FullscreenButton.tsx`): a round button in the menu and in matches, hidden where the Fullscreen API isn't available.
- **Pauses** (`withPauses` in `src/director/beats.ts`): beats with no events after the last roll and after each card; `heldBeat` gives the moment they hold, for the camera and the HUD.
- **Epic "?" tiles** shine: a band of light sweeps across each (`sheenTexture`, one instanced mesh in `Board.tsx`).
- **Cards and face-offs**: cards resolve one at a time and the camera visits each (`cardShot` in `camera.ts`, `BEAT_MS.cardLead`); a face-off shows its intro, the picks, then the result banner, one after another (`faceOffModel`, banners with `delayMs`).
- **Name tags:** your own always shows; another player's shows while the mouse is over their piece or for 3 s after a tap on it, and every tag once the match is won (`tagVisible` in `src/scene/tags.ts`). A tag hides while its piece's die shows. A tap on a piece doesn't also peek the path under it.
- **The crown** (`src/scene/Crown.tsx`): it spins on tile 100 until the win, then flies onto the winner's head (`crownPose` in `motion.ts`), measured from the piece's model, with a bounce and a burst of gold sparkles, and stays there through the end screen.
- **Pairs instead of paths**: a path shows only while a piece stands on its start, while a piece rides it, or for 3 s after a tap on either end's tile (`src/scene/paths.ts`), growing in along its length. Each jump's two ends share a colour and a symbol (`src/scene/pairs.ts`); the parts take the colour as their instance colour, and the symbols are flat decals (`src/assets/symbols.ts`), one instanced mesh per symbol. `PARTS` in `src/scene/layout.ts` sets the parts' sizes and where the symbols lie; the Blender models are built to it.
- **Low quality** loads each piece's lighter file, `<id>-low.glb`, through `slotFile(name, low)`, and skips the four end models (`preloadSlotMeshes(modelEnds)`).
- **`prepareModel`** readies each model's materials:
  - `Seat` takes the player's colour;
  - on Low quality, glossy plastic drops its clearcoat;
  - the die's materials can flash;
  - a `Shadow` mesh (the pieces', die's and crown's small stand-in) casts the model's shadow and is never seen; the detailed parts cast none.
- **Unit tests** (Vitest) always use the stand-ins. The art tests (`art/test`) check every model file against its contract instead: size, origin, triangles and material names.
- **Review screenshots:** `pnpm shots` saves the menu and a match (the overview, a 2x crop of the jumps, and a close-up) to `test-results/shots/`, for reviewing a model change. They render at 2x on the GPU, not SwiftShader, which is too slow at 2x. The e2e build plays every seat fast, so the match shots are taken soon after the opening.

## Tests

```bash
pnpm test   # unit and component tests (Vitest, jsdom for components)
pnpm e2e    # Playwright end to end
```

Before the first e2e run, install Playwright's Chromium:

```bash
pnpm --filter @laddorious/client exec playwright install chromium
```

`pnpm e2e` builds the client with `vite build --mode e2e` into `dist-e2e/`, serves it on port 4180, and runs `e2e/game.spec.ts` on three projects, all in Chromium: desktop Chrome, and emulated landscape iPhone 12 and Pixel 7. The tests:

- play menu → PLAY → Play with bots (with the page clock advanced 16 s) → a whole match → the end screen → Play again;
- check that a portrait viewport shows the rotate screen;
- check that a match stays within 100 draw calls.

A fourth project, `online`, runs `e2e/online.spec.ts`. Playwright also builds an online e2e build (`VITE_SERVER=same-origin`) into `dist-online-e2e/` and serves it with `wrangler dev` on port 8788, with `FAST=1`. Two browser contexts:

- find each other, fill the table with bots and play to the end;
- drop one player and bring them back with a reload, checking the Away badge.

Only e2e builds have the test hook, `window.__laddoriousTest`. It turns on a fast mode:

- the worker plays every seat itself, yours included, with short windows;
- animations run at 5% of their length.

So a whole match takes seconds. Production builds don't contain the hook.
