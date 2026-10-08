# @laddorious/client

The Laddorious web client:

- the main menu, with your piece on a podium;
- matchmaking, which offers "Play with bots" after 15 s;
- a 4-player match in 3D with the full HUD;
- the end screen.

It runs in desktop browsers and in landscape on phones; Capacitor builds for iOS and Android come later. Design: [Spec #2](../../docs/superpowers/specs/2026-10-04-3d-client-design.md).

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

## Where things are (`src/`)

| Folder | What it holds |
|---|---|
| `app/` | The app shell and routing (`App.tsx`), the screens (menu, matchmaking, match, end, error, settings), the profile and settings store (`prefs.ts`), and the design tokens (`theme.ts` for the 3D world, `theme.css` for the HUD) |
| `service/` | The `MatchService` interface, the local service and the worker session |
| `worker/` | The Web Worker host: the engine, the timers and the bots |
| `director/` | Turns engine events into animation beats on a presentation state |
| `scene/` | React Three Fiber: the board, pieces, slides, launch pads, camera, menu podium, name tags |
| `assets/` | Asset slots: the code-built models and optional `.glb` overrides |
| `hud/` | The match HUD: a pure model (`model.ts`, `labels.ts`, `record.ts`, `feed.ts`) and its components |
| `ui/` | Shared pieces: icons, portraits, dialogs, toasts, the rotate screen |

Every colour is a token in `app/theme.ts` or `app/theme.css`, and `test/tokens.test.ts` fails on a colour written anywhere else.

## Deploying

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

## Graphics quality

Settings → Graphics quality:

- **High:** live shadows, antialiasing and full resolution.
- **Low:** no live shadows (soft blob shadows instead), a lower pixel density and fewer clouds.
- **Auto:** starts Low on phones (a coarse pointer and a short screen side under 500 px) and High elsewhere. It steps down to Low when the frame rate averages under 45 fps for 5 s.

A match stays within 100 draw calls and 150,000 triangles: `test/scene.test.tsx` checks the scene graph, and the e2e tests check a live match.

## Asset slots and `.glb` models

Every model sits in a named slot with a code-built default (`src/assets/slots.tsx`). The slots are `piece.knight`, `piece.pawn`, `piece.meeple`, `piece.dragon`, `die`, `pad`, `slide.vortex`, `crown` and `island`.

A `.glb` for a slot must follow this contract:

- 1 tile = 1.6 units; the origin is at the base centre (the feet); forward is +Z; Y is up.
- Pieces stay under 5,000 triangles, with PBR materials.
- A material named `Seat` takes the player's colour.

To drop one in:

1. Put the file in `apps/client/public/models/`, for example `public/models/knight.glb`.
2. In `src/assets/slots.tsx`, add it to `SLOT_URLS`: `'piece.knight': '/models/knight.glb'`.

It loads with drei's `useGLTF` inside Suspense. If it fails to load, the built-in model stays and a warning appears in the console.

Today the four pieces, `crown` and `island` are wired through `<Slot>`. `die`, `pad` and `slide.vortex` are declared but drawn directly, and the Spec #5 art pass will wire them.

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

Only e2e builds have the test hook, `window.__laddoriousTest`. It turns on a fast mode:

- the worker plays every seat itself, yours included, with short windows;
- animations run at 5% of their length.

So a whole match takes seconds. Production builds don't contain the hook.
