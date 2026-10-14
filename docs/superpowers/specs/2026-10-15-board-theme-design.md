# Board theme: the Sky Course (design)

**Status:** approved in conversation 2026-10-15; this file awaits the user's review.
**Replaces:** Spec #5 §4.3 (Step 3: the world: candy island, bumpers, cloud puffs, podium, five floating toy props) and its plan, `docs/superpowers/plans/2026-10-09-art-pass-step3.md`. Everything else in Spec #5 still holds: the finishes (§3), the `art/` build (§5), slots and fallbacks (§6), and A11 (sculpted, not assembled).
**Reviewed visually:**
- the three directions (Version 2 of <https://claude.ai/artifact/W5hpRymv44SgtJGrjAqj78>);
- the chosen direction with the user's changes (Version 3 of the same page).

That page is a **preview only**, built from browser shapes. Every 3D object in the game is sculpted in Blender (B2).

---

## 1. What this delivers

The world around the board becomes a **sky obstacle course**:
- the board sits on a floating inflatable platform;
- toy props stand on the platform's side wings, like a TFT arena;
- obstacle platforms float around it, with clouds below.

The board itself gets bigger squares and wider gaps. The match camera gains a drag-to-pan when zoomed in.

Success means:
- **The look:** the match and the menu read as one soft, inflatable, game-show-in-the-sky world in the Tangerine Dusk palette, and the board stays the clear centre of every overview.
- **Readable board:** bigger squares with visible gaps. Pieces, jump ends, symbols and lanes keep their size.
- **Camera:** it never turns. At the overview it's locked. Zoomed in, a drag moves it within limits over the board.
- **Performance:** the match stays within 100 draw calls and 150,000 triangles on High, and 100,000 on Low. Phones keep their frame rate.
- **Never broken:** a missing model file falls back to a plain stand-in (§6), as today.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| B1 | **Sky Course.** The board on a floating inflatable platform; obstacle platforms float around it; clouds below; no audience. | User's pick of three directions ("I like simple things like sky course"). |
| B2 | **Every 3D object is a Blender model**, sculpted headless from `art/` scripts (`pnpm art`), as in Spec #5. The browser preview's shapes are never shipped. | User: "remember to use blender for every 3d obj. what's on the artifact is only for preview". |
| B3 | **Bigger squares, wider gaps.** The step between squares goes from 2.0 to 2.7. The square model goes from 1.9 to 2.3 across, so the gap goes from 0.1 to 0.4 and the deck shows between squares. The board becomes 27 × 27. Pieces, jump ends, symbols, lanes and the shapes of trails keep their size; only positions spread out. | User: "make the tiles bigger, and also with the gaps wider". |
| B4 | **Props on the wings, TFT-style.** The platform is wider than the board, with a wing on each side. Left wing: a rocket, a big die and a stack of poker chips. Right wing: a fan of "?" cards, the crown, and a flag. Nothing stands in front of the board or between the camera and any square. | User: "add some objects like cards, or rockets, or any random objects on the side of the board. just like TFT". |
| B5 | **The camera never turns, and pans only when zoomed in.** At the overview zoom, dragging does nothing. Closer than the overview, one finger or the mouse drags the view. The limit grows the closer the zoom, up to the board's edges. Zooming back out pulls it home. | User: "the in game camera must not be able to rotate. only dragging … to have a closer look of the furthest tiles … but limited … the camera must be zoomed in a bit". This was the user's later-fix note 4 (2026-10-15), now built here. |
| B6 | **Reduced motion slows the world, not stops it.** The world's idle motion (props, obstacles, clouds) runs at a quarter of the speed and amplitude. | User's later-fix note 2 ("reduced motion is different than disable motion"), applied to everything new here. The rest of the game's reduced-motion pass stays in the later-fix batch. |
| B7 | **Old plan 3's world is dropped:** the candy rock, the bumper posts, the sphere clouds and the five floating toy props. | Replaced by B1 and B4. |

## 3. The look

All finishes are Spec #5 §3.1:
- satin plastic for the decks, cushions and the platform's stripes;
- glossy plastic for the obstacles' moving parts and the props;
- glow for the rocket's flame.

Colours come from `theme.ts` (`WORLD_COLORS`, renamed where a token's meaning changes; §6).

| Part | Look |
|---|---|
| **Platform** (match) | A cream deck with rounded corners, 0.8 thick with soft edges, about 52 × 38 (the board's 27, a wing of about 12 each side, and about 5.5 in front and behind, so the start row's waiting spots at z ≈ 15.9 stand clear of the rim). A thick padded rim (tube radius about 1.2) runs round its edge, striped pink and cream like a bouncy castle. Under it, a soft tangerine cushion narrows to a knot. One sculpted surface per material. |
| **Obstacles** | Five floating discs, each a cream pad with a mint rim and a tangerine cushion under it, carrying one obstacle: a **sweeper** (a post and a long pink bar), three bouncy **mushrooms** (pink and violet caps), three **hoops** (gold, cyan, lime), a **fan** (four peach blades on a hub), and a lime **ramp**. |
| **Stepping pads** | Five small round pads, cyan and lime, rising in a line from behind the board's left corner into the distance. |
| **Clouds** | Chunky cream cloud puffs below the platform's level and around it, so the board feels high up. |
| **Props** (B4) | Toy-sized up: rocket about 7 tall; die about 3.2; chips about 2.6 tall; cards about 4.3 tall; crown about 3 across; flag about 6 tall. |
| **Menu** | The podium (top, band and base in the podium tokens) stands on a small copy of the platform: a round cream deck, a striped rim and a cushion, with clouds below. The floating tiles behind it stay. |

Props reuse the game's models where they exist, scaled up:
- the rocket: `pad.glb`, the jump start, tinted pink, no symbol;
- the die and the crown: new light models (`prop_die`, `prop_crown`; the game's die and crown would take 8,000 of the budget's triangles); the crown stands on the deck, without a cushion;
- the flag: `target.glb`, the jump end, tinted tangerine, no symbol.

New props: the chips, the cards, the die and the crown. Each card has a purple face with a raised cream "?" and a pink back.

**The board sits on the deck.** The squares rest on the deck's top. The start row's waiting spots (tile 0) stay in front of the board, on the deck.

## 4. Layout

All in world units. The board is centred at the origin; +Z is toward the camera.

- **Board half-width:** 13.5 (10 × 2.7 / 2).
- **Start spots:** tile 0's start spots stand on the deck (y = −0.3), so the pieces waiting to start don't float.
- **Platform deck:** half-width 26, half-depth 19, top at y = 0, so the squares stand on it as they stand on the island today.
- **Props:** centred on the wings, |x| between 19 and 22:

| | Back (z ≈ −7) | Middle (z ≈ 2) | Front (z ≈ 10) |
|---|---|---|---|
| **Left** | rocket | die | chips |
| **Right** | cards | crown | flag |

  Each prop sits on the deck, turned a little toward the camera. The exact spots are settled at the review.
- **Obstacles:** outside the platform, at the sides and back, between 30 and 60 from the centre, at y between 1 and 8. None is in front of the board (z > 19), so nothing passes between the camera and the board.
- **Clouds:** a ring 45 to 85 from the centre, at y ≈ −16. High draws 8 clouds and Low 4 (`QualityProfile.clouds`).
- **Shadows:** the sun's shadow box covers the board and the start row, as before; the world casts no shadows (it only receives the pieces'), to keep within the budget.

## 5. Camera (B5)

**The overview.** Its defaults in `apps/client/public/tuning.json` scale with the board (×1.35):
- `distance`: 23.4 → 31.6;
- `height`: 24.4 → 32.9;
- `zoomMin`: 0.6 → 0.45, so a full zoom-in can get close to the far squares;
- `zoomMax`: stays 1.4.

The overview's aim point (toward the start row) scales the same way. The follow, swoop and card shots keep their offsets around the piece.

**Panning**
- **Settings:** new tuning keys `camera.pan.lockAbove` (default 0.95) and `camera.pan.tapSlopPx` (default 6), checked by `mergeTuning` like the others.
- **When it works:** only when the zoom is below `lockAbove` and the camera is on the overview. At or above it, a drag does nothing.
- **The limit:** the look-at point may move within a box over the board, scaled by `f = clamp((lockAbove − zoom) / (lockAbove − zoomMin), 0, 1)`:
  - x: within ±13.5 · f;
  - z: from the overview's aim toward the far row by up to (13.5 + aimZ) · f, and toward the near row by up to (13.5 − aimZ) · f.
  
  At f = 0 the box is the overview's own point. At f = 1 it reaches the board's edges.
- **Dragging:** the world follows the finger or mouse; one screen-height of drag moves about the visible depth.
- **Zooming out:** the box shrinks every frame and clamps the point, so the camera eases home.
- **Taps:** a press that moves more than `tapSlopPx` is a drag. On release it does not count as a tap, so it doesn't peek at a tile or tap a piece. A press that moves less is a tap, as today.
- **Two fingers** still pinch-zoom; the pan pauses during a pinch.
- **When the pan resets:** it goes back to the centre whenever the shot leaves the overview (a follow, a swoop, a card shot, a face-off). It is kept while the shot stays on the overview, including a peek. The zoom is kept as today.
- **Never turns:** neither yaw nor pitch changes; only the look-at point moves, and the camera moves with it.

## 6. How the game uses them

**Slots.** New `SlotName`s:
- `platform`, which replaces `island`;
- `cloud`;
- `step` (a stepping pad, instanced);
- `obstacle.sweeper`, `obstacle.mushrooms`, `obstacle.hoops`, `obstacle.fan`, `obstacle.ramp`;
- `prop.chips`, `prop.cards`;
- `podium`;
- `menu.platform`.

`SLOT_FILES` lists each once its model lands.

**Moving parts.** A moving part is its own model, standing on a shared `course_pad` model: the sweeper, the fan, each hoop and each mushroom. The game spins, sways or squashes the whole part, and bobs it together with its pad. Props idle gently: the rocket bobs, the cards sway, the crown turns, the flag's pennant swings.

**Fallbacks.** A file that fails to load leaves a plain stand-in and warns once (Spec #5 §6):
- a flat cream deck for the platform;
- nothing for the obstacles, props and clouds.

**Theme tokens.** In `WORLD_COLORS`:
- `islandTop` becomes `deck` (cream);
- `islandRock` becomes `cushion` (tangerine);
- `bumper` becomes `rim` (pink, cream);
- new `course` (mint) for the obstacles' rims;
- `PODIUM_COLORS.island` follows.

`art/lib/palette.py` mirrors the changes.

**Board constants** (`scene/layout.ts`):
- `TILE_SIZE` (the step) becomes 2.7;
- a new `TILE_ACROSS` = 2.3 is the square's width, used by the tile model, the menu's floating tiles and the flat Low icons;
- `PIECE_SCALE` and `PARTS` are unchanged, so pieces and parts keep their size.

`BOARD_SCALE` is defined as before, so what it scales (the camera aim, shadows) grows with the board.

**Motion and quality**
- The world's idle motion runs from one `useFrame`, scaled by B6 under reduced motion.
- Low quality keeps the whole world, with no shadows and 4 clouds, as today.

## 7. Budget

Priced as `art/test/budget.test.ts` prices a busy match. The code-built island, bumpers and clouds were never in that price, so the room is about 14,300 triangles on High. The world aims at about 13,000 triangles and 23 draw calls, and no world part casts a shadow.

Measured with the built models (2026-10-15):

| Part | Copies | Triangles each | Draw calls |
|---|---|---|---|
| Platform | 1 | 3,192 | 3 |
| Cloud | 8 | 200 | 1 |
| Stepping pad | 5 | 96 | 1 |
| Course pad | 5 | 324 | 3 |
| Sweeper, fan, ramp | 1 each | 300, 350, 300 | 1 each |
| Mushroom | 3 | 288 | 1 |
| Hoop | 3 | 200 | 1 |
| Chip | 6 | 112 | 1 |
| Card | 3 | 350 | 2 |
| Die prop, crown prop | 1 each | 610, 700 | 2, 1 |
| Rocket and flag (reused) | 1 each | 1,014, 600 | 3, 1 |

The world comes to 13,952 triangles and 23 draw calls. A busy match prices at 94 draw calls and 149,614 triangles on High, and 73 calls and 80,298 triangles on Low. To make that room, the trails' arrowheads are spaced by the board's step (0.3 of a step, as many to a tile as on the 2.0 board): the 27-wide board had made every trail 1.35 times as long. The whole-match limits (§1) are the ones that hold.

Menu models: the podium ≤ 1,600 and the menu platform ≤ 1,000 (both lathed).

## 8. Checks and review

These stay simple, as the user asked.
- **Unit:**
  - `scene/pan.ts`: `panLimit(zoom, …)`, `clampPan(point, limit)`, `dragPan(point, dxPx, dyPx, …)`, and the tap-versus-drag slop;
  - `mergeTuning` takes and rejects the two pan keys;
  - the layout tests updated to the new step;
  - the shot rule that resets the pan when the shot leaves the overview.
- **Art:**
  - the model contract (`art/contract.ts`) covers each new model's size, materials, and triangle target;
  - `art/test` checks the built files, as for the pieces;
  - the tile model is 2.3 across.
- **Drag:** a unit test of the drag controller (`PanDrag`) stands in for a browser check, since a fast e2e match moves the camera itself. The review screenshots show the pan.
- **Review:** match and menu screenshots from the headless browser (Spec #5 A8) go on the review page. The user reviews the world in the game before it's merged.

## 9. Out of scope

- Other board styles and sizes (a later spec; layout and lane geometry stay swappable).
- The rest of the user's later-fix batch:
  - Low ends centred and "?"-sized;
  - reduced motion across the whole game;
  - phone cards as bubbles.
  
  They stay in the handoff's Open items.
- Sounds for the world.
