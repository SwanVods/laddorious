# Known Issues (2026-10-14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, inline (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the user's "Known issues" list (their PDF, 2026-10-14), except the new board theme, which gets its own design step afterwards.

**Architecture:** Mostly client fixes in the HUD, the director's beats, the camera, the motion poses and two board models. One rules change in `packages/core`: cards resolve one at a time, from the last-placed player to the leader. That change also makes each card's effect play out before the next card, which is what the client's per-card camera needs.

**Tech Stack:** pnpm monorepo. Client: React 19, R3F 9.8, three 0.186, zustand. Tests: Vitest and Playwright. Core: pure TypeScript. Art: Blender 5.2, run headless (`BLENDER=E:/Software/Blender/blender.exe pnpm art <ids>`).

**Spec:** Spec #1 (the rules) gets amendment D-row "card order by position"; Spec #2 (client) and Spec #5 (art) get rows for the client and model changes. The user's PDF is the source; each task quotes the item it answers.

## The user's decisions (2026-10-14)

- **Card order:** replace the order by type fully. Cards resolve one at a time from the last-placed player to the leader.
- **Rocket and flag tiles:** with the rocket and flag in the tile's top-right corner, pieces stack in the middle like on any tile. Last round's row in front of them goes.
- **Board theme:** a design step with visual directions comes after these fixes. It replaces plan 3's island, bumpers and props.
- **The "eye" (idle) icon:** removed. A spinner shows who is picking, and a check shows who is done.

## Global Constraints

- Commit at the end of every task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Colours only from `theme.ts` / `theme.css` (`test/tokens.test.ts` enforces it).
- Builds run headless only, never in the user's open Blender.
- A busy match stays within 100 draw calls and 150,000 triangles on High, and under 100,000 triangles on Low (`art/test/budget.test.ts`).
- Tests stay simple (the user, 2026-10-14): pure functions with plain unit tests where possible. A multiplayer test that would need new scaffolding is deferred to the HANDOFF, not built.
- Reduced motion turns off every new wiggle, flip and camera move it can.
- Work on a branch `fix/known-issues` from `main`; a local fast-forward merge after the user approves.

## Review Focus

1. **Two cards that target each other in one round.** Each resolves in turn against the board as the earlier one left it, with no clash. Pinned in Task K1.
2. **Players tied on a tile.** The order breaks ties by seat, so every client and the server agree. Pinned in Task K1.
3. **A face-off that ends in a draw, then a re-pick.** The result text shows after the popup closes each time, never behind it. Pinned in Task K3.
4. **A piece landing on a stack of three.** It wiggles on top, and only the piece directly under it squashes. Pinned in Task K5.
5. **Muted at startup.** The sound switch shows off and nothing plays; turning it on plays sound without a reload. Pinned in Task K9.

---

### Task K1: Cards resolve one at a time, last place first (engine)

> "Change card resolver order will be from the last position player to the first position player."

