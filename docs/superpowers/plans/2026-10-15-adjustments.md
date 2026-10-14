# Adjustments and rare bugs (2026-10-15) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, inline (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user's small adjustments (camera timing and focus, a closer and zoomable overview, compact card info on phones, an admin JSON of tunable settings) and three rare bugs (a jump's end sharing a tile with another jump, the tile-99 card, the three-way face-off).

**Architecture:** A runtime tuning file (`apps/client/public/tuning.json`) read at startup, merged over typed defaults, feeds the camera, timing and HUD numbers that today are constants. Camera changes stay in the pure `cameraShot`. The phone layout is CSS plus one compact list component. The board fix is a new hard invariant in `packages/core`.

**Tech Stack:** pnpm monorepo. Client: React 19, R3F, three, zustand. Tests: Vitest and Playwright. Core: pure TypeScript.

**Spec:** Spec #2 (client) gets row C18; spec #1 gets an amendment to D16 (jump ends never share a tile).

## The user's decisions (2026-10-15)

- **Face-off losers** knocked back together keep colliding and facing off again: keep as is.
- **Tile 99:** the card was red (Shove or Heavy Boots). Heavy Boots only lowers the next roll, so it's the likely cause. A test pins the reconnect path, and the Heavy Boots bubble says plainly that it's for the next roll.
- **Compact card info:** on phones only (landscape, short screens); desktop keeps today's bubbles and queue.
- **Admin settings:** a JSON file the game reads at startup, so an admin (and later a dashboard) can change values without a code change or rebuild. Missing or invalid values fall back to the defaults.

## Global Constraints

- Commit at the end of every task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Colours only from `theme.ts` / `theme.css`.
- Tests stay simple: pure functions where possible; multiplayer tests needing new scaffolding are deferred to the HANDOFF.
- Work on branch `fix/adjustments` from `main`; a local fast-forward merge after the user approves.

## Review Focus

1. **A bad tuning.json** (bad JSON, a missing key, a string where a number belongs, a negative duration): the game starts with the defaults for those values and warns once in the console. Pinned in T1.
2. **Zooming on a phone while a beat moves the camera:** the pinch zoom only changes the overview's distance; follow and swoop shots are unaffected, and the zoom stays within limits. Pinned in T3.
3. **A card edit that would put a jump's end on another jump's tile:** it tries the next spot, and fizzles if none is free. Pinned in T5.
4. **Two face-offs at once, neither mine:** the camera frames the first one in the engine's order. Pinned in T2.
5. **A long card queue on a phone** (four cards): the compact list fits under the action log without covering the ROLL button or the player list. Pinned in T4.

---

### Task T1: Admin settings in tuning.json

> "Add a json configuration to the code to adjust anything like this, so me as an admin can adjust the properties without changing its code/hardcode."

**Files:**
- `apps/client/public/tuning.json` (every setting with its default);
- `apps/client/src/app/tuning.ts` (the typed defaults, `loadTuning()` fetching and merging, a zustand store the scene and HUD read);
- `apps/client/README.md` (each key explained, for the admin and a future dashboard);
- tests.

**Settings in the first version** (each replaces a constant):
- camera:
  - `overview.distance`, `overview.height`, `overview.zoomMin`, `overview.zoomMax`;
  - `follow.ease`, `swoop.ease` (how fast the camera reaches a new shot);
  - `focusAfterRollMs`;
- timing:
  - `rollPauseMs`, `cardPauseMs`, `cardLeadMs`;
  - `faceOffIntroMs`, `knockbackMs`, `hopMs`;
- hud:
  - `feedLines`;
  - `phoneCompactCards` (on or off).

- [ ] Tests first (`tuning.test.ts`, pure `mergeTuning(defaults, raw)`): a full file is taken as is; a missing key, a wrong type, a negative or non-finite number, or a bad zoom range falls back to that key's default and reports it; bad JSON gives all defaults.
- [ ] Watch them fail, then implement. `main.tsx` awaits `loadTuning()` (a 1.5 s timeout falls back to the defaults) before rendering. `BEAT_MS` timings that are tunable read from the store when a timeline is built.
- [ ] Commit: `feat(client): admin settings in tuning.json, read at startup`.

### Task T2: Camera timing and face-off focus

> "Reduce the time when the camera focus to player after die roll", "if you didn't land on anything, while other player facing a faceoff, can you switch the focus into those players?"

- The move to my piece after the roll is quicker: the camera eases there faster (`follow.ease` 1.8 → 3.2), and the pause after the last roll drops from 700 ms to 400 ms. Both come from tuning.
- While other players face off and I'm not in it, the camera frames their tile (the face-off intro, the pick window and the result), instead of following my piece.
- [ ] Tests first (`camera.test.ts`): a challenge window I'm not in, and a `faceOff` / `faceOffResult` beat without me, frame the face-off's tile; with two face-offs, the first.
- [ ] Watch them fail, then implement. The rig passes the settled view's open challenges to `cameraShot`.
- [ ] Commit: `feat(client): the camera reaches my piece sooner after the roll, and watches other players' face-offs`.

