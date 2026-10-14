# Art pass (Spec #5): design

**Status:** approved in conversation 2026-10-09; this file awaits the user's review.
**Comes after:** Spec #4 (multiplayer server). Spec #2 §6.3 (asset slots) is the contract this builds on.
**Reviewed visually:**
- the finish samples artifact (<https://claude.ai/artifact/9zkcnWqXaQjefKdz7mDTwf>);
- the design artifact (<https://claude.ai/artifact/59cCGdnip8JLA3JnauBVUd>);
- the in-match HUD mockup the user named as the look to follow (<https://claude.ai/artifact/CYCEMtcDAGqGwrFT7W3kbR>).

---

## 1. What this delivers

Real 3D models, made in Blender, replace the code-built stand-ins for:
- the pieces;
- the board;
- the world around the board.

Three new pieces join the four.

They come in three steps, and each step lands in the game for the user to review.

Success means:

- **The look:** the match and the menu look like the in-match mockup's toys (glossy pieces with little eyes, chunky rounded tiles, a candy island) in the Tangerine Dusk colours.
- **Visible jumps:** launch pads and slides are easy to read from the overview camera: where a pad sends you, and where a slide takes you.
- **Performance:** nothing gets slower. The match stays within 100 draw calls and 150,000 triangles, and phones keep their frame rate.
- **Rebuildable:** every model can be rebuilt from a script in the repo with one command. A change is a readable diff.
- **Never broken:** the game never breaks because of a model. A missing or broken file falls back to today's code-built model.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| A1 | **Scope is everything:** the 9 existing asset slots, the board's parts, and the world around the board. | User's choice. |
| A2 | **The in-match mockup sets the shapes and the feel; the colours stay Tangerine Dusk.** | User's choice ("the pieces and the board i prefer to look and feel like what shown in this artifact"); the mockup's own colours predate the palette (user confirmed). |
| A3 | **All plastic.** Glossy plastic with a clearcoat for the pieces, die, crown, launch pads, vortices, pad trails and props. Satin plastic for the tiles, island, bumpers, podium and slide channels. | User's choice; it replaced an earlier "mix with painted wood". The satin keeps the pieces the shiniest things on the table. |
| A4 | **The world is a toy-box island:** the floating island in the sunset sky, dressed with oversized board-game props. | User's choice; it matches the toy-box sounds of Spec #3. |
| A5 | **Models are Blender Python build scripts in `art/`.** One command rebuilds every `.glb`, and the `.glb` files are committed. | User's choice: the same idea as the sounds made in code. Anything can be rebuilt, and the game builds without Blender. |
| A6 | **Three steps:** pieces, then board, then world. Each lands in the game, and the user reviews it from match screenshots before the next starts. | User's choice of review ("in the game per step"). |
| A7 | **Launch pads, their trails and the slides are made "more visible and incredible"** (§4.2): a modelled pad, an arched glossy trail with travelling lights, a pulsing landing target, a sunken spinning vortex with a glowing rim, a raised slide channel with flowing chevrons, and an exit collar. | User's request at design approval. |
| A8 | **Shots from a headless browser.** The review screenshots come from a Playwright script, not the browser pane. | It works whatever is on screen; the pane is often hidden. |
| A10 | **Seven pieces.** Three new ones join the four: a **rook** (a chess castle tower), a **top hat** (the classic board-game token) and a **rubber duck** (with the knight's little eyes). Each has its own silhouette. | User's request at spec approval ("add more 3 random piece shapes"); Claude picked the three. |
| A11 | **Sculpted, not assembled.** Every model is one continuous surface with real curves where its parts meet, never shapes visibly stuck together: parts become distance fields that are united, blended at the joins, carved and rounded (`art/lib/sculpt.py`). Hard objects with clean flats (the die) are carved with exact booleans instead. Per-model triangle budgets below are targets, not hard limits; the whole-match budget (§1) is the one that holds. | User's direction at the Step 1 review ("i want it like the real curve and conjoined object"; "it's okay to beyond the limit"). |
| A12 | **Shadow stand-ins.** Every model that casts a shadow (pieces, die, crown) carries a small decimated copy of itself, about 400 triangles in one material named `Shadow`. The game casts the shadow from it and never shows it; the detailed model casts none. The board's instanced parts carry none. | Claude's ruling in Step 2: the sculpted pieces, drawn twice for shadows, filled the 150,000-triangle budget before the board's models landed. The shadow map gives a piece about 40 texels, so the stand-in's outline matches; the models on screen keep every triangle. |
| A13 | **Pairs instead of paths.** A pad's trail and a slide's (portal's) channel are hidden; each shows only while a piece stands on its start tile, while a piece rides it, and for 3 s after a player taps or clicks either end's tile, growing in along its length. Instead, each jump's start and end share a colour and a symbol, unique on the board: six colours (pink, cyan, lime, cream, dark teal, plum; teal and plum on ladders only, since they vanish on a portal's dark bowl) and eight symbols (circle, triangle, square, diamond, heart, plus, moon, bolt). Pad, landing ring, whirlpool rim and ridges, exit collar, trail and channel walls take the pair colour through `Tint`; the symbols are a code-built decal layer: dark on the pad's plate (cream on a dark pad), glowing gold in the landing ring, on a still cream cap in the whirlpool's eye, and in the collar. Tiles are rounder on top and 0.30 tall; the pad is taller, its spring visible, with a dark notch toward its landing; the die is lighter, its one red. | The user's Step 2 review notes; the pairs mockup they approved (review page, version 4); symbols rather than tap-to-see alone, for colour-blind players. |
| A14 | **Lighter pieces on Low quality.** Each piece also builds as `<id>-low.glb` (its sculpted parts thinned to 30%, at most 40% of the piece limit, no shadow stand-in); Low quality, where phones start, loads those in the match and the menu. A busy match on Low stays under 100,000 triangles. | The user's question about low-end phones at the Step 2 review: the sculpted pieces had made Low heavier than planned. |
| A15 | **The ends are a flag and a splat, not rings.** A ladder ends at a little flag (mound, pole and waving pennant, all `Tint`, about a piece's height), the pair's symbol standing on the pennant in glowing gold, facing the camera. A portal ends at a flat, glossy splat with a few droplets (`Tint`), the symbol in cream on top. Both are built to `PARTS.flag` and `PARTS.splat`; the splat stays within the lane clearance. | The user, at the third Step 2 review: "change the shape of both end points … not a collar"; they agreed to Claude's picks from six drawn options (review page, version 6). |
| A16 | **A rocket, and no black.** A ladder starts at a sculpted toy rocket on a little pad, in its pair's colour, with a glowing cream porthole on its front carrying the pair's symbol and a glowing tangerine flame; it faces the camera instead of turning toward its landing. Nothing on the jump parts is black: the pair colours are all light palette colours (pink, cyan, lime, peach, violet; this replaces A13's six), symbol rims are a deeper shade of their own colour, the whirlpool's cap has a peach edge and its bowl is a deep shade of its pair colour. Glowing parts (`finish.glow(..., base=...)`) keep their own colour on instanced, tinted models. | The user, Step 2 review 4: "change launchpad start point into rocket … not using something black … adjust to the theme and color palette". |
| A17 | **A bigger board, flat ends on Low, simple trails, pieces in a row, tags on demand, and the crown on the winner.** Each square is 2.0 across (was 1.6); the camera, island, shadow box and clouds scale with it, and pieces and parts keep their size. On Low the rocket, flag, whirlpool and splat are flat icons on their tiles in the pair colours (no end models loaded); pieces stay 3D. A shown path is low-poly: a rocket's is twelve smoke puffs along its arc, a slide's a line of chevron arrowheads drifting down its lane, both in the pair colour with a dark ink outline (the one exception to A16's no-black, at the user's request). Pieces on a rocket's or a flag's tile stand in a row in front of it (0.55 forward, 0.5 apart); face-offs keep their layout. A rocket rocks as a piece launches, a flag swings and pops as one lands; flat icons only pop; reduced motion keeps them still. Your own name tag always shows; another player's shows on hover or for 3 s after a tap on their piece. The crown spins on tile 100 until the win, then flies onto the winner's head (1.2 s, a bounce and a burst of gold sparkles) and stays there through the end screen; reduced motion puts it straight there. | The user, Step 2 review 5: "for low quality option, use only image on the tiles", "make the tiles of the board wider", "pay attention … if any player lands on the rockets and flags … more than one player", "names are hidden, unless hovered/tapped" (own always visible), "the crown should have an animation and should be on the top of player who finishes it", trails "in low poly/flat objects", and "add some black outline or stroke to make the trail looks more visible". |
| A18 | **Rockets and flags in the corner, arrowhead trails, shiny Epic tiles** (the user's known issues, 2026-10-14). The rocket is smaller (0.71 tall, the old design at 0.7) and stands on its fins with no pad. Rockets and flags, 3D and flat, stand in their tile's top-right corner (PARTS.corner), so pieces stack in the middle like on any tile; A17's row in front of them goes. A rocket's trail is the same outlined chevron arrowheads as a slide's, along its flight arc, each tilted to the climb and the dive. Epic "?" tiles get a soft band of light sweeping across them (one instanced draw call). | The user: "move the flag to the top right corner of the tile", "make the rocket smaller and remove its circle pad. Put it to the top right corner", "the question mark for epic cards should be like 'shiny' tiles", "use the rocket trail the same as slide's trail". |
| A9 | **No mesh compression in this pass.** The models total about 2 MB, and a test keeps them under 2.5 MB. | Simpler loading with no decoder files; compression can come later if the size grows. |

## 3. The look

### 3.1 Finishes

| Finish | Blender (Principled BSDF) | In the game (exported glTF) | Used for |
|---|---|---|---|
| **Glossy plastic** | roughness 0.3, Coat Weight 0.9, Coat Roughness 0.15 | `MeshPhysicalMaterial` with clearcoat (KHR_materials_clearcoat) | pieces, die, crown, pads, landing targets, vortex rims, exit collars, trails, props |
| **Satin plastic** | roughness 0.45, no coat | `MeshStandardMaterial` | tiles, island slab, bumpers, podium, slide channel walls |
| **Glow accent** | Emission colour plus strength | emissive | eyes on the dragon, vortex rims, landing stars |

- On Low quality, glossy plastic drops its clearcoat (one material pass in the game). Shadows follow today's quality rules.
- Colours come from the Tangerine Dusk tokens in `apps/client/src/app/theme.ts`. `art/lib/palette.py` mirrors them, and a test checks that every colour there exists in `theme.ts`.

### 3.2 Material names (the contract the game reads)

| Name | What the game does |
|---|---|
| `Seat` | Takes the player's colour (already in Spec #2 §6.3). |
| `Tint` | Takes each instance's colour: tiles per square, each jump part its pair colour (A13), bumpers alternating, and so on. Its base colour is white. |
| `Glow` | Keeps its emission; the game may pulse its intensity. |
| `Shadow` | The model's shadow stand-in (A12): drawn only into the shadow map, and not at all without shadows. |
| any other name | Drawn as exported. |

A piece has at most 4 materials (for example the dragon's `Seat`, eyes, pupils and horns), so the four pieces cost at most 16 draw calls.

## 4. What gets made

### 4.1 Step 1: pieces

| Slot | Model | Budget |
|---|---|---|
| `piece.knight` | The mockup's knight head on a round base: dark eyes with a white highlight | ≤ 5,000 triangles |
| `piece.pawn` | A turned pawn with a ball head | ≤ 5,000 |
| `piece.meeple` | A chunky, bevelled meeple | ≤ 5,000 |
| `piece.dragon` | The mockup's dragon head on a round base: gold glowing eyes and cream horns | ≤ 5,000 |
| `piece.rook` (new) | A chess castle tower with chunky battlements | ≤ 5,000 |
| `piece.hat` (new) | A tall top hat with a band; the band is a second colour, the hat is `Seat` | ≤ 5,000 |
| `piece.duck` (new) | A rubber duck with a round body, a cream beak and dark eyes with a white highlight | ≤ 5,000 |
| `die` | A rounded die with sunken pips | ≤ 2,000 |
| `crown` | The crown on the last tile | ≤ 3,000 |

The pieces keep today's size (about 1 unit tall, origin at the base); the scene's `PIECE_SCALE` still applies. The `Seat` part is the body.

**The three new pieces reach every place the piece list does:**

| Where | Change |
|---|---|
| `packages/host/src/types.ts` | `PieceId` gains `'rook' \| 'hat' \| 'duck'`. `PIECES` becomes knight, pawn, meeple, dragon, rook, hat, duck; bots still take free pieces in this order. |
| `packages/host/src/protocol.ts` | `PROTOCOL_VERSION` becomes 2, so a game and server from different builds ask to reload. |
| `apps/server/src/validate.ts` | Accepts the new pieces through `PIECES` (no own list). |
| `apps/client/src/hud/labels.ts` | `PIECE_NAMES`: Rook, Top hat, Rubber duck. |
| `apps/client/src/ui/PieceIcon.tsx` | Portrait silhouettes for the three, in the same flat style as the others. |
| `apps/client/src/assets/models.ts` | Code-built stand-ins for the three, used before their models load and as the fallback. |
| `apps/client/src/audio/sounds.ts` | `PIECE_NOTES` grows to seven marimba notes (C5, E5, G5, C6, D5, A5, E6), so each piece has its own picker note. |
| Menu piece picker | Seven tiles in one row; it must still fit a landscape phone at 44 px per tile. |

### 4.2 Step 2: the board, the pads and the slides

| Part | Made where | What it is | Budget |
|---|---|---|---|
| `tile` (new slot) | Blender | A rounded, bevelled slab as in the mockup, drawn 100 times through instancing; `Tint` takes each square's colour (classic colours, purple "?" squares, gold last tile). The painted overlay (numbers, "?" glyphs) stays. | ≤ 200 triangles |
| `pad` | Blender | A raised glossy spring pad with a big arrow. Each instance turns its arrow toward the landing tile, as today. | ≤ 1,500 |
| Pad trail | Code, generated per pad | An arched glossy track from the pad to the landing tile, replacing today's loose dots. It's a rounded channel swept along the pad's arc, slightly see-through, with bright chevron lights travelling toward the landing so it reads from the overview camera. All trails are one merged mesh. | ≤ 600 triangles a trail |
| `pad.target` (new slot) | Blender | A raised ring with a star on the landing tile, gently pulsing (`Glow`). | ≤ 800 |
| `slide.vortex` | Blender | A funnel sinking into the tile with spiral ridges, a dark inside and a glossy pink rim that glows (`Glow`). It spins, as today's swirl does. | ≤ 1,500 |
| Slide channel | Code, generated per slide | A raised channel along the lane curve, replacing the flat ribbon and its ink edge. A dark floor with pink chevrons flowing toward the exit sits between two rounded satin walls, swept along the existing `slideCurve`. | ≤ 1,200 triangles a slide |
| `slide.exit` (new slot) | Blender | A raised collar ring where the piece pops out. | ≤ 800 |

- **Instancing:** parts drawn many times (tiles, pads, targets, vortices, exits) take their geometry and material from the `.glb` and stay instanced, so each costs one draw call per material.
- **The menu's floating tiles** use the `tile` model too.
- **Edits mid-match:** board edits from cards keep their pop-in and pop-out animation.

### 4.3 Step 3: the world

> **Replaced (2026-10-15)** by the board theme spec, `docs/superpowers/specs/2026-10-15-board-theme-design.md` (the Sky Course). The table below is kept for history only.

| Slot | Model | Budget |
|---|---|---|
| `island` | A cream satin slab under the board on a low-poly, flat-shaded candy rock, as in the mockup | ≤ 8,000 |
| `bumper` (new) | A rounded post, instanced around the slab's edge, alternating red and white through `Tint` | ≤ 200 |
| `cloud` (new) | A chunky cloud puff, instanced as today's clouds | ≤ 300 |
| `podium` (new) | The menu podium (top, band and base, in the podium tokens) | ≤ 3,000 |
| `prop.die`, `prop.cards`, `prop.spinner`, `prop.hourglass`, `prop.chips` (new) | Oversized toys (a die, a card stack, a spinner, an hourglass, a stack of poker chips) on small floating candy rocks around the island, never over the board | ≤ 3,000 each |

The props' exact places are settled in the step 3 review. They must stay out of the board view's centre and within the triangle budget.

## 5. How models are made (`art/`)

| Path | What it holds |
|---|---|
| `art/README.md` | How to run the build, the model rules, and how to add a model |
| `art/build.py` | The entry point. It runs the named model scripts (or all of them) and exports each to `apps/client/public/models/<slot file>.glb`. It prints each model's triangle count. |
| `art/lib/shapes.py` | Revolve a profile, extrude a profile with bevels, rounded slabs, eyes (an eye plus its highlight) |
| `art/lib/finish.py` | `glossy(name, colour)`, `satin(name, colour)`, `glow(name, colour, strength)` |
| `art/lib/palette.py` | The Tangerine Dusk colours, mirrored from `theme.ts` |
| `art/lib/sculpt.py` | `fuse()`: one sculpted surface from overlapping parts and cutters (SDF union, a blend at the joins, the cuts, rounded edges), thinned to a triangle target and painted by nearest part; `carve()`: exact-boolean holes in a hard solid |
| `art/lib/export.py` | A fresh scene per model; it applies modifiers and transforms, triangulates for the count, and exports glTF binary (+Y up, no cameras or lights, materials on) |
| `art/models/<slot>.py` | One script per model, with `build()` returning the model's root object |
| `art/build.mjs` | `pnpm art [names…]`. It finds Blender (the `BLENDER` environment variable, then `blender` on the PATH) and runs `blender --background --factory-startup --python art/build.py -- [names…]`. |

**Model rules** (Spec #2 §6.3, extended):
- 1 tile = 1.6 units; the origin at the base centre; Y up.
- Each model faces Blender's front view (−Y), which the exporter turns into +Z forward.
- Transforms are applied before export, so a file's bounds are its real size.
- Pieces are authored at today's size (about 1 unit tall).

**Running it:** Claude runs the build through the Blender connection while making models. Anyone with Blender 5.2 runs `pnpm art`. This machine's Blender is at `E:\Software\Blender\blender.exe`; the README says to set `BLENDER` to it.

## 6. How the game uses them

- **Slots:** `SlotName` gains `piece.rook`, `piece.hat`, `piece.duck`, `tile`, `pad.target`, `slide.exit`, `bumper`, `cloud`, `podium` and the five props. `SLOT_URLS` lists every model file once its step lands.
- **Instanced slots:** a new hook, `useSlotMesh(name, fallback)`, returns a geometry and material: the `.glb`'s single mesh, merged, or the code-built default. It's used by the instanced parts (tiles, pads, targets, vortices, exits, bumpers, clouds). The die, pad and vortex, which are drawn directly today, move onto slots.
- **Material pass:** one function prepares a loaded model's materials for the game:
  - `Seat` gets the seat colour;
  - `Tint` gets a white base, so instance colours show;
  - on Low quality, clearcoat is set to 0;
  - a `Shadow` mesh casts the model's shadow, unseen, and the rest casts none (A12).
- **Pairs and paths (A13):** `scene/pairs.ts` gives each jump its colour and symbol in creation order, so a card's new jump never changes the others; `scene/paths.ts` decides which paths show; a tap on a tile peeks at the jumps that start or end there. The symbols are `assets/symbols.ts`, eight instanced meshes and the caps, sized and placed by `PARTS` in `scene/layout.ts`, which the models are built to.
- **Low models (A14):** `slotFile(name, low)` picks `<id>-low` for the pieces when the quality profile says `lowModels`.
- **Preload:** the menu preloads every slot model (drei's `useGLTF.preload`), so a match never pops from stand-in to model.
- **Fallback:** a file that fails to load leaves the code-built model in place and warns once, as today.
- **Trails and channels** are new geometry builders next to `ribbonGeometry` in `scene/Jumps.tsx`:
  - `trailGeometry(points)` sweeps a rounded channel along the pad arc;
  - `channelGeometry(points)` sweeps the floor and walls along the slide curve;
  - both have UVs that run along the path, so the chevron textures scroll.

## 7. Checks and review

**Automatic:**
- **`test/glb.test.ts`** reads every `.glb` in `apps/client/public/models` with a small GLB reader (header, JSON chunk, accessor bounds). Against a table per slot, it checks:
  - the base sits at y = 0 and the model is centred;
  - the height is in range;
  - the triangle budget;
  - the required material names (`Seat` for pieces, `Tint` for tiles and bumpers);
  - the total size stays under 2.5 MB.
- **`test/palette.test.ts`:** every colour in `art/lib/palette.py` exists in `theme.ts`.
- **Unit tests:**
  - `trailGeometry` and `channelGeometry`: endpoints at the right tiles, the arc height, normals, UVs running along the path;
  - `useSlotMesh`: the fallback without a URL;
  - the material pass: `Seat`, `Tint`, and clearcoat off on Low.
- **The scene tests** (`test/scene.test.tsx`) keep their draw-call and triangle checks with the code-built defaults.
- **E2e:**
  - the match test also checks triangles (≤ 150,000) next to draw calls (≤ 100), with the real models loaded;
  - no "asset slot … failed" warning appears.

**For the user, after each step:**
- `pnpm shots` runs a Playwright script against the e2e build. It saves PNGs of the menu, a match overview, a close-up of the pieces, and the jumps (a pad trail and a slide) into `apps/client/test-results/shots/`. Not committed.
- Claude sends them, or puts them on an artifact page.
- The user approves or asks for changes, and the next step starts only after approval.

## 8. Out of scope

- New board layouts or themes (memory `future-board-themes`), and pieces beyond the seven.
- Animated models (skeletons, morphs); motion stays in code, as today.
- Mesh compression (Draco, meshopt) and texture images inside models.
- Capacitor packaging, and any change to the rules, the HUD or the sounds.