**Files:**
- `packages/core/src/engine/resolve.ts` (`groupPendingCards` becomes a one-card-per-group order by position);
- `packages/core/src/cards/types.ts` (the type and rarity order constants stay only if something else still uses them);
- `apps/client/src/hud/model.ts` (the reveal queue's order, and the "Cards resolve: Movement → …" caption goes);
- spec #1 (a new D row);
- tests in `packages/core/test` and `apps/client/test`.

- [ ] Tests first (core):
  - Pending cards from players on tiles 40, 12 and 77 resolve in the order 12, 40, 77, each in its own group.
  - Two players on the same tile resolve in seat order.
  - Two attack cards aimed at each other: the second resolves against the board the first left, and no `Clash` event is emitted.
- [ ] Test first (client `model.test.ts`): the reveal queue lists cards by the caster's position, last place first, and no caption names the type order.
- [ ] Watch them fail, then implement. Run `pnpm --filter @laddorious/sim` 1,000 matches and note the median match length before and after in the ledger. This is a balance note, not a gate.
- [ ] Spec #1 D row with the user's words.
- [ ] Commit: `feat(core): cards resolve one at a time, from last place to the leader`.

### Task K2: The camera visits each card in turn

> "In card revealing phase, the camera should focus to the player by card action/resolution order, and the effect should be directly in action for each player, not executes all at once."

**Files:**
- `apps/client/src/scene/camera.ts` (a card shot);
- `apps/client/src/director/beats.ts` (a short lead-in per card, so the camera arrives before the effect plays);
- tests.

- [ ] Tests first (`camera.test.ts`, pure `cameraShot`):
  - During a `cardResolved` beat, the camera frames the caster. With a target, it frames the point between caster and target.
  - During the `cardMove` beat that follows, it follows the piece the card moves.
  - With reduced motion, these shots cut instead of gliding.
- [ ] Test first (`beats.test.ts`): a round whose engine events interleave card, move, card, move (from K1) builds beats in the same interleaved order. Each `cardResolved` beat is at least 400 ms longer than today, as the lead-in.
- [ ] Watch them fail, then implement. Then a browser check with a dev bot match through a card round.
- [ ] Commit: `feat(client): the camera visits each card as it resolves`.

### Task K3: The face-off in clear steps

> "Face off text result 'you win, you lose, and draw' is behind the faceoff screen … text first → faceoff screen → result text."

**Files:**
- `apps/client/src/hud/model.ts` (`bannerFor`, the face-off popup's visibility);
- `FaceOffPopup.tsx`;
- `director/beats.ts` (the result beat's timing);
- tests.

- [ ] Tests first (`model.test.ts`, pure):
  - The FACE-OFF banner shows during the `faceOff` beat's first part, and the popup opens only after it.
  - At the `faceOffResult` beat the popup is closed, and the result banner (YOU WIN / YOU LOSE / DRAW) shows.
  - A draw re-opens the popup only after the DRAW banner ends.
- [ ] Watch them fail, then implement. Then a browser check: a face-off against a bot (dev build) shows the intro, then the popup, then the result, in that order.
- [ ] Commit: `fix(client): the face-off shows its intro, the picks, then the result, one after another`.

### Task K4: After a face-off, the loser flips away and the winner stays

> "The animation post faceoff result, the pieces are back to stacking position. It should not. Focus just like how the artifact does."

Behaviour copied from the mockup: the loser backflips along an arc to its knock-back tile. The winner eases from its face-off spot back to the tile's centre and faces forward again. The camera follows the winner.

**Files:**
- `apps/client/src/scene/motion.ts` (`beatPose` for the knock-back beat after a face-off);
- `camera.ts`;
- tests.

- [ ] Tests first (`motion.test.ts`):
  - At the start of the knock-back beat both pieces are at their face-off spots, not stacked.
  - Halfway through, the loser is above the arc's midpoint and turned partway through a backflip.
  - At the end, the winner stands alone at the tile's rest spot.
- [ ] Test first (`camera.test.ts`): the knock-back beat after a face-off follows the winner.
- [ ] Watch them fail, then implement.
- [ ] Commit: `fix(client): after a face-off the loser flips away and the winner keeps the tile`.

### Task K5: A wiggle when a piece lands on another

> "There's no 'wiggling' animation when pieces stacking each other, like in the artifact."

The mockup's behaviour: the arriving piece hops up onto the stack and wobbles side to side for 0.8 s, dying away. The piece directly under it squashes once (0.26 s).

**Files:**
- `apps/client/src/scene/motion.ts` (the move beat's landing for a piece that lands on a stack);
- tests.

- [ ] Tests first (`motion.test.ts`):
  - After landing on a stack, the arriving piece's roll about its forward axis is non-zero 200 ms in and zero 800 ms in.
  - The piece directly under it is squashed (height scale under 1) 130 ms after the landing, and back to 1 by 260 ms.
  - A third piece lower in the stack doesn't squash.
  - A piece landing on an empty tile doesn't wiggle.
  - Reduced motion: no wiggle.
- [ ] Watch them fail, then implement. The wiggle runs past the move beat's end, so the rest pose gets a decaying wiggle from the stored landing time.
- [ ] Commit: `feat(client): a piece landing on a stack wiggles, and the one under it squashes`.

### Task K6: "Peek at the board" shows the whole board

> "When picking a card from mystery tiles, button 'peek at the board' should be in overview cam."

**Files:**
- `CardPickPopup.tsx` (it reports peeking up to the match screen);
- `camera.ts` (a `peeking` input);
- tests.

- [ ] Test first (`camera.test.ts`): while `peeking` is true, the shot is the overview, even during my own Mystery pick.
- [ ] Test first (`CardPickPopup` component test): pressing "Peek at the board" calls `onPeek(true)`, and releasing it calls `onPeek(false)`.
- [ ] Watch them fail, then implement.
- [ ] Commit: `fix(client): peeking during a card pick shows the whole board`.

### Task K7: HUD tidy-ups

> "Die rolling indicator … is behind its piece name", "make the game action logs smaller, reduce the visible logs to 4", "You don't have to show this" (the order caption), "What is this 'eye' symbol?", "the position between hamburger button and player list … is overlapping. Shift it down."

**Files:**
- `src/scene/tags.ts` and `TagProjector.tsx` (a tag hides while its piece's die shows);
- `hud/feed.ts` and its CSS (4 lines, smaller text);
- `hud/PlayerColumn.tsx` (no idle icon);
- the player column's CSS (moved down);
- tests.

- [ ] Tests first:
  - `tags.test.ts`: `tagVisible` is false for a piece whose die shows (a roll beat with its `DieRolled`), even my own.
  - `feed.test.ts`: at most 4 lines.
  - `PlayerColumn` component test: an idle player's row has no status icon.
- [ ] Watch them fail, then implement. Move the column down so its top clears the round buttons at 1280 × 720 and at a landscape phone's 844 × 390.
- [ ] Browser check at both sizes. Screenshot the top-right corner and the feed.
- [ ] Commit: `fix(client): HUD tidy-ups: four smaller feed lines, no idle eye, tags clear the dice, the player list below the buttons`.

### Task K8: Rockets and flags in the corner, pieces stack again, shiny Epic tiles

> "Move the flag to the top right corner of the tile", "make the rocket smaller and remove its circle pad. Put it to the top right corner of its tile", "the question mark for epic cards should be like 'shiny' tiles".

**Files:**
- `art/models/pad.py` (no pad, smaller);
- `art/contract.ts` (rocket height about 0.8, max width 0.6);
- `src/scene/layout.ts` (`PARTS.corner`: the offset of the rocket and the flag, plus their symbols, toward the tile's top-right, which is +X and −Z as seen from the camera);
- `Jumps.tsx` (the 3D and flat ends at the corner);
- `motion.ts` (the row rule and `END_ROW` go; reactions stay);
- `tags.ts` (the row tag rule goes);
- the board overlay or `Board.tsx` (a shine on Epic "?" tiles);
- `art/test/budget.test.ts`;
- tests.

- [ ] Tests first:
  - `scene.test.tsx`: the rocket and the flag stand at the tile's corner offset, and the rocket's symbol rides with it.
  - The art contract: the rocket is under 0.85 tall with no base wider than 0.6.
  - `motion.test.ts`: pieces on a rocket or flag tile stack like on any tile (the row tests are replaced).
  - `scene.test.tsx`: an Epic "?" tile has the shine (a named mesh or material flag) and a Common one doesn't.
- [ ] Watch them fail, then implement. Rebuild `pad` headless and preview it with `art/preview.py`. Corner positions keep the rocket and flag clear of the lane and of a stack of pieces in the middle (at least 0.35 from the centre).
- [ ] Shine: a slow sweeping highlight across the Epic tile's gold "?" (an animated texture offset or an additive sheen), no extra draw call per tile.
- [ ] Browser check: High and Low, a rocket, a flag and an Epic tile up close.
- [ ] Commit: `feat(client): rockets and flags in the tile's corner, pieces stack again, Epic tiles shine`.

### Task K8b: The rocket's trail uses the slide's arrowheads

> "Also use the rocket trail the same as slide's trail." (the user, 2026-10-14, after the plan)

A rocket's trail becomes the same outlined chevron arrowheads as a slide's, one every `DASH_GAP` along the rocket's arc to its flag, drifting toward the flag. They follow the arc through the air, each tilted to point along it. The smoke puffs and their outlines go.

**Files:**
- `src/scene/tracks.ts` (`dashPoints` takes a ladder too: points along the arc, each with a heading and a pitch);
- `Jumps.tsx` (ladders draw into `slide-arrows`; the `trail-puffs` meshes go);
- `assets/models.ts` (the puff goes);
- `art/test/budget.test.ts`;
- tests.

- [ ] Tests first:
  - `tracks.test.ts`: a ladder's dashes run from the rocket to the flag along the arc, one every `DASH_GAP` along the curve. Each one's heading and pitch point toward the next. The middle one sits well above the board, and a phase moves them on toward the flag.
  - `scene.test.tsx`: a tapped ladder shows arrowheads in its pair colour, with outlines, and the scene has no `trail-puffs` mesh.
  - Budget: shown paths are priced as arrowheads only (2 draw calls).
- [ ] Watch them fail, then implement. `PUFFS` and `puffPoints` go, with their tests.
- [ ] Browser check: tap a rocket and a whirlpool on seed `review-2`.
- [ ] Commit: `feat(client): rocket trails use the slide's arrowheads, along the arc`.

### Task K9: Menu, lobby and sound

> "Remove pieces picker/list on the main menu … choose their piece with arrow only", "the gear button in lobby looks weird", "current sound settings switch button is reversed", "sometimes the music and the sound doesn't load when opening the page".

**Files:**
- `app/MenuScreen.tsx` and its CSS (the strip goes; the arrows stay, and the piece's name shows on its plate);
- the gear button's icon and CSS;
- `app/SettingsDialog.tsx` (the switch shows sound on when not muted);
- `audio/` (why sound sometimes doesn't start);
- `e2e/game.spec.ts` (the picker test becomes an arrows test);
- tests.

- [ ] Tests first:
  - `SettingsDialog` component test: with sound on, the Sound switch is `aria-checked="true"`; clicking it mutes.
  - `MenuScreen` component test: no piece strip, and the arrows change the piece.
- [ ] Sound not starting: investigate with superpowers:systematic-debugging before any fix. Suspects:
  - the reversed switch leaving people muted;
  - the audio context unlock happening only on certain gestures;
  - Tone loading lazily racing the first cue.

  The fix comes with a failing test that reproduces the cause found. If the cause can't be reproduced, the findings go in the HANDOFF instead of a guess.
- [ ] Gear: redraw the icon to match the other round buttons (the same stroke weight and size as the menu and sound icons). Browser check of the menu and lobby, before and after.
- [ ] Watch the tests fail, then implement.
- [ ] Commit: `fix(client): arrows-only piece choice, a cleaner gear, and a sound switch that means what it says`.

### Task K10: Docs, the gate and the review

- [ ] Spec rows: #1 (the card order), #2 (the client fixes), #5 (corner ends, shiny Epic tiles).
- [ ] READMEs and the HANDOFF. The new board theme is the next step: a design step with visual directions, before any plan.
- [ ] Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` (all 17, run with nothing else on the machine), and `pnpm art tile` rebuilding byte for byte.
- [ ] Self-review against the Review Focus. Critical and Important findings get a failing test first; Minor ones go to the HANDOFF.
- [ ] A review page with before and after screenshots, one row per issue. Then stop for the user's review. After approval: fast-forward merge to `main`.

## Not in this plan

- The board theme ("change the board/island/table shape … do it better"). This is its own design step after these fixes. It replaces plan 3 (the world).