### Task T3: A closer overview, zoomable by wheel and pinch

> "Make the overview cam little bit closer", "make the overview cam zoomable by both mouse scroll and hand pinch/zoom."

- The overview starts about 15% closer, still showing the whole board on a landscape phone (the existing corner test).
- A mouse wheel or a two-finger pinch over the board changes the overview's distance between `zoomMin` and `zoomMax`. Only the overview zooms; the zoom stays for the match.
- [ ] Tests first: `camera.test.ts`: the overview at zoom 1 is closer than before, still frames all four corners on an 844×390 screen, and `zoom` scales its distance within limits. `zoom.test.ts`, pure: a wheel delta and a pinch ratio map to a clamped zoom.
- [ ] Watch them fail, then implement. `CameraRig` listens for wheel and pointer pinch on the canvas (`touch-action: none` there).
- [ ] Commit: `feat(client): a closer overview you can zoom with the wheel or a pinch`.

### Task T4: Compact card info on phones

> "For mobile player … the card effect bubble size and the cards on the bottom is covering the screen … simplify and move it to the left hand screen below the action log, as compact info."

- On short screens (the same `max-height: 500px` container rule the feed uses), the card bubbles over pieces and the bottom card queue are hidden. In their place, a compact list sits under the action log: one line per card, with its colour chip, the player, the card name, and its result once known (the current card highlighted).
- The Heavy Boots line (and bubble) reads "−3 on next roll".
- [ ] Tests first: a `CardList` component test: lines in resolution order, the current one marked, results shown; the Heavy Boots wording.
- [ ] Watch them fail, then implement. Browser check at 844×390 with four cards: nothing overlaps the ROLL button or the player list. Desktop unchanged.
- [ ] Commit: `feat(client): compact card info under the action log on phones`.

### Task T5: Jump ends never share a tile

> "I found a flag with a warp in one tile … both flag and warp, rocket and splat should never be in one tile."

- A new hard board invariant: no tile holds more than one jump end (start or end, of any jump). Card edits that would break it try the next spot and fizzle if none fits; an expired edit restores a jump only if the rule still holds.
- [ ] Tests first (`board.test.ts`, `boardEdit.test.ts`): `boardViolations` flags a ladder ending on a slide's start, two ends on one tile, and a start on another's end; a Ladder Drop whose first spot is another jump's end goes one further; with no free spot it fizzles.
- [ ] Watch them fail, then implement. Run 1,000 simulated matches; note in the ledger the board-generation retries and the card fizzles before and after.
- [ ] Spec #1: D16 amended.
- [ ] Commit: `fix(core): no tile holds two jump ends, card edits included`.

### Task T6: The tile-99 card, and a reconnect during cards

- [ ] Test first (`director.test.ts` or `onlineSession.test.ts`): a client that misses an update with a card's move, then gets the server's resync (a view with no events), shows the piece where the view has it.
- [ ] If it fails, fix with `superpowers:systematic-debugging`. If it passes, the ledger records that the reconnect path is sound and the likely cause was Heavy Boots (T4 makes its wording clear).
- [ ] Commit: `test(client): a resync after a missed card shows the true position`.

### Task T8: Full-screen mode

> "Oh also, add full screen mode." (the user, during T1)

- A round full-screen button beside the sound and menu buttons in a match, and beside the gear on the menu. It toggles the browser's full screen (the Fullscreen API) and shows enter or exit to match. Where full screen isn't available (an iPhone's Safari), the button doesn't show.
- [ ] Tests first (component tests with a stubbed `document.documentElement.requestFullscreen` and `fullscreenElement`): the button enters full screen, then exits it; its label follows `fullscreenchange`; it's absent when the API is missing.
- [ ] Watch them fail, then implement. Browser check at desktop and phone sizes.
- [ ] Commit: `feat(client): a full-screen button in the menu and in matches`.

### Task T7: Docs, the gate and the review

- [ ] Spec #2 C18, spec #1 D16, the client README (each tuning key), the HANDOFF.
- [ ] Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`.
- [ ] Browser checks: phone layout with cards, zooming, other players' face-off framing. Screenshots on the review page; then stop for the user's review.

## Not in this plan

- The three-way face-off: knocked-back losers who land together face off again, as today (the user's choice). In a four-way face-off, the two players in the minority continuing with rock-paper-scissors is by design.
- The admin dashboard itself.
- The board theme (next, as its own design step).
