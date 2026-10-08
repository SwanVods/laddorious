# Polish Pass Implementation Plan

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The seven changes the user asked for after playing the finished client: your die in the centre, no-crossing thinner slides, the card popup closing on pick, a 30 s card window, card bubbles, unique hands, and a ranks reveal after the winner cam.

**Architecture:** Engine changes first (a shared layout module, the no-crossing generator, unique hands, the window length), each with its golden snapshots updated in the same commit. Then the client: lanes from the shared layout, then four HUD and director changes, each test-first.

**Tech Stack:** TypeScript, Vitest 5, React 19, React Three Fiber, Zustand; Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-10-08-polish-pass-design.md` (amends Spec #1 and Spec #2).

**How this plan is written:** the user approved the spec and asked to execute straight away. So this plan fixes each task's files, interfaces, tests and values, but not the full code; the code is written test-first during each task.

## Global Constraints

- The rules engine stays deterministic: no clock, no `Math.random`, and plain-JSON state (spec #1 §3.4–3.5).
- `step` never throws on bad input, and invariants hold after every step.
- Every colour comes from `apps/client/src/app/theme.ts` or `theme.css` (`test/tokens.test.ts`).
- Scene budget: at most 100 draw calls and 150,000 triangles (`test/scene.test.tsx`).
- Touch targets stay at least 44 px, and nothing new takes pointer events over the board.
- With reduced motion on, there are no tumbles or pops, only instant states.
- Commit at the end of every task, with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- Read test counts with `grep -E "Test Files|Tests "`.

## Review Focus

1. **A rarity runs out of cards during rerolls** (a smaller card set, or `maxRerolls` 3 with 5 Rare cards). Expected: the reroll still works, using a seen card, and the hand never holds a duplicate. Pinned in Task 3 with a tiny card set.
2. **The generator can't fit the lanes.** Expected: no `GenerationError` across many seeds, and boards still pass analysis. Pinned in Task 2 (200 seeds) and Task 4 (1,000-match simulator run).
3. **Updates fast-forwarded past the reveal** (more than 3 queued updates). Expected: no bubble or rank badge stays stuck on screen. Pinned in Task 8 and Task 9: bubbles and badges come only from the playing beat and the timeline, never from leftover state.
4. **A pick the host rejects.** Expected: the popup comes back, so the player can still pick. Pinned in Task 6.
5. **An automatic roll on timeout, or watching another piece.** Expected: the centre die shows my roll either way, and never another player's. Pinned in Task 7.

---

### Task 1: Board layout and lane shape in core

**Files:**
- Create: `packages/core/src/board/layout.ts`, `packages/core/test/layout.test.ts`
- Modify: `packages/core/src/index.ts` (export the module)

**Interfaces (produces):**
- `BOARD_COLUMNS = 10`
- `tileCell(tile: number): { col: number; row: number }`, the serpentine layout: row `floor((t-1)/10)`, column `(t-1)%10` on even rows and `9-(t-1)%10` on odd rows.
- `laneCenterline(from: number, to: number, samples = 24): Array<[number, number]>`: points in tile units (x = col, y = row), head first, `samples + 1` points.
  - The curve is a centripetal Catmull–Rom (three.js `CatmullRomCurve3` maths, tension 0.5, ends extrapolated) through four points: the head, the 1/3 point plus `side`, the 2/3 point minus `side`, and the tail.
  - `side` is the unit vector `(ay, −ax)` (with `a = tail − head`), times `min(0.75, 0.12 × |a|)`.
- `laneGap(a, b): number`: the minimum distance between two polylines; 0 when they intersect.
- `LANE_CLEARANCE = 0.4`

**Tests (write first, watch fail):**
- `tileCell` gives the serpentine cells (tiles 1, 10, 11, 20, 100).
- `laneCenterline` starts at the head cell and ends at the tail cell, with `samples + 1` points.
- Its middle point sits off the straight line, on the side given by `(ay, −ax)`.
- `laneGap` is 0 for two crossing lanes (e.g. 57→32 and 64→41 from the probe, if they cross; otherwise a hand-built pair), and positive for parallel lanes a row apart.

**Commit:** `feat(core): put the board layout and slide lane shape in one module`

### Task 2: No-crossing slides in the generator

**Files:**
- Modify: `packages/core/src/board/generate.ts`, `packages/core/src/board/config.ts` (`generatorVersion: 3`)
- Modify: `packages/core/test/generate.test.ts` (or the board test file that covers `structuralViolations`)
- Update: `packages/core/test/__snapshots__/golden.test.ts.snap`, after reading the diff

**Interfaces:** `RejectionReason` gains `'lane-crossing'`. When placing a snake, `drawCandidate` skips the candidate (counts as a try) if `laneGap(candidate, placedSnake) < LANE_CLEARANCE` for any snake already placed. `structuralViolations` pushes `'lane-crossing'` for any snake pair closer than `LANE_CLEARANCE`.

**Tests:**
- 200 seeds: every pair of snakes is at least `LANE_CLEARANCE` apart, and every board generates without error.
- `structuralViolations` reports `'lane-crossing'` for a hand-built board with two crossing snakes.
- The golden snapshot diff shows only new boards and outcomes; generation still succeeds.

**Commit:** `feat(core): place slides so their lanes never cross (generator v3)`

### Task 3: Unique hands

**Files:**
- Modify: `packages/core/src/cards/catalog.ts`, `packages/core/src/engine/types.ts` (`Offer.seen`), `packages/core/src/engine/mystery.ts`, `packages/core/src/engine/config.ts` (`validateConfig`), `packages/core/src/engine/invariants.ts`
- Modify tests: `packages/core/test/cards.test.ts`, `packages/core/test/mystery.test.ts`, `packages/core/test/property.test.ts`, and any config test; fix fixtures that build offers without `seen`, in core and client tests.
- Update: golden snapshots, after reading the diff

**Interfaces:**
- `drawCard(cards, rarity, typeWeights, stream, exclude: readonly string[] = [])`. The old `excludeId` string parameter becomes a list; the one caller (reroll) changes with it.
- `Offer.seen: string[]`
- `validateConfig` throws `ConfigError('a rarity needs at least N cards')` when a rarity has fewer than 3 cards, or fewer than 4 while `maxRerolls > 0`.
- `assertInvariants` throws on a hand with a repeated card.

**Tests:**
- `drawCard` never returns an excluded id.
- A dealt hand has 3 distinct cards over 300 seeds.
- A reroll avoids the hand and the seen cards.
- With a 4-card rarity and 2 rerolls, the second reroll falls back to a seen card, and the hand still has no duplicate.
- `validateConfig` rejects a 3-card rarity when rerolls are on.
- Property test: no hand ever holds a duplicate.

**Commit:** `feat(core): never deal or reroll a duplicate card into a hand`

### Task 4: 30 s card window, spec #1 text, simulator comparison

**Files:**
- Modify: `packages/core/src/engine/config.ts` (`mysteryMs: 30_000`), the config test that pins the defaults, `packages/core/README.md` (the windows line)
- Modify: `docs/superpowers/specs/2026-10-03-game-core-design.md`:
  - §4.9 heading: "default 30 s";
  - §5.2 items 1–2: unique hands, per the polish spec §3.2;
  - §7.2: the lane rule, and the generator version 3;
  - §9: `mysteryMs: 30000`, `generatorVersion: 3`.
- Update: golden snapshots

**Tests:** the defaults test expects 30,000. Then run the simulator: `pnpm sim run --matches 1000 --players 4 --policy heuristic --seed polish`. Expected: the median 4-player match length stays within 15–30 rounds. Compare with the baseline taken before Task 1 and ledger both.

**Commit:** `feat(core): give the card window 30 seconds`

### Task 5: Thinner lanes from the shared layout

**Files:**
- Modify: `apps/client/src/scene/layout.ts`:
  - `tileCell` re-exports core's;
  - `slideCurve` builds a `CatmullRomCurve3` through `laneCenterline` points converted with the tile-to-world mapping.
- Modify: `apps/client/src/scene/Jumps.tsx` (`RIBBON_WIDTH` 0.30, edge +0.10, vortex and exit ring scaled to 0.6)
- Modify tests: `apps/client/test/layout.test.ts`

**Tests:**
- Client `tileCell` equals core's for all 100 tiles.
- `slideCurve(from, to)` starts and ends at the tile centres, and its middle point is within 0.05 world units of today's curve for three sample slides.
- The scene budget test is still green.

**Commit:** `feat(client): draw thinner slide lanes along the shared lane shape`

### Task 6: Card popup closes on pick

**Files:**
- Modify: `apps/client/src/app/MatchScreen.tsx`
- Modify: `apps/client/test/MatchScreen.test.tsx`

**Behaviour:**
- MatchScreen keeps `pickedWindow: number | null`.
- Picking a card sets it to the open window's id, and the popup renders only while `cardPick && pickedWindow !== view.awaiting.windowId`.
- A rejection of the pick (`session.onRejected` after a pick) clears it.
- Rerolls don't touch it.

**Tests:**
- After clicking a card, the "Choose One" dialog is gone at once, before any new update.
- After a reroll it is still there.
- After a rejected pick it comes back.

**Commit:** `fix(client): close the card pick as soon as a card is picked`

### Task 7: Your die in the centre

**Files:**
- Create: `apps/client/src/hud/CenterDie.tsx`, `apps/client/test/centerDie.test.tsx`
- Modify: `apps/client/src/hud/hud.css`, `apps/client/src/app/MatchScreen.tsx` (mount it in the layer, above the board and under the popups)

**Interfaces:**
- `CenterDie({ director, me, reducedMotion, timeScale })` subscribes to the director store.
- When a `roll` beat holds my `DieRolled`, it shows `{ face, forced }` from the beat's `startedAt`:
  - it tumbles (CSS animation) for the beat's `durationMs`;
  - it holds until `startedAt + 1600 × timeScale`;
  - it fades over 250 ms.
- When my `DiceTotaled` arrives (the same or a later update) with `total ≠ the face shown last`, it shows "Move {total}" for 1.2 s × timeScale (the die face with the caption if still up, else the caption alone).
- Size: `min(33cqh, 160px)`. `aria-live="polite"` text: "You rolled {face}".

**Ruling carried from planning:** my `DieRolled` usually arrives in its own update the moment I roll, and `DiceTotaled` only when everyone has rolled. So the "Move" caption shows when the total arrives, not necessarily together with the die (the spec says "the same update"; it is updated in Task 10).

**Tests:**
- Shows my face, never another player's.
- An automatic roll shows too.
- "Forced" badge when `forced`.
- "Move 12" when the total differs.
- Gone after 1.85 s (fake timers).
- No tumble class with reduced motion.

**Commit:** `feat(client): show your roll big in the centre of the screen`

### Task 8: Card bubbles

**Files:**
- Create: `apps/client/src/hud/bubbles.ts` (pure lifetime rules), `apps/client/test/bubbles.test.ts`
- Modify: `apps/client/src/hud/NameTags.tsx` (render a bubble inside each tag), `apps/client/src/hud/hud.css`, `apps/client/test/hud.test.tsx` (or a new jsdom test for NameTags)

**Interfaces:**
- `useCardBubbles(director, timeScale): Map<PlayerId, CardInfo>`, built on a pure reducer `bubbleStep(bubbles, beat)`:
  - a `cardReveal` beat adds one bubble per `CardSelected` (caster → card id);
  - a `cardResolved` beat marks its caster resolving;
  - when that beat ends, the bubble leaves 800 ms × timeScale later;
  - a `RoundStarted` event, a `victory` beat or a settled timeline with no beat clears all bubbles.
- NameTags gets a `bubbles` prop and renders `<div class="bubble {rarity}">` with the icon, name, text and target line inside the tag, above the name.

**Tests:**
- Reveal of two cards → two bubbles.
- One resolves → that bubble leaves 0.8 s after its beat, and the other stays.
- A fast-forwarded timeline leaves no bubbles.
- The rendered bubble shows the card name and text.

**Commit:** `feat(client): show each revealed card as a speech bubble over its player`

### Task 9: Ranks reveal after the winner cam

**Files:**
- Modify: `apps/client/src/director/beats.ts` (`'ranks'` kind; `BEAT_MS.rankStep` 500, `BEAT_MS.rankHold` 1200), `apps/client/src/scene/camera.ts`, `apps/client/src/hud/NameTags.tsx` (rank badge), `apps/client/src/hud/hud.css`, `apps/client/src/app/theme.ts` or `theme.css` (only if the podium colours need a CSS token)
- Modify tests: `apps/client/test/beats.test.ts`, `apps/client/test/camera.test.ts`, and the NameTags test

**Interfaces:**
- `buildTimeline` appends a `ranks` beat after every `victory` beat, with the same `MatchWon` event and the same `after`.
- Its duration is `rankStep × (distinct non-winner ranks) + rankHold`.
- `cameraShot` returns the overview during `ranks`.
- NameTags shows a rank badge on non-winners during `ranks`, with `animation-delay` by reveal order (last place first).

**Tests:**
- `ranks` follows `victory` with the right duration (ties counted once).
- The camera is in overview during `ranks`.
- Badges show "2nd", "3rd" and "4th" on the right players.
- The whole-match director test stays green.

**Commit:** `feat(client): reveal the other ranks over the overview after the winner cam`

### Task 10: Docs, gate and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-10-04-3d-client-design.md` §5.1, §5.3, §6.1 (per polish spec §4.6)
- Modify: the polish spec §4.2 (the "Move" caption shows when the total arrives)
- Modify: `apps/client/README.md` (nothing, unless a command changed), `docs/superpowers/HANDOFF.md` (the polish pass row, suite counts, next step = Spec #3 / Spec #4)

**Gate:**
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e` are all green.
- A browser check in the dev server: the centre die, a card pick closing, bubbles, the ranks reveal and the thinner lanes.

**Commit:** `docs: hand off after the polish pass`

After Task 10: self-review the branch against this plan's Review Focus (say it was a self-review), fast-forward merge `polish/pass-1` into `main` locally, run the suite on `main`, and delete the branch.
