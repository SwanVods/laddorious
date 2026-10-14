# Board theme: the Sky Course (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, inline (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The board stands on a floating inflatable platform with TFT-style props on its wings and an obstacle course floating round it, on bigger squares with wider gaps, under a camera that never turns and pans only when zoomed in.

**Architecture:**
- **Board size:** `scene/layout.ts` sets the square step (2.7) and the square's width (2.3).
- **Pan:** a pure module (`scene/pan.ts`) holds the pan's limits and the drag. `CameraRig` wires it, and `cameraShot` adds the pan to the overview.
- **World layout:** the world is data. `scene/world.ts` lists placements of Blender models and computes each one's idle pose from the time.
- **Drawing:** `scene/World.tsx` draws each model once as an instanced mesh.
- **Models:** every model is a headless Blender script in `art/models/`. Round parts are lathed (`shapes.lathe`, one surface, exact triangle counts). Odd shapes are sculpted (`sculpt.fuse`, a single material, so they thin freely).

**Tech Stack:** pnpm monorepo. Client: React 19, R3F 9, three 0.186, zustand. Tests: Vitest (`pnpm test`), Playwright (`pnpm e2e`). Blender 5.2, headless (`pnpm art`).

**Spec:** `docs/superpowers/specs/2026-10-15-board-theme-design.md` (approved 2026-10-15). Spec #5 (`2026-10-09-art-pass-design.md`) §3, §5 and §6 still hold.

## Decisions made while planning

These amend the spec in Task 1, Step 1.

1. **Moving parts are their own model files, not named meshes** (spec §6).
   - Why: the build merges a model into one mesh, and the contract forbids node transforms.
   - So the parts are separate models: the sweeper, the fan and each hoop and mushroom. Each stands on a shared `course_pad` model.
   - The game spins, sways or squashes the whole part and bobs it with its pad.
   - Cost if wrong: none for the look. The pad and its part share one bob, so they never drift apart.
2. **The die and crown props are new, light models** (`prop_die`, `prop_crown`), not the game's die (2,138 triangles) and crown (6,000).
   - Why: the budget test leaves about 14,300 triangles on High, and those two would take 8,000 of them.
   - The crown has no cushion, to save a material.
   - The rocket and flag props reuse `pad.glb` and `target.glb` (1,014 and 600 triangles).
3. **The world is priced honestly against 14,300 triangles, not 23,000** (spec §7).
   - The 23,000 counted the code-built island, bumpers and clouds as freed room. `art/test/budget.test.ts` never priced them, so they don't free anything in its accounting.
   - The world aims at about 13,000 triangles and 23 draw calls (71 + 23 = 94).
   - No world part casts a shadow: they receive only.
4. **Lathed, not fused, for round multi-colour parts.**
   - `sculpt.fuse` keeps every colour boundary at full voxel detail, so a striped rim or a two-colour pad can't thin to a few hundred triangles.
   - `shapes.lathe` turns one profile into one closed surface, painted band by band, with an exact triangle count. It's still one curved surface, never glued parts.
   - The platform is the same idea round a rounded rectangle, built with `shapes.grid` directly.
5. **Pieces at the start stand on the deck.** Tile 0's spots are at y = −`TILE_THICKNESS` (the deck's top), not 0, so they don't float 0.3 above it. No start strip is modelled.
6. **The pan check is a unit test of the drag controller**, not Playwright (spec §8). A fast e2e match moves the camera on its own every beat, so a browser check would be flaky. The review screenshots show the pan.
7. **The hemisphere light keeps its teal ground colour** as a new `WORLD_COLORS.groundLight`. `islandRock` was also the light's ground colour, and renaming it to the tangerine `cushion` would recolour the lighting.
8. **The overview's slow drift goes.** `overview()` swayed the camera by up to ±0.12 rad. Spec B5 says it never turns.
9. **Fog moves out:** `Fog(fog, 70, 190)` instead of `(36, 95)`. The overview camera is now about 46 from the board, so the old fog would grey the board itself.

## Global Constraints

- Every 3D object in the game is a Blender model built headless (`pnpm art <ids>`, `BLENDER=E:/Software/Blender/blender.exe`). Never build in the user's open Blender. The browser sketch is a preview only (spec B2).
- Colours only from `apps/client/src/app/theme.ts` / `theme.css` (`apps/client/test/tokens.test.ts`). `art/lib/palette.py` holds only colours that appear in `theme.ts` (`art/test/palette.test.ts`).
- Square step 2.7, square width 2.3, board 27 × 27. Pieces, `PARTS`, lanes and `PIECE_SCALE` keep their sizes (spec B3).
- The camera never turns. The pan works only while the zoom is below `camera.pan.lockAbove` (default 0.95) and the shot is the overview (spec B5, §5).
- Reduced motion runs the world's idle motion at a quarter of its speed and size (spec B6).
- Budgets (`art/test/budget.test.ts`, gating):
  - a busy match on High stays at or under 100 draw calls and 150,000 triangles;
  - on Low, under 100,000 triangles.
