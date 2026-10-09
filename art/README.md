# Laddorious art

The game's 3D models (Spec #5), built from Blender Python scripts. Each script makes one model, and the build exports it to `apps/client/public/models/<id>.glb`, which the game loads through its asset slots. The `.glb` files are committed, so the game builds without Blender.

## Building

You need Blender 5.2.

```bash
pnpm art            # every model
pnpm art knight die # some of them
```

`pnpm art` runs a fresh Blender in the background (`--background --factory-startup`), so it never touches a Blender you have open. Set `BLENDER` to its executable if `blender` isn't on your PATH (on this machine, `E:\Software\Blender\blender.exe`). The build prints each model's triangles, materials, height and size.

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

## Adding a model

1. Write `models/<id>.py` with a `build()` that returns its parts, made with `lib/shapes.py`.
2. Add its rule to `contract.ts`, and list its slot in `apps/client/src/assets/slotFiles.ts`.
3. Run `pnpm art <id>` and `pnpm test`.
