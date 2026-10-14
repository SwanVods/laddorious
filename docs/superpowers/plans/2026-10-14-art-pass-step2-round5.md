# Spec #5 Step 2, the last round: a bigger board, flat ends on Low, simple trails, pieces beside rockets and flags, hidden name tags, the crown on the winner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline; the user's standing rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Step 2 with the six changes the user asked for at their fifth look (2026-10-14), then merge Step 2 and move on to Step 3.

**Architecture:** All five live in the client. One art change: the tile model grows with the board. The rest is scene code:
- **Board size:** `layout.ts` (the tile size and a board scale that the camera, island and shadow box follow).
- **Flat ends:** a flat-ends layer drawn instead of the 3D ends on Low.
- **Positions:** a pure rule in `motion.ts` for where pieces stand on a rocket or flag tile.
- **Reactions:** small reactions in `Jumps.tsx`.
- **Name tags:** a tag-visibility rule in `TagProjector`.
- **Crown:** a crown that follows the winner.

**Tech Stack:** React 19, R3F 9.8, three 0.186, Vitest, Playwright; Blender 5.2 headless for the tile.

**Spec:** `docs/superpowers/specs/2026-10-09-art-pass-design.md` (A13–A16 so far; this round adds A17).

## What the user decided (2026-10-14)

1. **Low quality:** only the ladder and portal ends become flat images on the tiles (rocket, flag, whirlpool, splat). Pieces, dice and the crown stay 3D. The 3D ends show on High only.
2. **Wider tiles:** the whole board bigger, each square larger.
3. **Name tags:** hidden unless hovered (mouse) or tapped (phone, shown for a few seconds). Your own piece's name stays visible.
4. **Crown at the finish:** it flies from tile 100 onto the winner's head, with a little bounce and a sparkle, and stays there through the end screen.
5. **Rockets and flags:** pieces that land on one stand clear of it and the object reacts, for one piece or several.
6. **Trails:** the rocket's trail and the slide's channel become low-poly, simple 3D objects that read as a trail (added while this plan was being written).

## Global Constraints

- Everything in plan 2's Global Constraints holds:
  - colours only from `theme.ts`, nothing black on the jump parts (A16);
  - commit at the end of every task with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer;
  - builds headless only;
  - a busy match within 100 draw calls and 150,000 triangles on High, and under 100,000 triangles on Low.
- Pieces, the rockets, flags, whirlpools, splats and their symbols keep their sizes. Only the squares grow.
- Tests stay simple (the user, 2026-10-14). Prefer pure functions with plain unit tests. A multiplayer test that would need new scaffolding is deferred and listed in the HANDOFF, not built.

## Decisions made while planning (each is the user's to change at review)

- **How much bigger:** a square goes from 1.6 to 2.0 units, 25% wider. The board becomes 20 × 20 units instead of 16 × 16.
  - A new `BOARD_SCALE = TILE_SIZE / 1.6` (1.25) sizes the things fitted to the old board: the overview camera's distance and height, the island's radius, the shadow camera's box, and the clouds' ring.
  - Pieces and parts keep their size, so each square has more room around them.
  - The overview camera pulls back to fit, so on screen everything looks about the same size as now, with more space between.
- **Flat ends on Low:** four canvas-drawn icons, seen from above:
  - a rocket with its porthole;
  - a flag;
  - a swirl;
  - a splat.

  Each is drawn white with grey shading, so the instance colour paints it the pair colour. They're four instanced flat meshes, one per kind (4 draw calls, 2 triangles a copy). The pair symbols lie flat on them, and the whirlpool icon spins like the 3D one. On Low the four 3D end models are neither loaded nor drawn.
- **Where pieces stand on a rocket or flag tile:** instead of stacking on top of each other, they stand in a row in front of the object, toward the camera.
  - The row's centre is 0.55 in front of the tile's centre, with pieces 0.5 apart. Four pieces fit across the 1.9-wide square.
  - The same rule applies on Low, so a piece is always where you expect it.
  - Every other tile keeps today's stacking.
- **Reactions:**
  - **Rocket:** when a piece launches from it, the rocket gives a quick shake and squash, and its flame flares (0.5 s).
  - **Flag:** when a piece lands at it, the flag waves (a sway about its pole) and gives a small pop (0.6 s).
  - On Low the flat icons give a small pop instead.
  - Reduced motion turns all of these off.
- **Name tags:**
  - Your own tag always shows.
  - Another player's tag shows while the mouse is over their piece, or for 3 s after you tap the piece (tapping again restarts the 3 s).
  - The player list in the HUD is unchanged.
