# Polish pass: dice, cards, slides and finish — design

**Status:** approved 2026-10-08 and implemented the same day (plan `docs/superpowers/plans/2026-10-08-polish-pass.md`).
**Amends:** Spec #1 (`2026-10-03-game-core-design.md`) §4.9, §5.2, §7.2, §9; Spec #2 (`2026-10-04-3d-client-design.md`) §5.1, §5.3, §6.1.
**Comes before:** Spec #3 (sound design), then Spec #4 (multiplayer server).

---

## 1. What this delivers

The user played the finished client (Spec #2) and asked for seven changes:

1. Show your own roll big in the centre of the screen, not only on the small die above your piece.
2. Stop slides (snakes) from overlapping each other.
3. Close the card-pick popup as soon as a card is picked.
4. Give the card-pick window 30 seconds.
5. When cards are revealed, show each card's effect as a speech bubble over the player's piece, so nobody has to hover an icon to read it.
6. Never show the same card twice in one hand. The user saw Aegis twice in an Epic hand.
7. When someone finishes, play the winner cam first, then pull back to the overview while the other players' ranks are revealed.

Success: the seven behaviours above, with the rules engine still deterministic, the test suite and the e2e tests green, and matches about as long as today (simulator check).

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| P1 | The match still ends at the first finish. Ranks 2–4 come from board position, as today. | User's choice: "Match ends, ranks reveal". The ranks step is presentation only. |
| P2 | Slides: no-crossing placement **and** thinner lanes (option D). | User's choice after the comparison page (artifact "Laddorious Slide Lanes"). |
| P3 | Rejecting whole boards that have a crossing is not enough; the generator places slides one at a time and skips any that would cross. | Only 1 board in 300 from today's generator has no crossing (5.3 crossings on average). Placing slides one at a time fit 10 slides in every trial run, at about the same slide length (~15.5 tiles vs ~16.4 today). |
| P4 | The board layout and the slide lane's shape move into `@laddorious/core`. | The generator's crossing check and the client's drawing must use the same path. One module also keeps the layout swappable for the themed boards the user plans later (memory `future-board-themes`). |
| P5 | Only your own die appears in the centre. | The point is to see your own number at once; the others stay above their pieces and in the feed. |
| P6 | A hand never shows a duplicate. A reroll prefers cards not yet seen in that hand and falls back to seen ones only if the rarity runs out. | User's request; the fallback keeps rerolls working if a later card set has fewer cards per rarity. |

## 3. Rules engine (`@laddorious/core`)

### 3.1 Card window: 30 s

`DEFAULT_WINDOWS.mysteryMs` changes from `15_000` to `30_000`. Spec #1 §4.9 and §9 read "default 30 s". The dice (12 s) and challenge (8 s) windows don't change.

### 3.2 Unique hands

Replaces Spec #1 §5.2 items 1–2.

- `drawCard(cards, rarity, typeWeights, stream, exclude: readonly string[] = [])`: buckets drop every card in `exclude`. A type whose bucket is empty gets weight 0, as today.
- `Offer` gains `seen: string[]`: every card shown in this hand, in the order shown.
- **Dealing:** slot 1 draws with `exclude = []`, slot 2 excludes slot 1's card, slot 3 excludes both. `seen` starts as the three cards.
- **Reroll:** draws with `exclude = hand ∪ seen`. If no card of that rarity is left outside that set, it draws with `exclude = hand` instead. The new card is appended to `seen`.
- **Config check:** `validateConfig` throws `ConfigError` when a rarity has fewer than 3 cards, or fewer than 4 while `maxRerolls > 0`. Today's set has 6 Common, 5 Rare and 6 Epic cards.
- **Invariant:** a hand's three cards are always different (checked in `assertInvariants`).
- The timeout auto-pick and the reroll limits (2 per hand, 1 per slot) don't change.

### 3.3 Board layout and slide lanes

New module `packages/core/src/board/layout.ts`, exported from the package:

- `BOARD_COLUMNS = 10`.
- `tileCell(tile): { col, row }`: the serpentine layout the client uses today. Tile 1 is at column 0, row 0, and rows alternate direction.
- `laneCenterline(from, to, samples = 24): Array<[x, y]>`: the slide's centre line in tile units (x = column, y = row), head first. It is today's client curve: a centripetal Catmull–Rom through the head, a point one third of the way along pushed sideways by `s`, a point two thirds along pushed the other way by `s`, and the tail, where `s = min(0.75, 0.12 × straight-line length)` in tiles.
- `laneGap(a, b): number`: the smallest distance between two centre lines, in tiles. Crossing lines give 0.
- `LANE_CLEARANCE = 0.4` tiles.

The client's `tileCell` and slide curve use these functions; nothing else in the client computes the layout.

### 3.4 No-crossing slides

Amends Spec #1 §7.2.

- When the generator draws a snake, it skips the candidate (and draws another, as it already does for other placement rules) if `laneGap` to any snake already placed is under `LANE_CLEARANCE`.
- Structural validation gains `lane-crossing`: any two snakes closer than `LANE_CLEARANCE`. Generated boards never fail it; the check exists so tests and the board report can name it.
- `generatorVersion` becomes 3, so the same seed gives a new board.
- The analytic (fairness) validation and every other rule are unchanged.
- **Not covered:** ladders (their pads and arcs are drawn in the air), and the temporary slide the Snake Pit card creates for 3 rounds, which may cross a lane.

### 3.5 Knock-on changes

- The golden match snapshots change (new window length, new card draws, new boards). They are updated in the same commit as the rule change, after reading the diff.
- `pnpm sim run --matches 1000 --players 4 --policy heuristic` runs before and after. The median 4-player match length must stay inside the generator's gate (15–30 rounds), and the report goes in the plan's ledger.

## 4. Client (`apps/client`)

### 4.1 Thinner lanes

- Lane width 0.30 world units (was 0.62; a tile is 1.6), and its dark edge 0.10 wider (was 0.16).
- The head vortex and the exit ring shrink to about 60% of today's size.
- Lanes, and the orb that travels a lane during a slide, follow `laneCenterline`, converted to world units the same way tiles are.
- The scene stays within the budget: at most 100 draw calls and 150k triangles.

### 4.2 Your die in the centre

New HUD component (`hud/CenterDie.tsx`).

- When a roll beat contains my `DieRolled` (manual or automatic), a large die appears in the centre of the screen, above the board and below the popups.
- It tumbles for the roll beat's length, lands on my face, and stays until 1.6 s after the beat started. Then it fades out over 0.25 s. All times follow the director's time scale.
- A forced face (Loaded Die) shows a small "Forced" badge.
- If my `DiceTotaled` total differs from the face (extra dice, Overdrive's ×2), a caption reads "Move {total}" for 1.2 s. The total arrives when everyone has rolled, often in a later update than my roll, so the caption may show on its own after the die has gone.
- With reduced motion on, there's no tumble: the face shows at once.
- Size: about a third of the screen's short side, capped at 160 px. It never covers the dock or the stage bar.
- The 3D dice above every piece stay as they are.

### 4.3 Card popup closes on pick

`CardPickPopup` unmounts the moment I pick a card, before the host's view catches up. Today it stays up, dimmed, through the whole reveal. A reroll keeps it open. My row's "Card picked" status and the dock's waiting state cover the rest of the window.

### 4.4 Card bubbles

*Revised 2026-10-09: the first version hung the bubbles over the pieces; the user meant one line beside each player's row in the player column.*

- When the cards flip (the `cardReveal` beat for the public `CardSelected` events), a one-line bubble pops out to the left of each caster's row in the right-hand player column, mine included, with a small tail pointing at the row.
- It shows the card's icon medal, its name in bold, and a short summary (`CARD_SUMMARIES` in `hud/labels.ts`, approved by the user; for example "Shield · Block the next attack"). It is ringed by rarity, at most `min(46cqw, 380px)` wide, with an ellipsis as a safety net.
- It stays until 0.8 s after that caster's `CardResolved` beat ends (`hud/bubbles.ts`).
- It hides while that row's details card is open, and never takes pointer events.
- With reduced motion on, bubbles appear without the pop.
- The player-column chips and their hover details stay.

### 4.5 Finish: winner cam, then ranks

- A new beat, `ranks`, follows the victory beat in the update that holds `MatchWon`.
- During it, the camera switches to the overview.
- A rank badge ("2nd", "3rd", "4th", in the podium colours) pops over each non-winner's piece, from last place up to 2nd, 0.5 s apart. Tied players share a rank and pop together. The badges then hold for 1.2 s.
- Duration: 0.5 s × the number of distinct non-winning ranks, plus 1.2 s.
- The end screen opens when this beat ends; `onFinished` already waits for the update to settle.
- With reduced motion on, the badges appear without the pop.

### 4.6 Spec #2 text

- **§5.1:** `DieRolled` adds "and your own die in the centre of the screen". `CardSelected` adds "and a speech bubble with the card's effect over each caster". `MatchWon` reads "Victory sequence (≈3 s), then the ranks reveal over the overview, then the end screen".
- **§5.3:** adds "Ranks reveal: overview".
- **§6.1:** adds the thinner lanes and the no-crossing rule.

## 5. Testing

- **Core:**
  - `drawCard` never returns an excluded card.
  - A dealt hand has three different cards.
  - A reroll avoids the hand and the seen cards, and falls back to seen cards when the rarity runs out.
  - `validateConfig` rejects a rarity with too few cards.
  - A property test: no hand ever holds a duplicate across random matches.
  - Layout: `tileCell` matches the old client values for all 100 tiles; `laneGap` is 0 for crossing lanes.
  - Generator: no snake pair closer than `LANE_CLEARANCE` across 200 seeds, and boards still pass analysis.
  - Golden snapshots updated, and the simulator compared before and after (§3.5).
- **Client:**
  - The centre die shows my face, the "Move" caption and the forced badge, and skips the tumble with reduced motion.
  - The popup closes on pick and stays open on reroll.
  - Bubbles appear at the reveal for each caster and leave after that caster's resolution.
  - The `ranks` beat follows `victory`, its duration follows the rule above, the camera uses the overview during it, and the end screen comes after it.
  - Lanes use `laneCenterline`.
  - The scene budget test passes.
- **End to end:** `pnpm e2e` stays green. It plays whole matches through the new beats.

## 6. Out of scope

- Themed board layouts beyond the 10×10 grid (planned later; §3.3 keeps the layout in one module).
- Keeping card-made slides (Snake Pit) clear of other lanes.
- Racing for 2nd–4th place after the first finish.