- The world aims at 94 draw calls or fewer (spec §7).
- Commit at the end of every task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After `pnpm test`, restore the golden snapshot's line endings if git shows it modified (`git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap`).
- Work on branch `art/board-theme` from `main`. A local fast-forward merge comes only after the user approves the review.
- Tests stay simple (the user's rule). Pure functions are tested directly, and anything needing new multiplayer scaffolding is deferred to the HANDOFF.

## Review Focus

1. **A drag that starts on a tile or a piece while zoomed in.** It pans and does not peek a path or show a name tag; a still tap still does. Pinned in Task 2 (`isTap`, and the Board and Pieces handlers).
2. **Zooming out mid-pan.** The camera eases back over the board and never shows sky past the board's edge. Pinned in Task 2 (`panBox` shrinks to the point at the lock zoom).
3. **The game taking the camera mid-pan** (my roll's swoop, a card shot). The pan resets, and the overview after it is centred. Pinned in Task 2 (`panAfterShot`).
4. **A world model that fails to load.** The platform falls back to a plain deck, and the others are left out; nothing crashes and nothing is counted as drawn. Pinned in Task 3 (World stand-ins are hidden when empty).
5. **Reduced motion.** The world still moves, at a quarter of the speed and size, and never stops dead. Pinned in Task 3 (`worldPose`).

## File map

| File | Change |
|---|---|
| `apps/client/src/scene/layout.ts` | `TILE_SIZE` 2.7, new `TILE_ACROSS`, `BOARD_HALF`, `PLATFORM`, `COURSE`, `MENU_PLATFORM`; tile 0 on the deck |
| `apps/client/src/assets/models.ts`, `scene/Board.tsx`, `scene/MenuScene.tsx` | square width from `TILE_ACROSS` |
| `art/models/tile.py`, `art/contract.ts`, `art/README.md` | the 2.3 tile |
| `apps/client/src/app/tuning.ts`, `public/tuning.json`, `apps/client/README.md` | overview ×1.35, `zoomMin` 0.45, `camera.pan` |
| `apps/client/src/scene/pan.ts` (new) | pan limits, drag, tap test |
| `apps/client/src/scene/camera.ts`, `CameraRig.tsx`, `Board.tsx`, `Pieces.tsx` | pan wiring, no drift, tap guard |
| `apps/client/src/app/theme.ts`, `art/lib/palette.py` | world tokens |
| `apps/client/src/scene/world.ts`, `World.tsx` (new) | placements, poses, instanced drawing |
| `apps/client/src/scene/Surroundings.tsx`, `MatchScene.tsx`, `MenuScene.tsx` | the new world |
| `apps/client/src/assets/slotFiles.ts` | new slots, files |
| `art/lib/shapes.py` | `lathe`, `capsule`, `rounded_rect` |
| `art/models/*.py` (new) | `platform`, `cloud`, `step`, `course_pad`, `sweeper`, `mushroom`, `hoop`, `fan`, `ramp`, `chip`, `card`, `prop_die`, `prop_crown`, `podium`, `menu_platform` |
| `art/test/budget.test.ts` | the world priced |
| `docs/superpowers/HANDOFF.md`, the spec | state, amendments |

---

### Task 1: Bigger squares, the overview to match, and the spec's amendments

> Spec B3: "make the tiles bigger, and also with the gaps wider". Spec §5: the overview scales ×1.35.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-board-theme-design.md`
- Modify: `apps/client/src/scene/layout.ts`, `apps/client/src/assets/models.ts:197`, `apps/client/src/scene/Board.tsx:50`, `apps/client/src/scene/MenuScene.tsx:37`
- Modify: `art/models/tile.py`, `art/contract.ts` (tile rule), `art/README.md` (the rules)
- Modify: `apps/client/src/app/tuning.ts`, `apps/client/public/tuning.json`, `apps/client/README.md` (Admin settings table)
- Modify: `apps/client/src/scene/Surroundings.tsx` (the fog only)
- Test: `apps/client/test/layout.test.ts`, `apps/client/test/models.test.ts`, `apps/client/test/camera.test.ts`

**Interfaces:**
- Produces:
  - `TILE_SIZE = 2.7`;
  - `TILE_ACROSS = 2.3`;
  - `BOARD_HALF = 13.5`;
  - `PLATFORM = { deckTop: 6.0, rimTop: 7.3, halfWidth: 26, halfDepth: 19 }`;
  - `COURSE = { padTop: 2.0, padRadius: 5 }`;
  - `MENU_PLATFORM = { deckTop: 1.2, radius: 2.3 }`;
  - `tileToWorld(0, seat)[1] === -TILE_THICKNESS`.

- [ ] **Step 1: Branch, and amend the spec with the planning decisions**

```bash
git checkout -b art/board-theme main
```

In the spec, make these edits:
- **§6, "Moving parts":** replace the paragraph with: "**Moving parts.** A moving part is its own model, standing on a shared `course_pad` model: the sweeper, the fan, each hoop and each mushroom. The game spins, sways or squashes the whole part, and bobs it together with its pad."
- **§3, the props paragraph:** replace "the die: `die.glb`" and "the crown: `crown.glb`" with "the die and the crown: new light models (`prop_die`, `prop_crown`; the game's die and crown would take 8,000 of the budget's triangles); the crown stands on the deck, without a cushion".
- **§2, B4:** replace "the crown on a cushion" with "the crown".
- **§7:** replace the opening paragraphs with: "Priced as `art/test/budget.test.ts` prices a busy match. The code-built island, bumpers and clouds were never in that price, so the room is about 14,300 triangles on High. The world aims at about 13,000 triangles and 23 draw calls, and no world part casts a shadow." Replace the table with the one in this plan's Task 8.
- **§8:** replace the end-to-end bullet with: "**Drag:** a unit test of the drag controller (`PanDrag`) stands in for a browser check, since a fast e2e match moves the camera itself. The review screenshots show the pan."
- **§4:** add: "Tile 0's start spots stand on the deck (y = −0.3), so the pieces waiting to start don't float."

- [ ] **Step 2: Write the failing layout tests**

In `apps/client/test/layout.test.ts`:
- Replace the assertions `expect(TILE_SIZE).toBe(2);` and `expect(TILE_SIZE * COLUMNS).toBe(20);` with `expect(TILE_SIZE).toBe(2.7);` and `expect(TILE_SIZE * COLUMNS).toBeCloseTo(27);`.
- Change `toBeCloseTo(20)` on line 25 to `toBeCloseTo(27)`.

Then add:

```ts
import { BOARD_HALF, PLATFORM, TILE_ACROSS, TILE_THICKNESS } from '../src/scene/layout';

describe('the bigger squares (board theme spec B3)', () => {
  it('draws 2.3 squares on a 2.7 step, leaving a 0.4 gap', () => {
    expect(TILE_ACROSS).toBe(2.3);
    expect(TILE_SIZE - TILE_ACROSS).toBeCloseTo(0.4);
    expect(BOARD_HALF).toBeCloseTo(13.5);
  });

  it('stands the start spots on the deck, inside the platform', () => {
    for (let seat = 0; seat < 4; seat++) {
      const [x, y, z] = tileToWorld(0, seat);
      expect(y).toBe(-TILE_THICKNESS);
      expect(Math.abs(x)).toBeLessThan(PLATFORM.halfWidth);
      expect(z).toBeLessThan(PLATFORM.halfDepth - 1.5);
    }
  });
});
```

In `apps/client/test/models.test.ts:28`, change `TILE_SIZE * 0.95` to `TILE_ACROSS`, and import `TILE_ACROSS` from `'../src/scene/layout'`.

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/layout.test.ts apps/client/test/models.test.ts`
Expected: FAIL. `TILE_ACROSS` and `BOARD_HALF` are not exported, and `TILE_SIZE` is 2.

- [ ] **Step 4: Implement the layout**

In `apps/client/src/scene/layout.ts`, replace the block from `/** World units per tile` through `const HALF = …` with:

```ts
/** The scene scales piece models by this. */
export const PIECE_SCALE = 1.3;

/** World units from one square's centre to the next (board theme spec B3: bigger squares, wider gaps). */
export const TILE_SIZE = 2.7;
/** A square's width across (the tile model, art/models/tile.py): 0.4 of deck shows between squares. */
export const TILE_ACROSS = 2.3;
/** How much bigger the board is than the first one (1.6 a square): the camera's aim and the shadows scale by this. */
export const BOARD_SCALE = TILE_SIZE / 1.6;
/** Tiles are this thick; their top faces sit at y = 0. */
export const TILE_THICKNESS = 0.3;
export const COLUMNS = BOARD_COLUMNS;
const HALF = (COLUMNS - 1) / 2;
/** Half the board's width, edge to edge. */
export const BOARD_HALF = (TILE_SIZE * COLUMNS) / 2;

/**
 * The platform the board stands on (board theme spec §3, §4), built to these by art/models/platform.py,
 * heights from the model's base (its cushion's knot): the deck's top, where the tiles stand; the rim's top;
 * and the deck's half sizes.
 */
export const PLATFORM = { deckTop: 6.0, rimTop: 7.3, halfWidth: 26, halfDepth: 19 } as const;
/** A floating obstacle's pad (art/models/course_pad.py): its top, where its obstacle stands, and its radius. */
export const COURSE = { padTop: 2.0, padRadius: 5 } as const;
/** The menu's little platform under the podium (art/models/menu_platform.py): its deck's top and its radius. */
export const MENU_PLATFORM = { deckTop: 1.2, radius: 2.3 } as const;
```

In `tileToWorld`, change the tile-0 line to:

```ts
  // Start spots stand on the deck in front of the board (board theme spec §4).
  if (tile <= 0) return [(seat - 1.5) * TILE_SIZE * 0.8, -TILE_THICKNESS, (HALF + 1.4) * TILE_SIZE];
```

Then update the square's width in three places:
- In `apps/client/src/assets/models.ts:197`, replace `TILE_SIZE * 0.95` twice with `TILE_ACROSS`, and import it.
- In `apps/client/src/scene/Board.tsx:50`, replace `new PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9)` with `new PlaneGeometry(TILE_ACROSS * 0.95, TILE_ACROSS * 0.95)`, and import `TILE_ACROSS`.
- In `apps/client/src/scene/MenuScene.tsx:37`, write `const MENU_TILE = { across: 0.6 / TILE_ACROSS, up: 0.14 / TILE_THICKNESS } as const;`. Import `TILE_ACROSS` instead of `TILE_SIZE`; drop `TILE_SIZE` from the import if unused.

- [ ] **Step 5: Run the layout tests**

Run: `pnpm vitest run apps/client/test/layout.test.ts apps/client/test/models.test.ts`
Expected: PASS.

- [ ] **Step 6: The tile model at 2.3**

In `art/models/tile.py`:
- Set `SIZE = 2.3   # the game's TILE_ACROSS: 0.4 of deck shows between squares on the 2.7 step`.
- Change the docstring's mention of `TILE_SIZE (2.0)` to match.

In `art/contract.ts`, change the tile rule's `maxWidth: 1.91` to `maxWidth: 2.31`.

In `art/README.md`, replace the first rule with: "- Squares stand 2.7 apart and are 2.3 across (board theme spec B3), leaving a 0.4 gap. Z is up, and models face −Y (Blender's front view). The export turns that into the game's Y up and +Z forward."

Run:

```bash
BLENDER=E:/Software/Blender/blender.exe pnpm art tile
pnpm vitest run art/test
```

Expected:
- the build prints `tile 196 triangles … 0.30 tall`;
- the art tests PASS, and the budget is unchanged (same triangles).

- [ ] **Step 7: Write the failing overview tests**

In `apps/client/test/camera.test.ts`:
- Replace the test `'drifts gently over the overview, and holds still with reduced motion'` with the test below.
- Read that test's old body first: keep its use of the file's `shot()` helper.

```ts
  it('never turns: the overview stays square to the board, whatever the time (board theme spec B5)', () => {
    for (const nowMs of [0, 2250, 4500, 9000, 14_000]) {
      const { position, target } = shot({ nowMs });
      expect(position[0]).toBe(target[0]);
    }
  });
```

In `apps/client/test/tuning.test.ts`, add:

```ts
  it('scales the overview with the 27-wide board (board theme spec §5)', () => {
    expect(DEFAULT_TUNING.camera.overview).toEqual({ distance: 31.6, height: 32.9, zoomMin: 0.45, zoomMax: 1.4 });
  });
```

- [ ] **Step 8: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/camera.test.ts apps/client/test/tuning.test.ts`
Expected:
- FAIL: the camera's x follows `Math.sin(nowMs / 9000) * 0.12`;
- FAIL: the overview defaults are still 23.4 and 24.4.

- [ ] **Step 9: Implement**

In `apps/client/src/app/tuning.ts`, set `overview: { distance: 31.6, height: 32.9, zoomMin: 0.45, zoomMax: 1.4 }`.

In `apps/client/public/tuning.json`, set the same four values.

In `apps/client/README.md`, change the Admin settings rows:
- `camera.overview.distance` → 31.6;
- `height` → 32.9;
- `zoomMin` → 0.45.

In `apps/client/src/scene/camera.ts`, replace `overview()` with:

```ts
function overview(input: ShotInput): Shot {
  // How far back and how high come from tuning.json (2026-10-15). It never turns (board theme spec B5).
  const { overview } = tuning().camera;
  const zoom = input.zoom ?? 1;
  return {
    mode: 'overview',
    position: [0, overview.height * zoom, overview.distance * zoom + OVERVIEW_TARGET_Z],
    target: [0, 0, OVERVIEW_TARGET_Z],
    cut: false,
  };
}
```

In the comment above the final `return overview(input)` in `cameraShot`, change "the whole board, drifting gently" to "the whole board".

In `apps/client/src/scene/Surroundings.tsx`, change the fog to `new Fog(WORLD_COLORS.fog, 70, 190)`, with the comment `// The overview sits about 46 from the board (board theme spec §5): the fog starts beyond it.`

- [ ] **Step 10: Run the whole suite**

Run: `pnpm test > .superpowers/t1.log 2>&1; tail -30 .superpowers/t1.log`

Expected: PASS. The camera test `'keeps every corner of the bigger board on screen…'` must still pass: it is the check that the ×1.35 overview frames the 27-wide board on a landscape phone.

If a test that pins old sizes fails (a `20` board, a 1.9 tile), update it to the new constant, and record which in the ledger.

Then restore the snapshot's line endings if they show as modified.

- [ ] **Step 11: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap 2>/dev/null; git add -A apps/client art docs/superpowers/specs
git commit -m "feat(client): bigger squares with wider gaps, a camera that never turns, the overview scaled to match

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pan when zoomed in

> Spec B5 and §5: the camera never turns. At the overview it's locked; zoomed in, one finger or the mouse drags it within limits over the board.

**Files:**
- Create: `apps/client/src/scene/pan.ts`
- Modify:
  - `apps/client/src/app/tuning.ts` (`camera.pan`), `apps/client/public/tuning.json`, `apps/client/README.md`;
  - `apps/client/src/scene/camera.ts` (`ShotInput.pan`, export `OVERVIEW_TARGET_Z`);
  - `apps/client/src/scene/CameraRig.tsx`;
  - `apps/client/src/scene/Board.tsx` (tile `onClick`), `apps/client/src/scene/Pieces.tsx` (piece `onClick`).
- Test: `apps/client/test/pan.test.ts` (new), `apps/client/test/tuning.test.ts`, `apps/client/test/camera.test.ts`

**Interfaces:**
- Consumes: `BOARD_HALF` (Task 1).
- Produces:
  - `type Pan = readonly [x: number, z: number]`, `NO_PAN`;
  - `panReach(zoom, lockAbove, zoomMin): number`;
  - `panBox(reach, half, aimZ): PanBox`, `clampPan(pan, box): Pan`;
  - `unitsPerPixel(height, viewHeightPx): number`, `dragPan(pan, dx, dy, perPixel): Pan`;
  - `panAfterShot(pan, mode): Pan`, `isTap(movedPx, slopPx): boolean`;
  - `class PanDrag { down(id, x, y); move(id, x, y, slopPx): { dx, dy } | null; up(id); readonly dragging: boolean }`;
  - `Tuning['camera']['pan'] = { lockAbove: number; tapSlopPx: number }`;
  - `ShotInput.pan?: Pan`.

- [ ] **Step 1: Write the failing pan tests**

Create `apps/client/test/pan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NO_PAN, PanDrag, clampPan, dragPan, isTap, panAfterShot, panBox, panReach, unitsPerPixel } from '../src/scene/pan';

// Panning the zoomed-in overview (board theme spec B5, §5).

describe('the pan', () => {
  it('reaches nowhere at or above the lock zoom, and to the board's edges fully zoomed in', () => {
    expect(panReach(1, 0.95, 0.45)).toBe(0);
    expect(panReach(0.95, 0.95, 0.45)).toBe(0);
    expect(panReach(0.7, 0.95, 0.45)).toBeCloseTo(0.5);
    expect(panReach(0.45, 0.95, 0.45)).toBe(1);
    expect(panReach(0.3, 0.95, 0.45)).toBe(1);
  });

  it('keeps the look-at point over the board: further toward the far rows, as the overview aims toward the near ones', () => {
    expect(panBox(1, 13.5, 6.75)).toEqual({ minX: -13.5, maxX: 13.5, minZ: -20.25, maxZ: 6.75 });
    expect(panBox(0, 13.5, 6.75)).toEqual({ minX: -0, maxX: 0, minZ: -0, maxZ: 0 });
  });

  it('clamps an offset into the box, so zooming out pulls the camera home', () => {
    const box = panBox(0.5, 13.5, 6.75);
    expect(clampPan([20, -30], box)).toEqual([6.75, -10.125]);
    expect(clampPan([1, 1], box)).toEqual([1, 1]);
    expect(clampPan([5, -5], panBox(0, 13.5, 6.75)).map(Math.abs)).toEqual([0, 0]); // a point box: home (0 or -0)
  });

  it('moves the board with the finger: a drag right looks further left, a drag down looks further away', () => {
    const per = unitsPerPixel(20, 400);
    expect(per).toBeCloseTo(0.055);
    const [x, z] = dragPan(NO_PAN, 100, 100, per);
    expect(x).toBeCloseTo(-5.5);
    expect(z).toBeCloseTo(-7.15);
  });

  it('resets when the game takes the camera, and keeps it on the overview', () => {
    expect(panAfterShot([3, -4], 'overview')).toEqual([3, -4]);
    expect(panAfterShot([3, -4], 'follow')).toBe(NO_PAN);
    expect(panAfterShot([3, -4], 'swoop')).toBe(NO_PAN);
  });

  it('tells a tap from a drag by how far the press moved', () => {
    expect(isTap(0, 6)).toBe(true);
    expect(isTap(6, 6)).toBe(true);
    expect(isTap(7, 6)).toBe(false);
  });
});

describe('PanDrag', () => {
  it('moves nothing until the press passes the slop, then gives each step', () => {
    const drag = new PanDrag();
    drag.down(1, 100, 100);
    expect(drag.move(1, 103, 102, 6)).toBeNull();
    expect(drag.dragging).toBe(false);
    expect(drag.move(1, 110, 100, 6)).toEqual({ dx: 10, dy: 0 });
    expect(drag.dragging).toBe(true);
    expect(drag.move(1, 115, 90, 6)).toEqual({ dx: 5, dy: -10 });
    drag.up(1);
    expect(drag.dragging).toBe(false);
  });

  it('stops when a second finger lands (a pinch), and ignores the other finger', () => {
    const drag = new PanDrag();
    drag.down(1, 0, 0);
    expect(drag.move(1, 20, 0, 6)).toEqual({ dx: 20, dy: 0 });
    drag.down(2, 200, 0);
    expect(drag.move(1, 40, 0, 6)).toBeNull();
    expect(drag.move(2, 220, 0, 6)).toBeNull();
    drag.up(2);
    expect(drag.move(1, 60, 0, 6)).toBeNull(); // the pinch's first finger doesn't start panning again
    drag.up(1);
    drag.down(3, 0, 0);
    expect(drag.move(3, 10, 0, 6)).toEqual({ dx: 10, dy: 0 });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/pan.test.ts`
Expected: FAIL, "Cannot find module '../src/scene/pan'".

- [ ] **Step 3: Implement `pan.ts`**

Create `apps/client/src/scene/pan.ts`:

```ts
import type { ShotMode } from './camera';

// Panning the zoomed-in overview (board theme spec B5, §5): the camera never turns. Closer than the
// overview, a drag moves the point it looks at, and the camera with it, inside a box over the board that
// grows as the zoom closes in. At the overview's own zoom the box is a point, so the camera stays put.

/** The look-at point's offset from the overview's own, on the ground: x across, z toward the camera. */
export type Pan = readonly [x: number, z: number];
export const NO_PAN: Pan = [0, 0];

export interface PanBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** How far the pan may reach at a zoom: 0 at or above `lockAbove`, 1 fully zoomed in. */
export function panReach(zoom: number, lockAbove: number, zoomMin: number): number {
  if (lockAbove <= zoomMin) return 0;
  return Math.min(1, Math.max(0, (lockAbove - zoom) / (lockAbove - zoomMin)));
}

/**
 * The box the offset stays in: up to half the board's width each way across; toward the far row as far as
 * the far edge, and toward the near row as far as the near edge, measured from the overview's aim, which
 * sits `aimZ` toward the near row.
 */
export function panBox(reach: number, half: number, aimZ: number): PanBox {
  return { minX: -half * reach, maxX: half * reach, minZ: -(half + aimZ) * reach, maxZ: (half - aimZ) * reach };
}

export function clampPan([x, z]: Pan, box: PanBox): Pan {
  return [Math.min(box.maxX, Math.max(box.minX, x)), Math.min(box.maxZ, Math.max(box.minZ, z))];
}

/** World units a pixel of drag moves, for a camera this high: about the visible depth per screen height. */
export function unitsPerPixel(height: number, viewHeightPx: number): number {
  return (height * 1.1) / Math.max(1, viewHeightPx);
}

/**
 * The offset after a drag of (dx, dy) pixels: the board follows the finger. Up and down the screen moves a
 * little further, as the camera sees the ground at a slant.
 */
export function dragPan([x, z]: Pan, dx: number, dy: number, perPixel: number): Pan {
  return [x - dx * perPixel, z - dy * perPixel * 1.3];
}

/** When the game takes the camera (a follow, a swoop, a card shot), the pan goes back to the middle. */
export function panAfterShot(pan: Pan, mode: ShotMode): Pan {
  return mode === 'overview' ? pan : NO_PAN;
}

/** A press that moved no further than the slop is a tap: it peeks a tile or shows a name. Further, it was a drag. */
export function isTap(movedPx: number, slopPx: number): boolean {
  return movedPx <= slopPx;
}

/**
 * One finger or the mouse dragging the view. A press moves nothing until it passes the slop, so a tap stays
 * a tap; a second finger (a pinch) ends the drag until every finger has lifted.
 */
export class PanDrag {
  private id: number | null = null;
  private start = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private moving = false;
  private fingers = 0;

  down(id: number, x: number, y: number): void {
    this.fingers += 1;
    if (this.fingers > 1) {
      this.id = null;
      this.moving = false;
      return;
    }
    this.id = id;
    this.start = { x, y };
    this.last = { x, y };
  }

  /** The movement since the last step once the press is past the slop; null before that, or for another finger. */
  move(id: number, x: number, y: number, slopPx: number): { dx: number; dy: number } | null {
    if (id !== this.id) return null;
    if (!this.moving) {
      if (Math.hypot(x - this.start.x, y - this.start.y) <= slopPx) return null;
      this.moving = true;
    }
    const step = { dx: x - this.last.x, dy: y - this.last.y };
    this.last = { x, y };
    return step;
  }

  up(id: number): void {
    this.fingers = Math.max(0, this.fingers - 1);
    if (id === this.id) {
      this.id = null;
      this.moving = false;
    }
  }

  get dragging(): boolean {
    return this.moving;
  }
}
```

- [ ] **Step 4: Run them**

Run: `pnpm vitest run apps/client/test/pan.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tuning and camera tests**

In `apps/client/test/tuning.test.ts`, add:

```ts
  it('reads the pan settings, and refuses a lock zoom above 1 or at the closest zoom (board theme spec §5)', () => {
    expect(DEFAULT_TUNING.camera.pan).toEqual({ lockAbove: 0.95, tapSlopPx: 6 });
    expect(mergeTuning({ camera: { pan: { lockAbove: 0.8, tapSlopPx: 10 } } }).tuning.camera.pan).toEqual({ lockAbove: 0.8, tapSlopPx: 10 });
    for (const lockAbove of [1.5, 0.45, 0.2]) {
      const { tuning, problems } = mergeTuning({ camera: { pan: { lockAbove } } });
      expect(tuning.camera.pan.lockAbove).toBe(0.95);
      expect(problems.join()).toContain('camera.pan.lockAbove');
    }
  });
```

In `apps/client/test/camera.test.ts`, add:

```ts
  it('moves the overview by the pan, camera and aim together, and only the overview (board theme spec B5)', () => {
    const still = shot({ zoom: 0.5 });
    const panned = shot({ zoom: 0.5, pan: [3, -4] });
    expect(panned.target).toEqual([still.target[0] + 3, 0, still.target[2] - 4]);
    expect(panned.position).toEqual([still.position[0] + 3, still.position[1], still.position[2] - 4]);
    expect(shot({ beat: beatOf('move', [moved('p1')]), pan: [3, -4] })).toEqual(shot({ beat: beatOf('move', [moved('p1')]) }));
  });
```

The last line uses the file's existing `beatOf` and `moved` helpers.

- [ ] **Step 6: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/tuning.test.ts apps/client/test/camera.test.ts`
Expected: FAIL. `camera.pan` is undefined, and `pan` is not read.

- [ ] **Step 7: Implement the settings and the shot**

In `apps/client/src/app/tuning.ts`:
- In `Tuning['camera']`, after `overview`, add:

  ```ts
      /** Dragging the zoomed-in overview: it pans only below this zoom (1 = the overview as set), and a press that moves further than tapSlopPx is a drag, not a tap. */
      pan: { lockAbove: number; tapSlopPx: number };
  ```

- In `DEFAULT_TUNING.camera`, add `pan: { lockAbove: 0.95, tapSlopPx: 6 },`.
- Add `'camera.pan.lockAbove'` to `POSITIVE`.
- In `mergeTuning`, after the zoom-range check, add:

  ```ts
    const { pan } = tuning.camera;
    if (pan.lockAbove > 1 || pan.lockAbove <= overview.zoomMin) {
      problems.push('camera.pan.lockAbove should be above zoomMin and 1 or less');
      pan.lockAbove = defaults.camera.pan.lockAbove;
    }
  ```

In `apps/client/public/tuning.json`, add `"pan": { "lockAbove": 0.95, "tapSlopPx": 6 }` inside `"camera"`.

In `apps/client/README.md`'s Admin settings table, add the row: `| camera.pan.lockAbove, tapSlopPx | 0.95, 6 | Zoomed in closer than lockAbove, a drag pans the overview over the board; at the overview it stays locked. A press moving more than tapSlopPx pixels is a drag, not a tap. |`.

Then extend the "Camera zoom" bullet with: "Zoomed in closer than `camera.pan.lockAbove`, one finger or the mouse drags the view over the board (`src/scene/pan.ts`); the camera never turns, and the pan resets when the game takes the camera."

In `apps/client/src/scene/camera.ts`:
- Add `import type { Pan } from './pan';`.
- Export the aim: `export const OVERVIEW_TARGET_Z = 4 * BOARD_SCALE;`.
- Add to `ShotInput`:

  ```ts
    /** The overview's pan when zoomed in (board theme spec B5): the look-at point's offset, already kept over the board. */
    pan?: Pan;
  ```

- Make `overview()`:

  ```ts
  function overview(input: ShotInput): Shot {
    // How far back and how high come from tuning.json (2026-10-15). It never turns; zoomed in, it pans (board theme spec B5).
    const { overview } = tuning().camera;
    const zoom = input.zoom ?? 1;
    const [x, z] = input.pan ?? [0, 0];
    const aim = OVERVIEW_TARGET_Z + z;
    return { mode: 'overview', position: [x, overview.height * zoom, overview.distance * zoom + aim], target: [x, 0, aim], cut: false };
  }
  ```

- [ ] **Step 8: Run them**

Run: `pnpm vitest run apps/client/test/tuning.test.ts apps/client/test/camera.test.ts apps/client/test/pan.test.ts`
Expected: PASS.

- [ ] **Step 9: Wire the drag into CameraRig**

In `apps/client/src/scene/CameraRig.tsx`:
- Import `{ NO_PAN, PanDrag, clampPan, dragPan, panAfterShot, panBox, panReach, unitsPerPixel, type Pan }` from `'./pan'`.
- Import `{ cameraShot, OVERVIEW_TARGET_Z, type ShotMode }` from `'./camera'`, and `BOARD_HALF` from `'./layout'`.

Next to `zoomRef`, add:

```tsx
  // The zoomed-in overview's pan (board theme spec B5), and the last shot's kind: only the overview pans.
  const panRef = useRef<Pan>(NO_PAN);
  const modeRef = useRef<ShotMode>('overview');
```

Inside the listeners' `useEffect`, add `const drag = new PanDrag();`, then change three handlers:
- **`onDown`:** add `drag.down(e.pointerId, e.clientX, e.clientY);` first.
- **`onMove`:** replace its body with:

  ```tsx
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && fingers.size === 2) {
        zoomRef.current = pinchZoom(pinch.zoom, pinch.gap, gap(), limits());
        return;
      }
      const { overview, pan } = tuning().camera;
      const step = drag.move(e.pointerId, e.clientX, e.clientY, pan.tapSlopPx);
      if (!step || modeRef.current !== 'overview' || zoomRef.current >= pan.lockAbove) return;
      panRef.current = dragPan(panRef.current, step.dx, step.dy, unitsPerPixel(overview.height * zoomRef.current, canvas.clientHeight));
  ```

- **`onUp`:** add `drag.up(e.pointerId);` first.

In `useFrame`, before `cameraShot`, add:

```tsx
    const { overview, pan } = tuning().camera;
    panRef.current = clampPan(panRef.current, panBox(panReach(zoomRef.current, pan.lockAbove, overview.zoomMin), BOARD_HALF, OVERVIEW_TARGET_Z));
```

Pass `pan: panRef.current,` into `cameraShot({...})`. Right after the shot, add:

```tsx
    modeRef.current = shot.mode;
    panRef.current = panAfterShot(panRef.current, shot.mode);
```

The existing `const { follow, swoop } = tuning().camera;` stays as it is.

- [ ] **Step 10: A drag isn't a tap**

In `apps/client/src/scene/Board.tsx`, make the tiles' `onClick`:

```tsx
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // A drag that pans the zoomed-in view isn't a tap (board theme spec §5).
          if (!isTap(e.delta, tuning().camera.pan.tapSlopPx)) return;
          if (e.instanceId !== undefined) onTap?.(e.instanceId + 1);
        }}
```

Import `isTap` from `'./pan'` and `tuning` from `'../app/tuning'`.

In `apps/client/src/scene/Pieces.tsx`, make the piece group's `onClick`:

```tsx
        onClick={(e) => {
          e.stopPropagation();
          if (!isTap(e.delta, tuning().camera.pan.tapSlopPx)) return;
          tagPeeks?.tap(seat.playerId, Date.now());
        }}
```

Add the same imports.

- [ ] **Step 11: Run the suite, typecheck, lint, then look**

```bash
pnpm test > .superpowers/t2.log 2>&1; tail -30 .superpowers/t2.log
pnpm typecheck && pnpm lint
```

Expected: PASS and clean.

Then a quick look:
1. Start the preview (`preview_start` with the client dev server from `.claude/launch.json`).
2. Start a bot match.
3. Wheel-zoom in and drag. The view moves; at the default zoom a drag does nothing.
4. Zoom out: the camera eases back to the middle.

If there's no launch config yet, skip the look; Task 8's screenshots cover it.

- [ ] **Step 12: Commit**

```bash
git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap 2>/dev/null; git add -A apps/client
git commit -m "feat(client): pan the zoomed-in overview by dragging; locked at the overview, never turning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The world as placements, drawn instanced (with stand-ins)

> Spec §4 and §6: the world is placements of Blender models. Each one idles, slower and smaller with reduced motion (B6).

**Files:**
- Modify: `apps/client/src/app/theme.ts` (world tokens), `art/lib/palette.py`, `apps/client/test/tokens.test.ts`
- Modify: `apps/client/src/assets/slotFiles.ts` (slot names)
- Create: `apps/client/src/scene/world.ts`, `apps/client/src/scene/World.tsx`
- Modify: `apps/client/src/scene/Surroundings.tsx`, `apps/client/src/scene/MatchScene.tsx:62`
- Modify: `art/test/budget.test.ts` (the world's uses)
- Test: `apps/client/test/world.test.ts` (new), `apps/client/test/scene.test.tsx`

**Interfaces:**
- Consumes: `PLATFORM`, `COURSE`, `MENU_PLATFORM`, `TILE_THICKNESS` (Task 1).
- Produces:
  - `SlotName` adds `'platform' | 'cloud' | 'step' | 'course.pad' | 'course.sweeper' | 'course.mushroom' | 'course.hoop' | 'course.fan' | 'course.ramp' | 'prop.chip' | 'prop.card' | 'prop.die' | 'prop.crown' | 'podium' | 'menu.platform'`, and drops `'island'`;
  - `interface Motion`, `interface Placement`, `worldPose(p, t, reduced): Pose`, `REDUCED_SHARE = 0.25`;
  - `matchWorld(clouds: number): Placement[]`, `menuWorld(clouds: number, podiumX: number): Placement[]`;
  - `<WorldParts placements clearcoat reducedMotion />`; each slot is drawn as an `instancedMesh` named `world-<slot>`;
  - `WORLD_COLORS`: `deck`, `cushion`, `rim`, `course`, `groundLight` (dropping `islandTop`, `islandRock`, `bumper`). `PODIUM_COLORS` drops `island` and `chunk`.

- [ ] **Step 1: Write the failing world tests**

Create `apps/client/test/world.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BOARD_HALF, PLATFORM, TILE_THICKNESS } from '../src/scene/layout';
import { REDUCED_SHARE, matchWorld, menuWorld, worldPose, type Placement } from '../src/scene/world';

// The world round the board (board theme spec §3, §4, B6).

const bob: Placement = { slot: 'step', at: [1, 2, 3], motion: { bob: { amp: 1, speed: 1, phase: 0 } } };

describe('worldPose', () => {
  it('leaves a still part where it was placed, turned and tilted as placed', () => {
    const pose = worldPose({ slot: 'prop.die', at: [4, -0.3, 2], turn: 0.7, tilt: [0.1, 0.2], scale: 2 }, 12.3, false);
    expect(pose).toEqual({ position: [4, -0.3, 2], rotation: [0.1, 0.7, 0.2], scale: [2, 2, 2] });
  });

  it('bobs, spins, sways, squashes and drifts with time', () => {
    expect(worldPose(bob, Math.PI / 2, false).position[1]).toBeCloseTo(3);
    expect(worldPose({ slot: 'course.sweeper', at: [0, 0, 0], motion: { spin: 2 } }, 1, false).rotation[1]).toBeCloseTo(2);
    expect(worldPose({ slot: 'prop.card', at: [0, 0, 0], turn: 1, motion: { sway: { amp: 0.5, speed: 1 } } }, Math.PI / 2, false).rotation[1]).toBeCloseTo(1.5);
    const squashed = worldPose({ slot: 'course.mushroom', at: [0, 0, 0], motion: { squash: { speed: 1, phase: 0 } } }, -Math.PI / 2, false).scale;
    expect(squashed[1]).toBeCloseTo(0.88);
    expect(squashed[0]).toBeGreaterThan(1);
    const drifted = worldPose({ slot: 'cloud', at: [10, 0, 0], motion: { orbit: 0.5 } }, Math.PI, false).position;
    expect(Math.hypot(drifted[0], drifted[2])).toBeCloseTo(10);
    expect(drifted[2]).toBeCloseTo(-10);
  });

  it('keeps moving with reduced motion, at a quarter of the speed and size (spec B6)', () => {
    expect(REDUCED_SHARE).toBe(0.25);
    // A quarter the speed: time t reduced is time t / 4 at full speed. A quarter the size: the swing is 0.25 high.
    const reduced = worldPose(bob, 2 * Math.PI, true).position[1] - 2;
    expect(reduced).toBeCloseTo(0.25 * Math.sin(Math.PI / 2));
    expect(worldPose({ slot: 'course.fan', at: [0, 0, 0], motion: { spin: 4 } }, 1, true).rotation[1]).toBeCloseTo(1);
  });
});

describe('the match world', () => {
  const world = matchWorld(8);

  it('stands the platform so its deck is where the tiles stand', () => {
    const platform = world.filter((p) => p.slot === 'platform');
    expect(platform).toHaveLength(1);
    expect(platform[0]!.at[1] + PLATFORM.deckTop).toBeCloseTo(-TILE_THICKNESS);
  });

  it('puts the props on the wings, never over the board or in front of it (spec B4)', () => {
    const props = world.filter((p) => p.slot.startsWith('prop.') || p.slot === 'pad' || p.slot === 'pad.target');
    expect(props.length).toBeGreaterThanOrEqual(6);
    for (const p of props) {
      expect(Math.abs(p.at[0]), p.slot).toBeGreaterThan(BOARD_HALF + 2);
      expect(Math.abs(p.at[0]), p.slot).toBeLessThan(PLATFORM.halfWidth - 1);
      expect(p.at[2], p.slot).toBeLessThan(PLATFORM.halfDepth - 1);
    }
  });

  it('floats the course off the platform, at the sides and back, never in front (spec §4)', () => {
    const course = world.filter((p) => p.slot.startsWith('course.') || p.slot === 'step');
    expect(course.filter((p) => p.slot === 'course.pad')).toHaveLength(5);
    for (const p of course) {
      const out = Math.abs(p.at[0]) > PLATFORM.halfWidth + 2 || p.at[2] < -(PLATFORM.halfDepth + 2);
      expect(out, `${p.slot} at ${p.at.join(', ')}`).toBe(true);
      expect(p.at[2], p.slot).toBeLessThan(PLATFORM.halfDepth);
    }
  });

  it('bobs each obstacle with its pad', () => {
    const pads = world.filter((p) => p.slot === 'course.pad');
    for (const pad of pads) {
      const riders = world.filter((p) => p.slot.startsWith('course.') && p.slot !== 'course.pad' && Math.hypot(p.at[0] - pad.at[0], p.at[2] - pad.at[2]) < 6);
      expect(riders.length).toBeGreaterThan(0);
      for (const r of riders) expect(r.motion?.bob).toEqual(pad.motion?.bob);
    }
  });

  it('draws as many clouds as the quality asks', () => {
    expect(matchWorld(4).filter((p) => p.slot === 'cloud')).toHaveLength(4);
    expect(world.filter((p) => p.slot === 'cloud')).toHaveLength(8);
  });
});

describe('the menu world', () => {
  it('stands the podium on its little platform, with the clouds', () => {
    const world = menuWorld(8, -0.6);
    const podium = world.find((p) => p.slot === 'podium')!;
    const platform = world.find((p) => p.slot === 'menu.platform')!;
    expect(podium.at[0]).toBe(-0.6);
    expect(platform.at[0]).toBe(-0.6);
    expect(platform.at[1]).toBeLessThan(podium.at[1]);
    expect(world.filter((p) => p.slot === 'cloud')).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/world.test.ts`
Expected: FAIL, "Cannot find module '../src/scene/world'".

- [ ] **Step 3: The world tokens**

In `apps/client/src/app/theme.ts`, in `WORLD_COLORS`, replace `islandTop`, `islandRock` and `bumper` with:

```ts
  /** The platform's deck and the course's pads (board theme spec §3). */
  deck: '#fff7ec',
  /** The soft cushions under the platform and the pads. */
  cushion: '#ff9a3d',
  /** The platform's rim stripes, pink and cream. */
  rim: ['#ff5470', '#fff7ec'],
  /** The obstacle pads' rims. */
  course: '#5ff0c5',
  /** The hemisphere light's ground colour (was the island's rock). */
  groundLight: '#0f5d63',
```

In `PODIUM_COLORS`, drop `island` and `chunk`. In `apps/client/test/tokens.test.ts:25`, expect `{ top: '#fff3e3', band: '#ff9a3d', base: '#147676', ring: '#ff5470' }`.

In `art/lib/palette.py`, add after `PINK`:

```python
CUSHION = '#ff9a3d'   # the platform's and pads' cushions; the podium's band
LIME = '#b8f03c'
CYAN = '#33d6ff'
VIOLET = '#b48cff'
PEACH = '#ffc184'
MYSTERY = '#8f4dff'   # the "?" cards
PODIUM_BASE = '#147676'
```

- [ ] **Step 4: The slots**

In `apps/client/src/assets/slotFiles.ts`, in `SlotName`, replace `| 'island'` with:

```ts
  | 'platform'
  | 'cloud'
  | 'step'
  | 'course.pad'
  | 'course.sweeper'
  | 'course.mushroom'
  | 'course.hoop'
  | 'course.fan'
  | 'course.ramp'
  | 'prop.chip'
  | 'prop.card'
  | 'prop.die'
  | 'prop.crown'
  | 'podium'
  | 'menu.platform'
```

- [ ] **Step 5: Implement `world.ts`**

Create `apps/client/src/scene/world.ts`:

```ts
import { PAIR_COLORS, WORLD_COLORS } from '../app/theme';
import type { SlotName } from '../assets/slotFiles';
import { COURSE, MENU_PLATFORM, PLATFORM, TILE_THICKNESS, type Vec3 } from './layout';

// The world round the board (board theme spec §3, §4): the platform, the props on its wings, the obstacle
// course floating round it, the stepping pads and the clouds, as placements of Blender models. Pure, so
// the idle motion can be tested; World.tsx draws them, one instanced mesh per model.

export interface Motion {
  /** Up and down: how far, how fast (radians a second) and where in the swing it starts. */
  bob?: { amp: number; speed: number; phase: number };
  /** Turning round its own vertical, radians a second. */
  spin?: number;
  /** Rocking round its own vertical: how far (radians) and how fast. */
  sway?: { amp: number; speed: number };
  /** Squashing on its base like a bouncy mushroom: how fast, and where it starts. */
  squash?: { speed: number; phase: number };
  /** Drifting round the world's centre, radians a second (the clouds). */
  orbit?: number;
}

export interface Placement {
  slot: SlotName;
  /** Where the model's base stands. */
  at: Vec3;
  /** Its turn about the vertical (radians). */
  turn?: number;
  /** Its lean (radians) about x and z: the rotation is Euler XYZ [tilt x, turn, tilt z], so a z tilt leans it in its own plane first. */
  tilt?: readonly [x: number, z: number];
  scale?: number;
  /** The colour of a Tint model. */
  color?: string;
  motion?: Motion;
}

export interface Pose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

/** Reduced motion keeps the world moving, at this share of its speed and of its size (spec B6). */
export const REDUCED_SHARE = 0.25;

/** Where a placed model is at time t (seconds). */
export function worldPose(p: Placement, t: number, reduced: boolean): Pose {
  const k = reduced ? REDUCED_SHARE : 1;
  const time = t * k;
  const m = p.motion ?? {};
  let [x, y, z] = p.at;
  if (m.orbit) {
    const a = m.orbit * time;
    [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  }
  if (m.bob) y += m.bob.amp * k * Math.sin(time * m.bob.speed + m.bob.phase);
  const turn = (p.turn ?? 0) + (m.spin ?? 0) * time + (m.sway ? m.sway.amp * k * Math.sin(time * m.sway.speed) : 0);
  const s = p.scale ?? 1;
  const squash = m.squash ? 1 + 0.12 * k * Math.sin(time * m.squash.speed + m.squash.phase) : 1;
  const wide = 1 + (1 - squash) * 0.6;
  return { position: [x, y, z], rotation: [p.tilt?.[0] ?? 0, turn, p.tilt?.[1] ?? 0], scale: [s * wide, s * squash, s * wide] };
}

/** The deck's top, where the tiles stand. */
const DECK = -TILE_THICKNESS;
/** The middle of each wing, either side of the board. */
const WING = 19.5;
/** The obstacles' bob: a slow float, offset by where each is. */
const floatAt = (x: number) => ({ amp: 0.6, speed: 0.6, phase: x });

type Rider = Omit<Placement, 'at' | 'motion'> & { offset: Vec3; motion?: Motion };

/** A floating obstacle: its pad, and what stands on it, bobbing together. */
function obstacle(at: Vec3, padScale: number, riders: Rider[]): Placement[] {
  const bob = floatAt(at[0]);
  const top = at[1] + COURSE.padTop * padScale;
  return [
    { slot: 'course.pad', at, scale: padScale, motion: { bob } },
    ...riders.map(({ offset, motion, ...rest }): Placement => ({ ...rest, at: [at[0] + offset[0], top + offset[1], at[2] + offset[2]], motion: { ...motion, bob } })),
  ];
}

/** The chips' colours, bottom to top. */
const CHIPS = [PAIR_COLORS.all.pink, WORLD_COLORS.deck, WORLD_COLORS.course, WORLD_COLORS.crown, PAIR_COLORS.all.pink];

/** The match's world, with this many clouds (QualityProfile.clouds). */
export function matchWorld(clouds: number): Placement[] {
  return [
    { slot: 'platform', at: [0, DECK - PLATFORM.deckTop, 0] },
    // Props on the wings, like a TFT arena (spec B4). Left, from the back: a rocket (the jump's), a die, chips.
    { slot: 'pad', at: [-WING, DECK + 0.3, -7], scale: 9, turn: 0.4, color: PAIR_COLORS.all.pink, motion: { bob: { amp: 0.25, speed: 1.6, phase: 0 } } },
    { slot: 'prop.die', at: [-WING - 0.5, DECK, 2.5], turn: 0.7 },
    ...CHIPS.map((color, i): Placement => ({ slot: 'prop.chip', at: [-WING - 1 + Math.sin(i) * 0.08, DECK + i * 0.37, 10], turn: i * 0.5, color })),
    { slot: 'prop.chip', at: [-WING + 1.3, DECK + 1.0, 10.6], tilt: [0.2, 1.1], color: WORLD_COLORS.course },
    // Right, from the back: a fan of "?" cards, the crown, a flag (the jump's end).
    ...[-1, 0, 1].map((k): Placement => ({ slot: 'prop.card', at: [WING + k * 0.5, DECK, -7.5 + k * 0.08], turn: -0.35, tilt: [-0.16, k * -0.32], motion: { sway: { amp: 0.12, speed: 0.7 } } })),
    { slot: 'prop.crown', at: [WING, DECK, 2], motion: { spin: 0.4 } },
    { slot: 'pad.target', at: [WING - 0.5, DECK, 10], scale: 4.7, turn: -0.3, color: WORLD_COLORS.cushion, motion: { sway: { amp: 0.08, speed: 2 } } },
    // The obstacle course, floating at the sides and back (spec §4).
    ...obstacle([-40, 3, -30], 1, [{ slot: 'course.sweeper', offset: [0, 0, 0], motion: { spin: 1.1 } }]),
    ...obstacle(
      [42, 1, -26],
      1,
      [0, 1, 2].map((i): Rider => {
        const a = (i / 3) * Math.PI * 2;
        return { slot: 'course.mushroom', offset: [Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4], color: i % 2 ? PAIR_COLORS.all.violet : PAIR_COLORS.all.pink, motion: { squash: { speed: 3, phase: i * 2 } } };
      }),
    ),
    ...obstacle(
      [-54, 6, 4],
      0.9,
      [WORLD_COLORS.crown, PAIR_COLORS.all.cyan, PAIR_COLORS.all.lime].map((color, i): Rider => ({ slot: 'course.hoop', offset: [(i - 1) * 2.8, 0, 0], scale: 0.9, color, motion: { sway: { amp: 0.6, speed: 0.5 } } })),
    ),
    ...obstacle([56, 5, 6], 0.9, [{ slot: 'course.fan', offset: [0, 0, 0], scale: 0.9, motion: { spin: 3 } }]),
    ...obstacle([6, 8, -54], 1.2, [{ slot: 'course.ramp', offset: [0, 0, 0], scale: 1.2, turn: 0.3 }]),
    // Stepping pads leading off behind the board's left corner.
    ...[0, 1, 2, 3, 4].map((i): Placement => ({ slot: 'step', at: [-14 - i * 3.8, -1 + i * 0.7, -24 - i * 3], color: i % 2 ? PAIR_COLORS.all.cyan : PAIR_COLORS.all.lime, motion: { bob: { amp: 0.3, speed: 1.2, phase: i } } })),
    // Clouds below the platform, drifting round it.
    ...Array.from({ length: clouds }, (_, i): Placement => {
      const a = (i / clouds) * Math.PI * 2 + 0.4;
      const r = 50 + (i % 3) * 12;
      return { slot: 'cloud', at: [Math.cos(a) * r, -16 + (i % 2) * 2, Math.sin(a) * r], scale: 2 + (i % 4) * 0.4, turn: a, motion: { orbit: 0.01 } };
    }),
  ];
}

/** The menu's world: the podium on its little platform, and clouds below and behind (spec §3). */
export function menuWorld(clouds: number, podiumX: number): Placement[] {
  // The podium's base, where the code-built one stood.
  const base = -0.2;
  return [
    { slot: 'podium', at: [podiumX, base, 0] },
    { slot: 'menu.platform', at: [podiumX, base - MENU_PLATFORM.deckTop, 0] },
    ...Array.from({ length: clouds }, (_, i): Placement => ({ slot: 'cloud', at: [-9 + i * 2.6, -3.6 + (i % 3) * 0.6, -6 - (i % 2) * 3], scale: 0.45 + (i % 3) * 0.08, turn: i, motion: { bob: { amp: 0.15, speed: 0.4, phase: i } } })),
  ];
}
```

- [ ] **Step 6: Run the world tests**

Run: `pnpm vitest run apps/client/test/world.test.ts`
Expected: PASS.

If the "course floats off the platform" test fails for one placement, move that placement, not the test. The spec's rule is "never over the platform, never in front".

- [ ] **Step 7: Write the failing scene test**

In `apps/client/test/scene.test.tsx`, add inside `describe('the 3D scene (spec #2 §6)', …)`:

```tsx
  it('stands the board on the platform, and draws each world model once, hidden until it loads (board theme spec §6)', async () => {
    const root = await renderScene('high');
    const platform = root.getObjectByName('world-platform') as InstancedMesh;
    expect(platform.count).toBe(1);
    expect(platform.visible).toBe(true); // its stand-in is a plain deck
    const clouds = root.getObjectByName('world-cloud') as InstancedMesh;
    expect(clouds.count).toBe(8);
    expect(clouds.visible).toBe(false); // nothing drawn until the model loads (unit tests never load models)
    expect(root.getObjectByName('world-course.pad')).toBeTruthy();
  });
```

- [ ] **Step 8: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/scene.test.tsx -t "platform"`
Expected: FAIL. There is no object named `world-platform`.

- [ ] **Step 9: Implement `World.tsx`**

Create `apps/client/src/scene/World.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, MeshBasicMaterial, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { WORLD_COLORS } from '../app/theme';
import type { SlotName } from '../assets/slotFiles';
import { useSlotMesh, type SlotMesh } from '../assets/slotMesh';
import { MENU_PLATFORM, PLATFORM } from './layout';
import { worldPose, type Placement } from './world';

// Draws the world's placements (board theme spec §6): each model once, as an instanced mesh, every copy
// posed by its idle motion each frame. Nothing here casts a shadow; the platform receives the pieces'.

/** A world model that fails to load is left out (spec §6): an empty mesh, hidden. */
const nothing = (): SlotMesh => ({ geometry: new BufferGeometry(), material: new MeshBasicMaterial({ visible: false }) });

/** The platforms' stand-in: a plain cream deck, its top where the model's deck is. */
const plainDeck = (width: number, depth: number, top: number) => (): SlotMesh => ({
  geometry: new BoxGeometry(width, 0.8, depth).translate(0, top - 0.4, 0),
  material: new MeshStandardMaterial({ color: WORLD_COLORS.deck, roughness: 0.6 }),
});

const STAND_INS: Partial<Record<SlotName, () => SlotMesh>> = {
  platform: plainDeck(PLATFORM.halfWidth * 2, PLATFORM.halfDepth * 2, PLATFORM.deckTop),
  'menu.platform': plainDeck(MENU_PLATFORM.radius * 2, MENU_PLATFORM.radius * 2, MENU_PLATFORM.deckTop),
};

function writePoses(mesh: InstancedMesh, placements: readonly Placement[], t: number, reduced: boolean, at: Object3D): void {
  placements.forEach((p, i) => {
    const { position, rotation, scale } = worldPose(p, t, reduced);
    at.position.set(...position);
    at.rotation.set(...rotation);
    at.scale.set(...scale);
    at.updateMatrix();
    mesh.setMatrixAt(i, at.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function SlotInstances({ slot, placements, clearcoat, reducedMotion }: { slot: SlotName; placements: readonly Placement[]; clearcoat: boolean; reducedMotion: boolean }) {
  const mesh = useSlotMesh(slot, STAND_INS[slot] ?? nothing, { clearcoat });
  const ref = useRef<InstancedMesh>(null);
  const at = useMemo(() => new Object3D(), []);
  const moving = placements.some((p) => p.motion);
  useLayoutEffect(() => {
    const instances = ref.current;
    if (!instances) return;
    writePoses(instances, placements, 0, reducedMotion, at);
    if (!placements.some((p) => p.color)) return;
    const color = new Color();
    placements.forEach((p, i) => instances.setColorAt(i, p.color ? color.set(p.color) : color.setRGB(1, 1, 1)));
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  }, [mesh, placements, reducedMotion, at]);
  useFrame(({ clock }) => {
    if (moving && ref.current) writePoses(ref.current, placements, clock.elapsedTime, reducedMotion, at);
  });
  const empty = !('position' in mesh.geometry.attributes);
  return <instancedMesh ref={ref} name={`world-${slot}`} args={[mesh.geometry, mesh.material, placements.length]} visible={!empty} receiveShadow frustumCulled={false} />;
}

/** Every placement, grouped by model: one instanced mesh each. */
export function WorldParts({ placements, clearcoat, reducedMotion }: { placements: readonly Placement[]; clearcoat: boolean; reducedMotion: boolean }) {
  const groups = useMemo(() => {
    const bySlot = new Map<SlotName, Placement[]>();
    for (const p of placements) bySlot.set(p.slot, [...(bySlot.get(p.slot) ?? []), p]);
    return [...bySlot];
  }, [placements]);
  return (
    <>
      {groups.map(([slot, list]) => (
        <SlotInstances key={`${slot}-${list.length}`} slot={slot} placements={list} clearcoat={clearcoat} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}
```

- [ ] **Step 10: The match uses it**

Replace `apps/client/src/scene/Surroundings.tsx` with:

```tsx
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { Color, Fog } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { BOARD_SCALE } from './layout';
import { skyTexture } from './textures';
import { WorldParts } from './World';
import { matchWorld } from './world';

/** Half the shadow camera's box: the board and what stands on it. */
const SHADOW_REACH = 13 * BOARD_SCALE;

/** Sky, fog, light, and the Sky Course round the board (board theme spec); the crown is its own part (Crown.tsx). */
export function Surroundings({ shadows, clouds, clearcoat, reducedMotion }: { shadows: boolean; clouds: number; clearcoat: boolean; reducedMotion: boolean }) {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const world = useMemo(() => matchWorld(clouds), [clouds]);

  useLayoutEffect(() => {
    const { background, fog } = scene;
    scene.background = sky ?? new Color(WORLD_COLORS.sky[1]);
    // The overview sits about 46 from the board (board theme spec §5): the fog starts beyond it.
    scene.fog = new Fog(WORLD_COLORS.fog, 70, 190);
    return () => {
      scene.background = background;
      scene.fog = fog;
    };
  }, [scene, sky]);

  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.groundLight, 1.15]} />
      <directionalLight
        position={[9, 18, 11]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-SHADOW_REACH}
        shadow-camera-right={SHADOW_REACH}
        shadow-camera-top={SHADOW_REACH}
        shadow-camera-bottom={-SHADOW_REACH}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
      />
      <WorldParts placements={world} clearcoat={clearcoat} reducedMotion={reducedMotion} />
    </>
  );
}
```

In `apps/client/src/scene/MatchScene.tsx:62`, write `<Surroundings shadows={profile.shadows} clouds={profile.clouds} clearcoat={profile.clearcoat} reducedMotion={reducedMotion} />`.

In `MenuScene.tsx:145`, the hemisphere light's `WORLD_COLORS.islandRock` becomes `WORLD_COLORS.groundLight`. Task 7 replaces the rest of the menu.

Search for leftovers:

```bash
grep -rn "islandGeometry\|islandTop\|islandRock\|WORLD_COLORS.bumper\|'island'" apps/client art --include=*.ts --include=*.tsx
```

Expected: nothing left. A test importing `islandGeometry` loses that test, and the ledger records it.

- [ ] **Step 11: Price the world in the budget test**

In `art/test/budget.test.ts`:
- Replace the `USES` entries from `island` to `prop_chips` with the world's.
- Add `model?: string` to the `USES` value type, so a reused model is priced again under its own row.

```ts
const USES: Record<string, { copies: number; separate?: boolean; shadows?: boolean; model?: string }> = {
  die: { copies: SEATS, separate: true, shadows: true },
  crown: { copies: 1, separate: true, shadows: true },
  tile: { copies: 100 },
  pad: { copies: PADS },
  target: { copies: PADS },
  vortex: { copies: SLIDES },
  exit: { copies: SLIDES },
  // The world (board theme spec §7): every model instanced, none casting a shadow.
  platform: { copies: 1 },
  cloud: { copies: 8 },
  step: { copies: 5 },
  course_pad: { copies: 5 },
  sweeper: { copies: 1 },
  mushroom: { copies: 3 },
  hoop: { copies: 3 },
  fan: { copies: 1 },
  ramp: { copies: 1 },
  chip: { copies: 6 },
  card: { copies: 3 },
  prop_die: { copies: 1 },
  prop_crown: { copies: 1 },
  prop_rocket: { copies: 1, model: 'pad' },
  prop_flag: { copies: 1, model: 'target' },
};
```

In `price()`, change `const model = builtFor(id, low);` to `const model = builtFor(use.model ?? id, low);`. The `ENDS` skip keys on `id`, so the props still count on Low.

Update the header comment: "…, and the world round the board: the platform, props, obstacles and clouds, each one instanced mesh (board theme spec §7)."

- [ ] **Step 12: Run everything**

```bash
pnpm test > .superpowers/t3.log 2>&1; tail -30 .superpowers/t3.log
pnpm typecheck && pnpm lint
```

Expected: PASS and clean. The budget test now also prices the reused rocket and flag props, about 1,600 triangles and 4 calls more; it must still pass.

- [ ] **Step 13: Commit**

```bash
git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap 2>/dev/null; git add -A apps/client art
git commit -m "feat(client): the world as placements of models, drawn instanced: the Sky Course's layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lathe helpers, and the platform, cloud and step models

> Spec §3: the inflatable platform, the clouds, the stepping pads. Every 3D object comes from Blender (B2).

**Files:**
- Modify: `art/lib/shapes.py` (`lathe`, `capsule`, `rounded_rect`)
- Create: `art/models/platform.py`, `art/models/cloud.py`, `art/models/step.py`
- Modify: `art/contract.ts` (`materialTop` and three rules), `apps/client/src/assets/slotFiles.ts` (`SLOT_FILES`)
- Test: `art/test/files.test.ts` and `art/test/contract.test.ts` (existing; they read the new rules)

**Interfaces:**
- Consumes: `PLATFORM` (Task 1); slots `platform`, `cloud`, `step` (Task 3).
- Produces:
  - `shapes.lathe(name, profile, materials, paint, segments)`;
  - `shapes.capsule(name, radius, length, material, location, rotation)`;
  - `shapes.rounded_rect(half_x, half_y, radius, count)`;
  - contract helper `materialTop(material, height, tolerance)`;
  - files `platform.glb`, `cloud.glb`, `step.glb`.

- [ ] **Step 1: Write the failing contract rules**

In `art/contract.ts`:
- Import `PLATFORM` and `COURSE` from the client's layout.
- After `topAt`, add:

```ts
/** A material's top is at this height: the course pad's deck, where its obstacle stands (board theme spec §6). */
function materialTop(material: string, height: number, tolerance = 0.06) {
  return (model: GlbSummary): string | null => {
    const part = model.byMaterial[material];
    if (!part) return null; // requiredMaterials reports it missing
    return Math.abs(part.max[1]! - height) <= tolerance ? null : `its ${material} top is at ${part.max[1]!.toFixed(2)}, but ${height} is expected`;
  };
}
```

Then add to `MODELS`:

```ts
  // The world (board theme spec §3, §7): instanced, no shadows, light. Round parts are lathed, so their counts are exact.
  platform: { slot: 'platform', origin: 'base', height: [PLATFORM.rimTop - 0.05, PLATFORM.rimTop + 0.05], maxWidth: 55.5, maxTriangles: 3600, maxMaterials: 3, requiredMaterials: ['Deck', 'Stripe', 'Cushion'] },
  cloud: { slot: 'cloud', origin: 'base', height: [2.45, 2.75], maxWidth: 5.6, maxTriangles: 220, maxMaterials: 1, requiredMaterials: ['Cloud'] },
  step: { slot: 'step', origin: 'base', height: [0.55, 0.65], maxWidth: 3.7, maxTriangles: 120, maxMaterials: 1, requiredMaterials: ['Tint'] },
```

`COURSE` is used in Task 5. For now, use `void COURSE;`, or import it in Task 5 instead if lint objects.

In `apps/client/src/assets/slotFiles.ts`, `SLOT_FILES`, add `platform: 'platform', cloud: 'cloud', step: 'step',`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "platform is listed in slotFiles.ts but platform.glb isn't built", and the same for cloud and step.

- [ ] **Step 3: The shape helpers**

In `art/lib/shapes.py`, add after `tube`:

```python
def lathe(name, profile, materials, paint=lambda row, column: 0, segments=32, smooth=True):
    """A closed surface turned round the Z axis from a profile of (radius, height) points, bottom to top;
    leave the axis out, as each end is closed by a fan to it. One surface in several materials:
    paint(row, column) picks the material of the band from profile point row to row + 1, between columns
    column and column + 1 round the axis. For round, low-poly parts with an exact triangle count
    (segments × (2 × bands + 2)): the course's pads, chips, a podium. Board theme plan, decision 4."""
    rows = [[(r * math.cos(a), r * math.sin(a), h) for a in (k * math.tau / segments for k in range(segments))] for r, h in profile]
    return grid(name, rows, materials, paint=paint, smooth=smooth)


def capsule(name, radius, length, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), segments=48):
    """A rod with round ends, `length` long overall, along Z through its middle before rotation."""
    half = length / 2 - radius
    bottom = [(radius * math.cos(a), -half + radius * math.sin(a)) for a in (math.radians(-90 + 15 * k) for k in range(1, 6))]
    top = [(radius * math.cos(a), half + radius * math.sin(a)) for a in (math.radians(15 * k) for k in range(1, 6))]
    profile = [(0.0, -half - radius), *bottom, (radius, -half), (radius, half), *top, (0.0, half + radius)]
    obj = revolve(name, profile, material, segments=segments)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def rounded_rect(half_x, half_y, radius, count):
    """`count` points spaced evenly round a rounded rectangle centred on the origin, anticlockwise from the
    middle of its +x side, each with its outward normal: [((x, y), (nx, ny)), ...]. The platform's rows."""
    sx, sy = half_x - radius, half_y - radius

    def line(a, b, normal):
        return (math.dist(a, b), lambda t: (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), lambda t: normal)

    def arc(cx, cy, start):
        angle = lambda t: math.radians(start + 90 * t)
        return (radius * math.pi / 2, lambda t: (cx + radius * math.cos(angle(t)), cy + radius * math.sin(angle(t))), lambda t: (math.cos(angle(t)), math.sin(angle(t))))

    runs = [
        line((half_x, 0.0), (half_x, sy), (1.0, 0.0)), arc(sx, sy, 0),
        line((sx, half_y), (-sx, half_y), (0.0, 1.0)), arc(-sx, sy, 90),
        line((-half_x, sy), (-half_x, -sy), (-1.0, 0.0)), arc(-sx, -sy, 180),
        line((-sx, -half_y), (sx, -half_y), (0.0, -1.0)), arc(sx, -sy, 270),
        line((half_x, -sy), (half_x, 0.0), (1.0, 0.0)),
    ]
    total = sum(length for length, _, _ in runs)
    points = []
    for i in range(count):
        s = total * i / count
        for k, (length, at, normal) in enumerate(runs):
            if s <= length or k == len(runs) - 1:
                t = s / length if length else 0.0
                points.append((at(t), normal(t)))
                break
            s -= length
    return points
```

- [ ] **Step 4: The platform**

Create `art/models/platform.py`:

```python
"""The board's platform (board theme spec §3, B1): the board stands on a cream inflatable deck with a wing
on each side, ringed by a fat rim striped pink and cream like a bouncy castle; a soft tangerine cushion
swells under it and narrows to a knot. One closed surface, turned round the deck's rounded rectangle:
each row is that outline scaled and pushed out along its normals, so the stripes are columns and the
cushion, rim and deck are bands (plan decision 4: lathed, so it thins to an exact count). The game stands
the tiles on the deck's top: PLATFORM in apps/client/src/scene/layout.ts."""
import math

from lib import finish, palette, shapes

HALF_W, HALF_D, CORNER = 26.0, 19.0, 5.0   # the deck (PLATFORM.halfWidth, halfDepth)
DECK_TOP = 6.0                              # PLATFORM.deckTop, above the knot's bottom
RIM, RIM_OUT, RIM_Z = 1.2, 0.2, 6.1         # the rim's radius, its centre past the deck's edge, its height: top 7.3
COLUMNS, STRIPES = 112, 28                  # points round the outline; stripes round the rim (half of them pink)
# (scale of the outline, push out along its normals, height): the knot, the neck, the cushion swelling out.
CUSHION = [(0.05, 0.0, 0.0), (0.10, 0.0, 0.5), (0.12, 0.0, 1.5), (0.35, 0.0, 2.3), (0.70, 0.0, 3.2), (0.90, 0.0, 4.1), (0.96, 0.0, 4.7)]
RIM_ANGLES = (-100, -45, 0, 45, 90, 135, 175)   # round the rim's section, from under it to its inner lip


def build():
    stripe = finish.satin('Stripe', palette.PINK)
    deck = finish.satin('Deck', palette.CREAM)
    cushion = finish.satin('Cushion', palette.CUSHION)
    outline = shapes.rounded_rect(HALF_W, HALF_D, CORNER, COLUMNS)
    rim = [(1.0, RIM_OUT + RIM * math.cos(math.radians(a)), RIM_Z + RIM * math.sin(math.radians(a))) for a in RIM_ANGLES]
    profile = CUSHION + rim + [(1.0, -1.4, DECK_TOP)]  # from the rim's lip in to the deck; the top fan closes it
    rows = [[(x * s + nx * d, y * s + ny * d, h) for (x, y), (nx, ny) in outline] for s, d, h in profile]
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(rim) - 1

    def paint(row, column):
        if row < rim_start:
            return 2  # the cushion
        if row < rim_end:
            return (column * STRIPES // COLUMNS) % 2  # the rim: pink, cream, pink…
        return 1  # the deck

    return [shapes.grid('platform', rows, [stripe, deck, cushion], paint=paint)]
```

- [ ] **Step 5: The cloud and the stepping pad**

Create `art/models/cloud.py`:

```python
"""A chunky cloud (board theme spec §3): five puffs grown into one soft lump, flat-ish underneath. The game
draws it many times, big, below and round the platform. Built at a quarter of its size, so the fields'
grid stays small, then scaled up."""
from lib import finish, palette, sculpt, shapes

S = 4
PUFFS = [(-1.7, 0.0, 1.0, 1.0), (0.0, 0.0, 1.3, 1.3), (1.7, 0.0, 1.0, 1.0), (0.6, 0.7, 0.95, 0.95), (-0.6, -0.7, 0.95, 0.95)]  # x, y, z, radius


def build():
    cloud = finish.satin('Cloud', palette.CREAM)
    s = 1 / S
    parts = [(shapes.sphere(f'puff{i}', r * s, cloud, location=(x * s, y * s, z * s), **sculpt.FINE), cloud) for i, (x, y, z, r) in enumerate(PUFFS)]
    result = sculpt.fuse('cloud', parts, blend=0.06, soften=0.01, target=200)  # fuse() never thins below 200
    result.scale = (S, S, S)
    return [result]
```

Create `art/models/step.py`:

```python
"""A stepping pad (board theme spec §3): a fat, round floating disc, all Tint, so each one takes its colour.
Lathed (plan decision 4): 12 sides, 96 triangles."""
from lib import finish, palette, shapes

PROFILE = [(1.6, 0.0), (1.8, 0.15), (1.8, 0.45), (1.6, 0.6)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('step', PROFILE, [tint], segments=12)]
```

- [ ] **Step 6: Build and preview**

```bash
BLENDER=E:/Software/Blender/blender.exe pnpm art platform cloud step
"E:/Software/Blender/blender.exe" --background --factory-startup --python art/preview.py -- .superpowers/world1.png platform cloud step
```

Expected: the build prints the three, about:
- `platform 3360 triangles 3 materials 7.30 tall`;
- `cloud` about 200 (`fuse()` never thins below 200);
- `step 96 triangles`.

Look at the PNG with Read; convert it to JPEG with `scratchpad/blender/tojpg.py` if it's large. The platform should read as a cream deck in a pink-and-cream striped tube, on an orange cushion that narrows to a knot.

If the rim's corners look faceted, raise `COLUMNS` to 140 (keeping it divisible by `STRIPES`), and record a ruling with the new count.

- [ ] **Step 7: Run the art and client tests**

```bash
pnpm vitest run art/test
pnpm test > .superpowers/t4.log 2>&1; tail -20 .superpowers/t4.log
```

Expected: PASS.
- `files.test` sees the three built, and each keeps its contract.
- The budget test still passes.

If a model breaks its contract (a height or width just outside its range), fix the script's numbers, not the contract, unless the spec allows the value. Record it.

- [ ] **Step 8: Commit**

```bash
git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap 2>/dev/null; git add art apps/client/src/assets/slotFiles.ts apps/client/public/models
git commit -m "feat(art): the inflatable platform, clouds and stepping pads, lathed and sculpted in Blender

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The obstacle course models

> Spec §3: five floating discs carrying a sweeper, mushrooms, hoops, a fan and a ramp.

**Files:**
- Create: `art/models/course_pad.py`, `sweeper.py`, `mushroom.py`, `hoop.py`, `fan.py`, `ramp.py`
- Modify: `art/contract.ts` (six rules), `apps/client/src/assets/slotFiles.ts` (`SLOT_FILES`)

**Interfaces:**
- Consumes: `COURSE` (Task 1), `materialTop`, `shapes.lathe`, `shapes.capsule` (Task 4), slots (Task 3).
- Produces: `course_pad.glb`, `sweeper.glb`, `mushroom.glb`, `hoop.glb`, `fan.glb`, `ramp.glb`.

- [ ] **Step 1: Write the failing rules**

In `art/contract.ts`, `MODELS`, add:

```ts
  course_pad: { slot: 'course.pad', origin: 'base', height: [2.4, 2.6], maxWidth: 11.3, maxTriangles: 400, maxMaterials: 3, requiredMaterials: ['Pad', 'Rim', 'Cushion'], checks: [materialTop('Pad', COURSE.padTop)] },
  sweeper: { slot: 'course.sweeper', origin: 'base', height: [3.0, 3.3], maxWidth: 8.5, maxTriangles: 400, maxMaterials: 1, requiredMaterials: ['Bar'] },
  mushroom: { slot: 'course.mushroom', origin: 'base', height: [2.2, 2.45], maxWidth: 3.1, maxTriangles: 320, maxMaterials: 1, requiredMaterials: ['Tint'] },
  hoop: { slot: 'course.hoop', origin: 'base', height: [4.1, 4.4], maxWidth: 4.1, maxTriangles: 250, maxMaterials: 1, requiredMaterials: ['Tint'] },
  fan: { slot: 'course.fan', origin: 'base', height: [2.7, 3.0], maxWidth: 9.2, maxTriangles: 450, maxMaterials: 1, requiredMaterials: ['Blade'] },
  ramp: { slot: 'course.ramp', origin: 'base', height: [2.5, 2.9], maxWidth: 6.6, maxTriangles: 350, maxMaterials: 1, requiredMaterials: ['Ramp'] },
```

In `SLOT_FILES`, add `'course.pad': 'course_pad', 'course.sweeper': 'sweeper', 'course.mushroom': 'mushroom', 'course.hoop': 'hoop', 'course.fan': 'fan', 'course.ramp': 'ramp',`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL, six files not built.

- [ ] **Step 3: The pad, the mushroom (lathed)**

Create `art/models/course_pad.py`:

```python
"""A floating obstacle's pad (board theme spec §3): a cream disc with a fat mint rim, on a tangerine
cushion. The game stands an obstacle on its top (COURSE.padTop) and draws five. Lathed (plan decision 4):
18 sides, one surface, painted by band."""
import math

from lib import finish, palette, shapes

TOP, R = 2.0, 5.0
CUSHION = [(0.4, 0.0), (1.8, 0.2), (3.4, 0.7), (4.4, 1.2)]
RIM = [(R + 0.6 * math.cos(math.radians(a)), 1.9 + 0.6 * math.sin(math.radians(a))) for a in (-100, 0, 80, 165)]


def build():
    pad = finish.satin('Pad', palette.CREAM)
    rim = finish.glossy('Rim', palette.MINT)
    cushion = finish.satin('Cushion', palette.CUSHION)
    profile = CUSHION + RIM + [(4.2, TOP)]  # in from the rim's lip to the pad's top; the top fan closes it
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(RIM) - 1
    paint = lambda row, column: 2 if row < rim_start else (1 if row < rim_end else 0)
    return [shapes.lathe('course_pad', profile, [pad, rim, cushion], paint=paint, segments=18)]
```

Create `art/models/mushroom.py`:

```python
"""A bouncy mushroom (board theme spec §3): a short stem under a fat, domed cap, all Tint; the game draws
three on one pad, pink and violet, squashing on their bases. Lathed: 16 sides."""
from lib import finish, palette, shapes

PROFILE = [(0.55, 0.0), (0.45, 0.6), (0.45, 1.2), (1.2, 1.2), (1.5, 1.35), (1.45, 1.7), (1.2, 2.05), (0.7, 2.28), (0.3, 2.33)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('mushroom', PROFILE, [tint], segments=16)]
```

- [ ] **Step 4: The sweeper, hoop, fan and ramp (sculpted, one material each)**

Create `art/models/sweeper.py`:

```python
"""The sweeper (board theme spec §3): a stout post with a long, round bar across its top, in one pink
piece; the game spins it. Sculpted at an eighth of its size, then scaled up."""
import math

from lib import finish, palette, sculpt, shapes

S = 8
POST = [(0.0, 0.0), (0.7, 0.0), (0.6, 0.3), (0.5, 2.6), (0.0, 2.6)]
BAR = (0.55, 8.2, 2.6)  # radius, length, height of its middle


def build():
    bar = finish.glossy('Bar', palette.PINK)
    s = 1 / S
    post = shapes.revolve('post', [(r * s, h * s) for r, h in POST], bar, segments=sculpt.FINE_TURN)
    radius, length, height = BAR
    rod = shapes.capsule('rod', radius * s, length * s, bar, location=(0.0, 0.0, height * s), rotation=(0.0, math.pi / 2, 0.0))
    result = sculpt.fuse('sweeper', [(post, bar), (rod, bar)], blend=0.03, soften=0.01, target=300)
    result.scale = (S, S, S)
    return [result]
```

Create `art/models/hoop.py`:

```python
"""A hoop (board theme spec §3): a fat ring standing on a little post, facing the camera, all Tint; three
on one pad, gold, cyan and lime, swaying. Sculpted at a quarter of its size."""
import math

from lib import finish, palette, sculpt, shapes

S = 4
RING = (1.6, 0.35, 2.3)  # radius, tube, height of its middle
POST = [(0.0, 0.0), (0.5, 0.0), (0.45, 0.1), (0.18, 0.25), (0.18, 0.8), (0.0, 0.8)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    s = 1 / S
    radius, tube, height = RING
    loop = [((radius + tube * math.cos(a)) * s, tube * math.sin(a) * s) for a in (k * math.tau / 24 for k in range(24))]
    ring = shapes.revolve('ring', loop, tint, segments=sculpt.FINE_TURN)
    ring.rotation_euler = (math.pi / 2, 0.0, 0.0)  # stand it up, facing -Y (the camera)
    ring.location = (0.0, 0.0, height * s)
    post = shapes.revolve('post', [(r * s, h * s) for r, h in POST], tint, segments=sculpt.FINE_TURN)
    result = sculpt.fuse('hoop', [(ring, tint), (post, tint)], blend=0.02, soften=0.008, target=150)
    result.scale = (S, S, S)
    return [result]
```

Create `art/models/fan.py`:

```python
"""The fan (board theme spec §3): a rounded hub with four flat, peach blades; the game spins it. Sculpted at
an eighth of its size."""
import math

from lib import finish, palette, sculpt, shapes

S = 8
HUB = [(0.0, 0.0), (0.9, 0.0), (0.8, 0.4), (0.7, 2.3), (0.5, 2.7), (0.0, 2.85)]
BLADE = (0.45, 3.8, 2.5, 2.2)  # radius, length, its middle's distance out, height


def build():
    blade = finish.glossy('Blade', palette.PEACH)
    s = 1 / S
    parts = [(shapes.revolve('hub', [(r * s, h * s) for r, h in HUB], blade, segments=sculpt.FINE_TURN), blade)]
    radius, length, out, height = BLADE
    for k in range(4):
        a = k * math.pi / 2
        arm = shapes.capsule(f'blade{k}', radius * s, length * s, blade, location=(out * math.cos(a) * s, out * math.sin(a) * s, height * s), rotation=(0.0, math.pi / 2, a))
        arm.scale = (0.45, 1.0, 1.0)  # flat: thin across its local X, which the turn stands upright
        parts.append((arm, blade))
    result = sculpt.fuse('fan', parts, blend=0.03, soften=0.008, target=350)
    result.scale = (S, S, S)
    return [result]
```

Create `art/models/ramp.py`:

```python
"""The ramp (board theme spec §3): a soft lime slab tipped up on a block, like a jump on an obstacle course.
Sculpted at a quarter of its size."""
from lib import finish, palette, sculpt, shapes

S = 4


def build():
    ramp = finish.glossy('Ramp', palette.LIME)
    s = 1 / S
    slab = shapes.rounded_box('slab', (6.5 * s, 3.0 * s, 0.5 * s), 0.2 * s, ramp, location=(0.0, 0.0, 1.35 * s), rotation=(0.0, -0.35, 0.0))
    block = shapes.rounded_box('block', (1.0 * s, 2.6 * s, 2.3 * s), 0.2 * s, ramp, location=(2.4 * s, 0.0, 1.15 * s))
    result = sculpt.fuse('ramp', [(slab, ramp), (block, ramp)], blend=0.03, soften=0.01, target=250, adaptivity=0.5)
    result.scale = (S, S, S)
    return [result]
```

- [ ] **Step 5: Build and preview**

```bash
BLENDER=E:/Software/Blender/blender.exe pnpm art course_pad sweeper mushroom hoop fan ramp
"E:/Software/Blender/blender.exe" --background --factory-startup --python art/preview.py -- .superpowers/world2.png course_pad sweeper mushroom hoop fan ramp
```

Expected: six models printed. Approximate triangle counts:

| Model | Triangles |
|---|---|
| `course_pad` | 324 |
| `mushroom` | 288 |
| `sweeper` | 300 |
| `hoop` | 150 |
| `fan` | 350 |
| `ramp` | 250 |

Look at the preview:
- **The fan's blades** should lie flat. If they stand on edge, change `arm.scale` to `(1.0, 0.45, 1.0)`.
- **The hoop** should face the front view, its ring upright.

- [ ] **Step 6: Run the tests**

```bash
pnpm vitest run art/test
```

Expected: PASS.
- **Base off zero:** if the ramp's base is a little off 0, nudge the slab's `location` z, and record it.
- **Off centre:** if a model is off centre (over 0.08), move its parts so its bounds centre on the origin, and record it.

- [ ] **Step 7: Commit**

```bash
git add art apps/client/src/assets/slotFiles.ts apps/client/public/models
git commit -m "feat(art): the floating obstacle course: pads, a sweeper, mushrooms, hoops, a fan and a ramp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The props on the wings

> Spec B4: a rocket, a die and chips on the left; cards, the crown and a flag on the right. The rocket and flag are the jump models, already placed in Task 3.

**Files:**
- Create: `art/models/chip.py`, `card.py`, `prop_die.py`, `prop_crown.py`
- Modify: `art/contract.ts` (four rules), `apps/client/src/assets/slotFiles.ts` (`SLOT_FILES`)

**Interfaces:**
- Consumes: `shapes.lathe` (Task 4), the `prop.*` slots (Task 3).
- Produces: `chip.glb`, `card.glb`, `prop_die.glb`, `prop_crown.glb`.

- [ ] **Step 1: Write the failing rules**

In `art/contract.ts`, `MODELS`, add:

```ts
  chip: { slot: 'prop.chip', origin: 'base', height: [0.34, 0.38], maxWidth: 2.45, maxTriangles: 150, maxMaterials: 1, requiredMaterials: ['Tint'] },
  card: { slot: 'prop.card', origin: 'base', height: [4.25, 4.4], maxWidth: 3.1, maxTriangles: 600, maxMaterials: 2, requiredMaterials: ['Card', 'Mark'] },
  prop_die: { slot: 'prop.die', origin: 'base', height: [3.15, 3.35], maxWidth: 3.4, maxTriangles: 900, maxMaterials: 2, requiredMaterials: ['Body', 'Pip'] },
  prop_crown: { slot: 'prop.crown', origin: 'base', height: [2.3, 2.8], maxWidth: 3.8, maxTriangles: 900, maxMaterials: 1, requiredMaterials: ['Gold'] },
```

In `SLOT_FILES`, add `'prop.chip': 'chip', 'prop.card': 'card', 'prop.die': 'prop_die', 'prop.crown': 'prop_crown',`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL, four files not built.

- [ ] **Step 3: The four props**

Create `art/models/chip.py`:

```python
"""A poker chip (board theme spec B4), toy-sized: a thick disc with soft edges, all Tint; the game stacks
five and leans one against them. Lathed: 14 sides."""
from lib import finish, palette, shapes

PROFILE = [(1.15, 0.0), (1.2, 0.05), (1.2, 0.31), (1.15, 0.36)]


def build():
    tint = finish.glossy('Tint', palette.WHITE)
    return [shapes.lathe('chip', PROFILE, [tint], segments=14)]
```

Create `art/models/card.py`:

```python
"""A "?" card (board theme spec B4): the game's Mystery card, toy-sized, standing on its edge: a purple slab
with soft corners and a raised cream "?" on its face (toward -Y, the camera). The game fans three. One
sculpted surface, on a coarse grid so the mark's colour edge stays light."""
import math

from lib import finish, palette, sculpt, shapes

W, D, H = 3.0, 0.12, 4.3
STROKE = 0.13      # the "?"'s stroke radius
FRONT = -D / 2     # the face the mark stands on


def question():
    """Points along the "?": over the top of its hook, round and down to the stem, then the stem."""
    hook = [(0.55 * math.cos(math.radians(a)), 2.75 + 0.55 * math.sin(math.radians(a))) for a in range(160, -61, -10)]
    stem = [(0.275 - 0.275 * t, 2.27 - 0.52 * t) for t in (k / 6 for k in range(1, 7))]
    return hook + stem


def build():
    card = finish.satin('Card', palette.MYSTERY)
    mark = finish.glossy('Mark', palette.CREAM)
    body = shapes.rounded_box('card', (W, D, H), 0.25, card, location=(0.0, 0.0, H / 2))
    parts = [(body, card)]
    for i, (x, z) in enumerate(question()):
        parts.append((shapes.sphere(f'stroke{i}', STROKE, mark, location=(x, FRONT, z), segments=16, rings=12), mark))
    parts.append((shapes.sphere('dot', STROKE * 1.2, mark, location=(0.0, FRONT, 1.32), segments=16, rings=12), mark))
    return [sculpt.fuse('card', parts, voxel=0.03, blend=0.02, soften=0.02, target=350, adaptivity=0.6)]
```

Create `art/models/prop_die.py`:

```python
"""A big toy die (board theme spec B4), on its own on the deck: a soft cream cube with ink dimples, one on
top, two in front (-Y), three on the right. Carved with exact booleans (lib/sculpt.carve), like the game's
die, but light: the props are priced into the match's budget (plan decision 2)."""
from lib import finish, palette, sculpt, shapes

SIZE = 3.2
PIP = 0.32
HALF = SIZE / 2
PIPS = [
    (0.0, 0.0, SIZE),                                   # one on top
    (-0.8, -HALF, 2.4), (0.8, -HALF, 0.8),              # two in front
    (HALF, -0.8, 2.4), (HALF, 0.0, HALF), (HALF, 0.8, 0.8),  # three on the right
]


def build():
    body = finish.glossy('Body', palette.CREAM)
    pip = finish.satin('Pip', palette.INK)
    cube = shapes.rounded_box('cube', (SIZE, SIZE, SIZE), 0.35, body, location=(0.0, 0.0, HALF), segments=3)
    cutters = [(shapes.sphere(f'pip{i}', PIP, pip, location=at, segments=10, rings=6), pip) for i, at in enumerate(PIPS)]
    return [sculpt.carve('prop_die', (cube, body), cutters)]
```

Create `art/models/prop_crown.py`:

```python
"""The crown, big, as a prop (board theme spec B4): a gold band flaring into five points, each topped with a
ball, in one sculpted piece. Lighter than the game's crown (plan decision 2); the game turns it slowly."""
import math

from lib import finish, palette, sculpt, shapes

WALL = [(1.35, 0.0), (1.55, 0.0), (1.75, 1.3), (1.6, 1.3)]  # a loop: the band's section


def build():
    gold = finish.glossy('Gold', palette.GOLD)
    parts = [(shapes.revolve('band', WALL, gold, segments=sculpt.FINE_TURN), gold)]
    for k in range(5):
        a = k * math.tau / 5
        parts.append((shapes.cone(f'point{k}', 0.42, 1.2, gold, location=(1.65 * math.cos(a), 1.65 * math.sin(a), 1.1), segments=32), gold))
        parts.append((shapes.sphere(f'ball{k}', 0.22, gold, location=(1.68 * math.cos(a), 1.68 * math.sin(a), 2.35), **sculpt.FINE), gold))
    return [sculpt.fuse('prop_crown', parts, voxel=0.012, blend=0.06, soften=0.02, target=700)]
```

- [ ] **Step 4: Build and preview**

```bash
BLENDER=E:/Software/Blender/blender.exe pnpm art chip card prop_die prop_crown
"E:/Software/Blender/blender.exe" --background --factory-startup --python art/preview.py -- .superpowers/world3.png chip card prop_die prop_crown
```

Expected: four models printed within their rules.
- The card's "?" reads clearly from the front.
- If the card has more than 600 triangles, raise `voxel` to 0.04 and record it.
- The die shows one, two and three.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run art/test`
Expected: PASS, including `budget.test.ts` on High and Low.

If the budget test fails on High, trim these, in this order, recording each in the ledger:
1. Chips to 4 (`CHIPS` loses two colours, and the `USES` copies follow).
2. The card's `target` to 250.
3. `cloud` copies to 6: `QUALITY.high.clouds` and the `USES` copies follow.

- [ ] **Step 6: Commit**

```bash
git add art apps/client/src/assets/slotFiles.ts apps/client/public/models
git commit -m "feat(art): the wings' props: poker chips, \"?\" cards, a big die and a crown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The menu's podium on its little platform

> Spec §3: the podium stands on a small copy of the platform, with clouds below; the floating tiles stay.

**Files:**
- Create: `art/models/podium.py`, `art/models/menu_platform.py`
- Modify: `art/contract.ts` (two rules), `apps/client/src/assets/slotFiles.ts` (`SLOT_FILES`)
- Modify: `apps/client/src/scene/MenuScene.tsx`
- Test: `apps/client/test/menuScene.test.tsx`

**Interfaces:**
- Consumes: `menuWorld(clouds, podiumX)`, `WorldParts` (Task 3); `MENU_PLATFORM` (Task 1).
- Produces: `podium.glb`, `menu_platform.glb`; the menu draws `world-podium`, `world-menu.platform` and `world-cloud`.

- [ ] **Step 1: Write the failing menu test**

In `apps/client/test/menuScene.test.tsx`, add:

```tsx
  it('stands the podium on its little platform, with clouds (board theme spec §3)', async () => {
    const { root } = await renderMenu('pawn');
    expect((root.getObjectByName('world-podium') as InstancedMesh).count).toBe(1);
    const platform = root.getObjectByName('world-menu.platform') as InstancedMesh;
    expect(platform.count).toBe(1);
    expect(platform.visible).toBe(true); // a plain deck until the model loads
    expect((root.getObjectByName('world-cloud') as InstancedMesh).count).toBe(8);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/menuScene.test.tsx -t "little platform"`
Expected: FAIL. There is no object named `world-podium`.

- [ ] **Step 3: The menu uses the world**

In `apps/client/src/scene/MenuScene.tsx`:
- **Remove:**
  - the `PUFFS` constant and `puffsRef`;
  - the puffs part of the `useLayoutEffect`. Keep the tile colours. Drop `profile.clouds` and `place` from its dependencies if unused.
  - the three podium cylinder meshes, the ring torus, and the two cone meshes;
  - the puffs `instancedMesh`.
- **Keep:**
  - the Low-quality shadow disc (`!profile.shadows`) and the turntable `group`, inside `<group position-x={PODIUM_X}>`;
  - the floating tiles.
- **Add:**
  - imports: `import { WorldParts } from './World';` and `import { menuWorld } from './world';`;
  - in `MenuContent`: `const world = useMemo(() => menuWorld(profile.clouds, PODIUM_X), [profile.clouds]);`;
  - in the JSX, after the directional light: `<WorldParts placements={world} clearcoat={profile.clearcoat} reducedMotion={reducedMotion} />`.

Drop `PODIUM_COLORS` from the theme import if nothing uses it any more. The podium model carries its colours.

Change the header comment to: "…your piece turning on a podium on a little inflatable platform (board theme spec §3), board tiles drifting behind it, a few clouds."

- [ ] **Step 4: Run it**

Run: `pnpm vitest run apps/client/test/menuScene.test.tsx`
Expected: PASS, including the existing tests (podium anchors, budget).

If a test looked for the code-built podium meshes by geometry, point it at `world-podium` and record it.

- [ ] **Step 5: The two models**

In `art/contract.ts`, `MODELS`, add:

```ts
  // The menu (board theme spec §3).
  podium: { slot: 'podium', origin: 'base', height: [0.78, 0.82], maxWidth: 3.05, maxTriangles: 1600, maxMaterials: 4, requiredMaterials: ['Top', 'Band', 'Base', 'Ring'] },
  menu_platform: { slot: 'menu.platform', origin: 'base', height: [1.45, 1.55], maxWidth: 5.3, maxTriangles: 1000, maxMaterials: 3, requiredMaterials: ['Deck', 'Stripe', 'Cushion'] },
```

In `SLOT_FILES`, add `podium: 'podium', 'menu.platform': 'menu_platform',`.

Create `art/models/podium.py`:

```python
"""The menu's podium (spec #5 §4.3, board theme spec §3): a teal base flaring up, a tangerine band, a cream
top with a glowing pink ring set into it, where the chosen piece turns. The same size as the code-built
one, so the name plate (MenuScene ANCHORS) still sits on its front. Lathed: 64 sides, one surface."""
from lib import finish, palette, shapes

PROFILE = [
    (1.15, 0.0), (1.5, 0.34),                     # the base, flaring up
    (1.46, 0.36), (1.47, 0.40), (1.47, 0.46),     # the band
    (1.42, 0.47), (1.35, 0.75),                   # the top's side
    (1.25, 0.75), (1.18, 0.795), (1.11, 0.75),    # the ring, a bead on the top
    (0.6, 0.75),                                  # the top, closed by the fan
]
#        bands: 0-1 base, 2-4 band, 5-6 top, 7-8 ring, 9 top
PAINT = [2, 2, 1, 1, 1, 0, 0, 3, 3, 0]


def build():
    top = finish.satin('Top', palette.PODIUM_TOP)
    band = finish.glossy('Band', palette.CUSHION)
    base = finish.satin('Base', palette.PODIUM_BASE)
    ring = finish.glow('Ring', palette.PINK)
    return [shapes.lathe('podium', PROFILE, [top, band, base, ring], paint=lambda row, column: PAINT[min(row, len(PAINT) - 1)], segments=64)]
```

Create `art/models/menu_platform.py`:

```python
"""The menu's little platform (board theme spec §3): a round copy of the board's, a cream deck in a rim
striped pink and cream, on a tangerine cushion narrowing to a knot. The podium stands on its deck
(MENU_PLATFORM.deckTop). Lathed: 32 sides, eight pink stripes."""
import math

from lib import finish, palette, shapes

DECK_TOP, RADIUS = 1.2, 2.3
CUSHION = [(0.15, 0.0), (0.3, 0.25), (0.35, 0.55), (1.0, 0.75), (1.8, 0.95), (2.1, 1.02)]
RIM = [(2.35 + 0.25 * math.cos(math.radians(a)), 1.25 + 0.25 * math.sin(math.radians(a))) for a in (-100, -45, 0, 45, 90, 135, 175)]
SEGMENTS, STRIPES = 32, 16


def build():
    stripe = finish.satin('Stripe', palette.PINK)
    deck = finish.satin('Deck', palette.CREAM)
    cushion = finish.satin('Cushion', palette.CUSHION)
    profile = CUSHION + RIM + [(2.0, DECK_TOP)]
    rim_start, rim_end = len(CUSHION), len(CUSHION) + len(RIM) - 1

    def paint(row, column):
        if row < rim_start:
            return 2
        if row < rim_end:
            return (column * STRIPES // SEGMENTS) % 2
        return 1

    return [shapes.lathe('menu_platform', profile, [stripe, deck, cushion], paint=paint, segments=SEGMENTS)]
```

- [ ] **Step 6: Build, preview, test**

```bash
BLENDER=E:/Software/Blender/blender.exe pnpm art podium menu_platform
"E:/Software/Blender/blender.exe" --background --factory-startup --python art/preview.py -- .superpowers/world4.png podium menu_platform
pnpm vitest run art/test apps/client/test/menuScene.test.tsx
```

Expected: both built within their rules; tests PASS.

- [ ] **Step 7: Suite, typecheck, lint, commit**

```bash
pnpm test > .superpowers/t7.log 2>&1; tail -20 .superpowers/t7.log
pnpm typecheck && pnpm lint
git checkout -- packages/core/test/__snapshots__/golden.test.ts.snap 2>/dev/null; git add -A art apps/client
git commit -m "feat: the menu's podium on a little inflatable platform, Blender-built

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The gate, the review shots, and the docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-board-theme-design.md` (§7 table), `docs/superpowers/HANDOFF.md`, `art/README.md` ("Adding a model": the world models), `apps/client/README.md` (the world)
- Create: `scratchpad/check/theme.mjs` (session scratch, not committed)

- [ ] **Step 1: The full gate**

```bash
pnpm test > .superpowers/t8.log 2>&1; tail -20 .superpowers/t8.log
pnpm typecheck && pnpm lint && pnpm build
pnpm e2e > .superpowers/e2e.log 2>&1; tail -40 .superpowers/e2e.log
```

Expected:
- every Vitest test passes;
- typecheck, lint and build are clean;
- the e2e suite passes, including `'keeps a match within 100 draw calls and 150,000 triangles, models included'` with the real models;
- `'plays a whole match…'` logs no asset slot warnings.

The online away test may flake, as recorded in the HANDOFF. Re-run once and record the result.

Read the budget test's rows for High and Low. Run it with `--reporter verbose`; if it doesn't print them, add a temporary `console.log(rows)` and remove it afterwards. Note the world's real triangles and calls for Step 3.

- [ ] **Step 2: Review screenshots**

Write `scratchpad/check/theme.mjs`, modelled on `scratchpad/check/tap1.mjs`:
1. Start a bot match on seed `review-2`.
2. Take shots at 1280×720 and 844×390:
   - the overview;
   - zoomed in (`page.mouse.wheel(0, -1500)`, then wait 1.5 s);
   - zoomed in after a drag (`page.mouse.down()`, move 300 px left and 250 px down in 12 steps, then `up()`);
   - back at the overview (`page.mouse.wheel(0, 3000)`, then wait 1.5 s).
3. Take a menu shot at both sizes.
4. Save JPEGs to `scratchpad/check/bt-*.jpg`.

Run it against the dev preview (`preview_start` with `.claude/launch.json`'s client server; use its URL). Read every shot and check:
- the board is centred on the deck, with cream gaps between squares;
- the props are on the wings, and nothing covers the board;
- the obstacles float at the edges;
- the clouds are below;
- the zoomed drag reaches the far rows;
- the overview after zooming out is centred.

Fix what's wrong in a commit of its own, with a ledger line for each fix.

- [ ] **Step 3: Docs**

In the spec's §7, replace the table with the measured one. Shape:

| Part | Copies | Triangles each | Draw calls |
|---|---|---|---|
| Platform | 1 | measured | 3 |
| Cloud | 8 | measured | 1 |
| Stepping pad | 5 | 96 | 1 |
| Course pad | 5 | 324 | 3 |
| Sweeper, fan, ramp | 1 each | measured | 1 each |
| Mushroom | 3 | 288 | 1 |
| Hoop | 3 | measured | 1 |
| Chip | 6 | 112 | 1 |
| Card | 3 | measured | 2 |
| Die prop, crown prop | 1 each | measured | 2, 1 |
| Rocket and flag (reused) | 1 each | 1,014, 600 | 3, 1 |

Write the measured world total and the busy match's total under it.

In `art/README.md`, add to the rules:
- "World models (board theme spec): round multi-colour parts are lathed (`shapes.lathe`), one surface painted by band, with an exact triangle count. Odd shapes are sculpted in one material, built at a fraction of their size (`S`) and scaled up, so the fields' grid stays small. None casts a shadow."

In `apps/client/README.md`, describe the world in a bullet next to the camera bullets:
- "**The world** (`src/scene/world.ts`, `World.tsx`): the board stands on an inflatable platform with props on its wings, an obstacle course floats round it, and clouds drift below, all Blender models placed as data and drawn instanced. They idle at a quarter of the speed and size with reduced motion."

In `docs/superpowers/HANDOFF.md`:
- **Next step:** the board theme is built on `art/board-theme` and awaits the user's review (the screenshots and the review page).
- **Test counts:** the new suite numbers.
- **Room left:** the triangles and calls left on High and Low.
- **Open items:** add any deferred minors from the ledger.

- [ ] **Step 4: The review page**

Add a "Board theme: the Sky Course" section to the review page with the Step 2 shots, then republish it to the same URL (<https://claude.ai/artifact/Gk8E6V9hf18euZWULr4Sa4>). Use the existing builder (`scratchpad/review2/build.py`). If it's gone, read the artifact (`Artifact` read) and add the section to its HTML.

- [ ] **Step 5: Commit, then the final review**

```bash
git add -A docs art/README.md apps/client/README.md
git commit -m "docs: the board theme built: budget, review shots, hand-off

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run executing-plans' final review as a self-review (no subagents), against the Review Focus above. Report to the user:
- what was built;
- every ruling in the ledger;
- the deferred minors.

Ask whether to merge `art/board-theme` into `main`.