- **Trails, simple and low-poly (both qualities):**
  - **A rocket's trail:** a puffy smoke trail. Twelve chunky low-poly puffs (icosahedrons, 20 faces each) in the pair colour, spaced along today's arc and growing slightly from the rocket to the flag. Each puff pops in one after another (the same 0.35 s reveal), and they bob gently while shown.
  - **A slide's trail:** a dashed line of chunky flat arrowheads (a 6-sided wedge, 0.04 thick) in the pair colour, spaced along the lane and pointing down toward the splat. They pop in one after another and drift slowly along the lane while shown.
  - Both are instanced meshes, one for puffs and one for arrowheads, at 2 draw calls in all however many paths show. They replace the swept trough, the channel walls and floor, and their chevron textures.
- **Crown:**
  - Before the win it spins on tile 100, as today.
  - On the victory beat it rises, flies along an arc onto the winner's head, and settles with a bounce (1.2 s). A ring of gold sparkles bursts as it lands (0.8 s, one instanced draw).
  - It then sits on the head, turning slowly, through the ranks reveal and the end screen.
  - The head's height is measured from the winner's piece model at that moment, so it fits every piece.

## Review Focus

1. **A crowded flag tile.** Four pieces on one flag: none overlaps the pole, the pennant or each other. Pinned in Task R10.
2. **A flag tile that also has a face-off.** Face-offs keep their own side-by-side layout, which already clears the flag at the larger square. Pinned in Task R10.
3. **Switching quality mid-match.** Auto stepping down from High to Low swaps the 3D ends for flat ones with no missing ends. Pinned in Task R9 (a scene rendered at each level).
4. **A tap that lands on a piece standing on a ladder tile.** It shows that piece's name and doesn't also peek the path. Pinned in Task R11.
5. **The win while the camera swoops.** The crown reaches the head even if the winner was still moving at the start of the victory beat; it aims at where the head will be. Pinned in Task R12.

---

### Task R8: A bigger board

**Files:**
- `apps/client/src/scene/layout.ts`;
- `camera.ts`;
- `Surroundings.tsx`;
- `art/models/tile.py`;
- `art/contract.ts`;
- their tests.

- [ ] Tests first:
  - `layout.test.ts`: neighbouring tiles' centres are 2.0 apart, and the board spans 20 units.
  - `camera.test.ts`: the overview sees all four board corners. Project the corners with the overview shot and the scene camera's 42° field of view at a landscape phone's aspect ratio (844 × 390); every corner lands on screen.
  - `scene.test.tsx`: the island's top reaches past every board corner, and the bumpers ring the bigger board (already derived from `TILE_SIZE`).
  - The art contract: the tile is 1.9 wide (`maxWidth 1.91`).
- [ ] Run them, and watch them fail.
- [ ] Implement:
  - set `TILE_SIZE = 2.0` and add `BOARD_SCALE`;
  - scale the overview radius, height and target, the island radius, the shadow box and the clouds' ring by it;
  - set the tile script's `SIZE = 1.9`, rebuild `tile`, and preview it.
- [ ] `pnpm test`, then a browser check: the overview at 1280 × 720 and as a landscape phone, with the whole board in view.
- [ ] Commit: `feat(client): a bigger board, each square 2.0 across`.

### Task R9: Flat ends on Low

**Files:**
- `scene/textures.ts` (the four icon textures);
- a new `scene/FlatEnds.tsx`;
- `Jumps.tsx`;
- `quality.ts` (`modelEnds: boolean`, true on High);
- `assets/slotMesh.ts` (preload the end models on High only);
- `art/test/budget.test.ts`.

- [ ] Tests first:
  - `quality.test.ts`: `modelEnds` is true on High and false on Low.
  - `scene.test.tsx`: on Low, the scene has the flat meshes `flat-rockets`, `flat-flags`, `flat-swirls` and `flat-splats`, with one copy per end, and none of `pads`, `targets`, `vortices` or `exits`. On High it's the other way round. Symbols are drawn at both levels.
  - Budget: the Low busy match is priced with the flat ends.
- [ ] Watch them fail, then implement:
  - `Jumps` splits into the 3D ends and `FlatEnds`, chosen by `modelEnds`;
  - on Low the symbols lie flat on the icons;
  - `preloadSlotMeshes(low)` skips the four end models.
- [ ] `pnpm test`, then a browser check as a landscape phone: flat icons in pair colours with their symbols, no end model files fetched, and no warnings.
- [ ] Commit: `feat(client): flat ladder and portal ends on Low quality`.

### Task R9b: Simple, low-poly trails

**Files:**
- `scene/tracks.ts` (`puffPoints(jump)` and `dashPoints(jump)`: places and headings along the arc and the lane);
- `Jumps.tsx` (two instanced meshes replace the per-path swept meshes);
- `assets/models.ts` (the puff and the arrowhead, code-built);
- tests.

- [ ] Tests first:
  - `tracks.test.ts`: 12 puffs run from the rocket to the flag along the arc, evenly spaced and growing. Arrowheads run from the whirlpool to the splat along the lane, each pointing on toward the splat, one every 0.6 units.
  - `scene.test.tsx`: no path is drawn at the opening; a tapped ladder shows puffs and a tapped slide shows arrowheads, in their pair colour, filling in over the reveal.
  - Budget: the shown paths are priced as puffs and arrowheads.
