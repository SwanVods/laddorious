# Laddorious art

The game's 3D models (Spec #5), built from Blender Python scripts. Each script makes one model, and the build exports it to `apps/client/public/models/<id>.glb`, which the game loads through its asset slots. The `.glb` files are committed, so the game builds without Blender.

## Building

You need Blender 5.2.

```bash
pnpm art            # every model
pnpm art knight die # some of them
```

`pnpm art` runs a fresh Blender in the background (`--background --factory-startup`), so it never touches a Blender you have open. Rebuild only the models you changed (`pnpm art <id>`): a sculpted model's surface comes out a hair different on every build (Blender's field nodes aren't bit-exact), so rebuilding everything rewrites files whose scripts didn't change. Models that aren't sculpted rebuild byte for byte. Set `BLENDER` to its executable if `blender` isn't on your PATH (on this machine, `E:\Software\Blender\blender.exe`). The build prints each model's triangles, materials, height and size.

`preview.py` renders built models side by side to a PNG for a quick look:

```bash
blender --background --factory-startup --python art/preview.py -- preview.png knight pawn
```

Both scripts also run inside an open Blender (see their docstrings), in scenes of their own. Prefer the background build: a build inside an open Blender shares its session.

## The rules

- 1 tile = 1.6 units. Z is up, and models face −Y (Blender's front view). The export turns that into the game's Y up and +Z forward.
- The origin sits at the base centre, except the die, which keeps its middle at the origin.
- Pieces are about 1 unit tall; the game scales them.
- Material names are the game's contract:
  - `Seat` takes the player's colour;
  - `Tint` takes each copy's colour;
  - `Glow` stays lit;
  - anything else draws as built.
- Finishes come from `lib/finish.py` (glossy and satin plastic, glow), and colours from `lib/palette.py`, which mirrors the game's theme.
- Budgets and sizes for every model are in `contract.ts`; `pnpm test` checks each built file against them.

## Sculpting

Models are sculpted, not assembled (the user's direction at the Step 1 review): one continuous surface with real curves where parts meet.

- `sculpt.fuse(name, solids, cutters, …)` turns each part into a distance field, unites them, blends the creases where they meet (`blend`, a radius), cuts the cutters out, rounds every edge (`soften`), and meshes the result. It then thins it to `target` triangles and paints each face with the material of the part or cutter nearest it, so a beak stays orange where it grows out of the head. Build fused parts with many sides (`sculpt.FINE`, `sculpt.FINE_TURN`): the field copies facets faithfully.
- `sculpt.carve(name, solid, cutters)` cuts clean holes in a hard solid with exact booleans (the die's pips), keeping flat faces flat and rims crisp.
- Small separate details are fine only where the real object has them (eyes and their shine).
- The export splits shading where faces meet at more than 35°, so carved rims stay crisp; sculpted surfaces have no angles that sharp.
- Triangle limits in `contract.ts` are guards; the whole match must stay within 150,000 triangles.

## Adding a model

1. Write `models/<id>.py` with a `build()` that returns its parts: shapes from `lib/shapes.py`, fused or carved with `lib/sculpt.py`.
2. Add its rule to `contract.ts`, and list its slot in `apps/client/src/assets/slotFiles.ts`.
3. Run `pnpm art <id>` and `pnpm test`.