- [ ] Watch them fail, then implement.
  - Remove the sweep, trough and channel code and their textures where nothing else uses them; the tracks tests for them go too.
- [ ] `pnpm test`, then a browser check: tap a rocket and a whirlpool on the fixed board, and screenshot both.
- [ ] Commit: `feat(client): low-poly trails: smoke puffs for rockets, arrowheads for slides`.

### Task R10: Pieces beside rockets and flags, and the ends react

**Files:**
- `scene/motion.ts` (`restPose`, with an `endsAt(tile)` from the presentation's jumps);
- `Jumps.tsx` and `FlatEnds.tsx` (reactions);
- tests.

- [ ] Tests first, all in `motion.test.ts` with pure functions:
  - one to four pieces on a flag tile stand in a row in front of it, none within 0.35 of the pole's line or of each other;
  - the same on a rocket tile;
  - a plain tile still stacks;
  - a face-off on a flag tile keeps its side-by-side layout.

  And `endReaction(beat, jump, now)`:
  - a rocket shakes during a beat that launches a piece from it;
  - a flag waves during a beat that lands a piece at it;
  - neither moves otherwise, or with reduced motion.
- [ ] Watch them fail, then implement.
  - Pieces moving onto such a tile ease to their row spot, because the beat poses already end at `restPose`.
- [ ] `pnpm test`, then a browser check on the fixed board (seed `review-2`): put pieces on a flag tile and see them stand in front and the flag wave.
  - A quick way: a dev-only "send pieces here" control isn't worth building. Instead, play bots in the dev build until one climbs, and watch for a few rounds.
- [ ] Commit: `feat(client): pieces stand clear of rockets and flags, which react`.

### Task R11: Name tags on hover and tap

**Files:**
- `scene/tags.ts` (a `tagPeeks` store);
- `TagProjector.tsx`;
- `Pieces.tsx` (pointer handlers on each piece);
- tests.

- [ ] Tests first:
  - `tags.test.ts`, pure: `tagVisible(player, me, hovered, peeks, now)`. Mine is always shown; another player's shows while hovered or within 3 s of a tap, and is hidden otherwise.
  - `scene.test.tsx`: the projector hides other players' tags at the opening and shows one after its piece is clicked (`fireEvent` on the piece, as the tile tap test does).
- [ ] Watch them fail, then implement.
  - The piece's click stops propagation, so the tile under it doesn't also peek a path.
  - On desktop, a pointer cursor shows over pieces.
- [ ] `pnpm test`, then a browser check: other tags hidden, mine shown; clicking a bot's piece shows its name for 3 s.
- [ ] Commit: `feat(client): other players' name tags show on hover or tap`.

### Task R12: The crown flies to the winner

**Files:**
- a new `scene/Crown.tsx` (taken out of `Surroundings.tsx`);
- `scene/motion.ts` (a pure `crownPose`);
- `Pieces.tsx` (a registry of each piece's model, to measure the head);
- tests.

- [ ] Tests first, in `motion.test.ts`:
  - `crownPose` spins on tile 100 before the win;
  - at the start of the victory beat it's on tile 100;
  - halfway it's above the arc between the two points;
  - at the end it rests at the head point, plus a bounce that dies away;
  - it stays at the head during the ranks beat and after;
  - with reduced motion it cuts straight to the head.

  And `scene.test.tsx`: after a scripted win (the fixture match's `MatchWon` update), the crown sits above the winner.
- [ ] Watch them fail, then implement:
  - the sparkles are one instanced mesh of small gold quads, bursting out and fading;
  - the head height comes from the winner piece model's bounding box at the start of the victory beat.
- [ ] `pnpm test`, then a browser check: a bot match played to the end in the dev build. Screenshot the crown landing and the end screen.
- [ ] Commit: `feat(client): the crown flies onto the winner's head`.

### Task R13: Docs, the gate and the review

- [ ] Spec A17: the six decisions above, with the user's words.
- [ ] READMEs (client: flat ends, tags, crown; art: the tile size).
- [ ] HANDOFF: replace the noted requests with what was built.
- [ ] Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` (all 17), and `pnpm art tile` rebuilding byte for byte.
- [ ] Self-review against the Review Focus (a self-review; there is no subagent). Fix any Critical or Important finding with a failing test first. Minor findings go to the HANDOFF.
- [ ] Screenshots: High overview, Low overview as a phone, a rocket's smoke trail and a slide's arrowheads, a flag with pieces in front, a hover tag, the crown on the winner. Add a round section to the review page and republish it.
- [ ] Stop for the user's review. After approval: fast-forward merge `art/spec-5` into `main`, run `pnpm test` on `main`, then plan 3 (the world), amended first for the bigger board.

## Not in this round

- Bigger symbols on the rockets' portholes (the user may ask after seeing the bigger board).
- Plan 3's world. Its island, bumpers and props are placed after this round, around the bigger board.
