# Art Pass, Step 2: the Board, the Pads and the Slides (Implementation Plan)

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blender models for the board's tiles, launch pads, landing targets, slide vortices and exit collars, all drawn through instancing. Two new code-built tracks make the jumps "more visible and incredible" (spec A7):
- an arched glossy trail from each pad to its landing, with travelling lights;
- a raised channel along each slide.

Screenshots go to the user for the Step 2 review.

**Architecture:**
- **Instanced slots:** a new hook, `useSlotMesh`, turns a slot's `.glb` into one geometry (a group per material) that the board's instanced meshes draw. Until the model loads, in unit tests, or if it fails, it returns a code-built stand-in.
- **Tracks:** the trail and channel geometry live in a plain module, `scene/tracks.ts`. They are swept cross-sections along the pad's arc and the slide's curve, with UVs running along the path so chevrons scroll.
- **Models:** the Blender models come from the same `art/` build as Step 1.
- **Budget:** a test prices a busy match with the built models, so a heavy model fails before the browser tests.

**Tech Stack:** Blender 5.2 (Python 3.13, the bundled glTF exporter), TypeScript, React Three Fiber, three.js `GLTFLoader` and `BufferGeometryUtils`, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-art-pass-design.md` (§4.2 is this plan's step; §3, §5, §6 and §7 hold for every step).

**This is plan 2 of 3.** The user asked for all three plans at once, so this one was written before the Step 1 review. It starts only after the user approves Step 1. Changes that review asks for are made first, with plan 1's build and checks. Any that touch this plan are ledgered as rulings before Task 1.

**Builds on plan 1.** It assumes plan 1 is done:
- `slotFiles.ts` (`SlotName`, `SLOT_FILES`, `modelUrl`);
- `slots.tsx` (`slotUrl`, `ModelOptions`, `prepareModel`, `preloadModels`, `SlotBoundary`);
- `QualityProfile.clearcoat`, and `clearcoat` on `Pieces` and `Surroundings`;
- the `art/` build (`build.py`, `preview.py`, `lib/*`, `contract.ts`, `glb.ts`, `art/test/*`);
- `apps/client/e2e/shots.spec.ts` and `pnpm shots`.

## Global Constraints

- Everything in plan 1's Global Constraints holds:
  - Blender 5.2, and the `ArtBuild` scene through the link;
  - model rules (1 tile = 1.6 units, Z up and facing −Y in Blender, base origin, transforms applied);
  - finishes (glossy: roughness 0.3, Coat Weight 0.9, Coat Roughness 0.15; satin: roughness 0.45; glow: emission);
  - material names (`Seat`, `Tint`, `Glow`);
  - colours from `theme.ts` mirrored in `palette.py`;
  - commit at the end of every task with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- **Budgets for this step (spec §4.2):**
  - tile ≤ 200 triangles;
  - pad ≤ 1,500;
  - pad trail ≤ 600 a trail;
  - landing target ≤ 800;
  - vortex ≤ 1,500;
  - slide channel ≤ 1,200 a slide;
  - exit collar ≤ 800.
- **A match stays within 100 draw calls and 150,000 triangles** (spec §1), checked by the scene tests (stand-ins), the budget test (built models) and e2e (a real match).
- **Instancing:** an instanced part costs one draw call per material, however many copies. A model with `Tint` has only that one material, because instance colours tint every material of a mesh.
- **Placement:** board parts stand on the tile top (y = 0) with their origin at the base. They face +Z in the game (−Y in Blender), like every model; instances only turn about Y.
- **No colour literals** outside `apps/client/src/app/theme.ts` (the tokens test).

## Decisions made while planning

The spec is the authority; these fill in what it leaves open.

1. **`useSlotMesh(name, fallback, { clearcoat })` never suspends.**
   - It returns the stand-in, then the model once loaded, at once if the menu preloaded it. Callers' instanced meshes rebuild when the value changes, and anything they set once (matrices, colours) is set again.
   - It loads with three.js's `GLTFLoader` (imported lazily) into a cache of its own; drei's cache stays for whole models (`Slot`).
   - A failure warns once per slot with the `Slot` warning's words, so the e2e check catches it.
2. **`MESH_SLOTS`** in `slotFiles.ts` names the instanced slots. `preloadModels` skips them, and `preloadSlotMeshes` loads them. The menu calls both.
3. **The tracks' geometry moves to a plain module, `scene/tracks.ts`:** the ribbon, the sweep, the trail, the channel and the pad heading. The art tests import it to price the tracks, and the art test `tsconfig` gains the DOM lib for three's types.
4. **The vortex can't sink into the tile,** since tiles are solid. Its rim stands up and its funnel slopes down to the tile top, which reads as sunken. Its spiral ridges share the rim's `Glow` material, so it costs two draw calls, not three.
5. **One turn for pads and their stand-ins.**
   - The stand-ins are baked lying flat, and the pad stand-in's chevrons face +Z like the model's arrow, so `padHeading` serves both.
   - `padHeading` is `atan2(dx, dz)`. Today's `towardsTop` aimed the flat disc's own up (−Z after laying it flat) instead.
6. **The trail:**
   - a rounded trough 0.34 wide and 0.08 deep, following the old dots' arc (height 1.2 + 0.12 × span), lifted 0.04, in 24 sections (288 triangles);
   - mint, with cream chevrons that glow and travel toward the landing;
   - 85% opaque, no depth write, clearcoat on High.
7. **Channel walls are cream** (`WORLD_COLORS.cloud`), 0.06 wide and 0.09 tall either side of the 0.3 floor, so the dark chute stands out on every tile colour. The channel is 0.42 wide in all, inside core's lane clearance (0.4 tiles = 0.64 units).
8. **The landing target's star is gold `Glow`** in a mint ring, and the game breathes its glow (65–100%).
9. **The pad stands 0.2 tall,** so a piece on its tile isn't swallowed.
10. **Model ids:** `tile`, `pad`, `target` (slot `pad.target`), `vortex` (`slide.vortex`), `exit` (`slide.exit`).
11. **`art/test/budget.test.ts`** prices a busy match with the built models:
    - 12 slides and 14 pads;
    - the four heaviest pieces, and four dice mid-roll;
    - High quality.

    It already lists Step 3's models; each is priced once it's built.
12. **`art/preview.py` spaces models by their own width,** since a tile is wider than a piece. It frames anything from a pip to the island.
13. **The jumps shot** is a 2× crop of the board's middle from the overview (`match-jumps.png`).

## Review Focus

1. **A pad's arrow points away from its landing.** This happens if the model's forward, the stand-in's forward and the game's turn disagree. Expected: every arrow points along its trail. Pinned:
   - Task 3: `padHeading` turns +Z toward the landing;
   - Task 4: the stand-in's chevrons point +Z, and the scene turns pad 0 toward its landing;
   - Task 5: the contract checks the model's arrow reaches further forward (+Z) than back.
2. **The model replaces the stand-in, and the tiles end up unplaced and unpainted.** The new instanced mesh starts with identity matrices and no colours. Expected: the tiles stay where and what they were. Pinned in Task 2: a test swaps the tile mesh mid-render and checks tile 100's place and gold colour.
3. **An instanced model is missing or broken.** Expected: the stand-in stays, the match plays on, and one warning appears, however many components use the slot. Pinned in Task 1 (a slot whose file can't load, used twice).
4. **A busy board with real models blows the budget.** Cards add jumps, and each pad, target, vortex and exit is a model now. Expected: still within 100 draw calls and 150,000 triangles. Pinned in Task 5 (`budget.test.ts` with 12 slides, 14 pads, the four heaviest pieces and four dice).
5. **Phones on Low quality still pay for clearcoat on the board's parts.** Expected: instanced models and trails drop it. Pinned:
   - Task 1: `prepareSlotMesh` with `clearcoat: false`;
   - Task 3: the trail's material clearcoat follows the prop.

## File map

| Path | Task | What it holds |
|---|---|---|
| `apps/client/src/assets/slotFiles.ts` | 1 | new slot names, `MESH_SLOTS` |
| `apps/client/src/assets/slots.tsx` | 1 | `prepareMaterial` (with `Tint`), `preloadModels` skipping mesh slots |
| `apps/client/src/assets/slotMesh.ts` | 1 | `SlotMesh`, `slotMeshFromScene`, `prepareSlotMesh`, `loadSlotMesh`, `useSlotMesh`, `preloadSlotMeshes` |
| `apps/client/src/scene/layout.ts` | 2 | `TILE_THICKNESS` (moved from `Board.tsx`) |
| `apps/client/src/assets/models.ts` | 2, 4 | stand-ins: `tileGeometry`, `padGeometry`, `targetGeometry`, `vortexGeometry`, `exitGeometry` |
| `apps/client/src/scene/Board.tsx`, `MenuScene.tsx` | 2 | tiles on the `tile` slot |
| `apps/client/src/scene/tracks.ts` | 3, 4 | `ribbonGeometry`, `sweepGeometry`, `TRAIL`, `trailPath`, `trailGeometry`, `CHANNEL`, `channelGeometry`, `padHeading` |
| `apps/client/src/scene/Jumps.tsx`, `MatchScene.tsx` | 3, 4 | trails, channels, and the parts on slots |
| `art/contract.ts`, `art/test/*` | 5 | the board models' rules, `arrowForward`, the busy-match budget |
| `art/lib/palette.py`, `art/lib/shapes.py`, `art/preview.py` | 5 | `MINT`, `PINK`, `SLIDE`; flat outlines and tubes; spacing by width |
| `art/models/{tile,pad,target,vortex,exit}.py` | 6–8 | the five models |
| `apps/client/public/models/*.glb` | 6–8 | built (committed) |
| `apps/client/e2e/shots.spec.ts`, `playwright.config.ts` | 9 | the jumps shot, 2× pixels |

---

### Before Task 1: fold in the Step 1 review

- [ ] Read the user's Step 1 review. Make the changes they asked for with plan 1's build and checks, and commit them on `art/spec-5`.
- Ledger each one that changes something this plan relies on (a slot name, a helper, a material name) as `Before: Ruling: …`.
- Then run `pnpm test`. Expected: green, the same count as at the end of plan 1.

### Task 1: Instanced slots

Parts drawn many times get their models through one hook. It returns the stand-in until the model loads, and never suspends the board.

**Files:**
- Create:
  - `apps/client/src/assets/slotMesh.ts`;
  - `apps/client/test/slotMesh.test.tsx`, `apps/client/test/slotMeshLoad.test.tsx`.
- Modify:
  - `apps/client/src/assets/slotFiles.ts`, `apps/client/src/assets/slots.tsx`;
  - `apps/client/src/scene/MenuScene.tsx`;
  - `apps/client/test/slots.test.tsx`.

**Interfaces:**
- **Consumes (plan 1):**
  - `SlotName`, `SLOT_FILES`, `modelUrl`;
  - `slotUrl(name): string | null`, `ModelOptions { seat?, clearcoat?, emissive?, shadows? }`, `prepareModel`, `preloadModels`;
  - the warning text ``asset slot ${name} failed to load; using the built-in model``.
- **Produces:**
  - slot names `tile`, `pad.target`, `slide.exit`, and `MESH_SLOTS: ReadonlySet<SlotName>`;
  - `prepareMaterial(material, options: ModelOptions): Material`;
  - `SlotMesh { geometry: BufferGeometry; material: Material | Material[] }`;
  - `slotMeshFromScene(root): SlotMesh`, `prepareSlotMesh(mesh, { clearcoat }): SlotMesh`, `loadSlotMesh(url): Promise<SlotMesh>`;
  - `useSlotMesh(name, fallback: () => SlotMesh, { clearcoat }): SlotMesh`, `preloadSlotMeshes(): void`.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/slots.test.tsx`, add `prepareMaterial` to the import from `../src/assets/slots`, and add to the `describe`:

```tsx
  it('turns Tint white on a copy, so instance colours show (spec #5 §3.2)', () => {
    const grey = new MeshStandardMaterial({ name: 'Tint', color: '#808080' });
    const ready = prepareMaterial(grey, {}) as MeshStandardMaterial;
    expect(ready.color.getHexString()).toBe('ffffff');
    expect(grey.color.getHexString()).toBe('808080');
  });
```

Create `apps/client/test/slotMesh.test.tsx`:

```tsx
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareSlotMesh, slotMeshFromScene, useSlotMesh, type SlotMesh } from '../src/assets/slotMesh';

describe('instanced slots (spec #5 §6)', () => {
  it('merges a model into one geometry with a group per material, its transforms baked in', () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name: 'Tint' }));
    const star = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial({ name: 'Glow' }));
    star.position.set(0, 2, 0);
    root.add(body, star);
    const mesh = slotMeshFromScene(root);
    expect((mesh.material as MeshStandardMaterial[]).map((m) => m.name)).toEqual(['Tint', 'Glow']);
    expect(mesh.geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.y).toBeCloseTo(2.1);
  });

  it('keeps a one-material model to one material', () => {
    const mesh = slotMeshFromScene(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'Tint' })));
    expect(Array.isArray(mesh.material)).toBe(false);
  });

  it('readies the materials: Tint white, and no clearcoat on Low, on copies', () => {
    const tint = new MeshStandardMaterial({ name: 'Tint', color: '#808080' });
    const glossy = new MeshPhysicalMaterial({ name: 'Pad', clearcoat: 0.9 });
    const ready = prepareSlotMesh({ geometry: new BoxGeometry(), material: [tint, glossy] }, { clearcoat: false });
    const [white, plain] = ready.material as [MeshStandardMaterial, MeshPhysicalMaterial];
    expect(white.color.getHexString()).toBe('ffffff');
    expect(plain.clearcoat).toBe(0);
    expect(glossy.clearcoat).toBe(0.9);
  });

  it('keeps the code-built stand-in in unit tests', () => {
    const stand: SlotMesh = { geometry: new BoxGeometry(), material: new MeshStandardMaterial() };
    const { result } = renderHook(() => useSlotMesh('tile', () => stand, { clearcoat: true }));
    expect(result.current).toBe(stand);
  });
});
```

Create `apps/client/test/slotMeshLoad.test.tsx`:

```tsx
// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSlotMesh, type SlotMesh } from '../src/assets/slotMesh';

// A slot whose model file can't load: the game's case when a .glb is missing or broken.
vi.mock('../src/assets/slots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/assets/slots')>()),
  slotUrl: () => '/models/missing.glb',
}));

afterEach(() => vi.restoreAllMocks());

describe('an instanced slot whose model fails (spec #5 §1, never broken)', () => {
  it('keeps the stand-in and warns once, however many times the slot is used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stand: SlotMesh = { geometry: new BoxGeometry(), material: new MeshStandardMaterial() };
    const first = renderHook(() => useSlotMesh('pad', () => stand, { clearcoat: true }));
    const second = renderHook(() => useSlotMesh('pad', () => stand, { clearcoat: true }));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(first.result.current).toBe(stand);
    expect(second.result.current).toBe(stand);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('asset slot pad failed to load');
  });
});
```

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/slotMesh.test.tsx apps/client/test/slotMeshLoad.test.tsx`
Expected: FAIL. `prepareMaterial` isn't exported, and `../src/assets/slotMesh` doesn't exist.

- [ ] **Step 2: The slot names.** In `apps/client/src/assets/slotFiles.ts`:
  - add `| 'tile'`, `| 'pad.target'` and `| 'slide.exit'` to `SlotName`, after `'island'`;
  - after `SLOT_FILES`, add:

```ts
/** Slots drawn many times through instancing (spec #5 §6): useSlotMesh loads them as one mesh each. */
export const MESH_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>(['tile', 'pad', 'pad.target', 'slide.vortex', 'slide.exit']);
```

- [ ] **Step 3: One material pass.** In `apps/client/src/assets/slots.tsx`:
- add `Color` to the `three` import, and `MESH_SLOTS` to the `./slotFiles` import;
- replace `prepareModel` with:

```tsx
const WHITE = new Color(1, 1, 1);

/**
 * Ready one material for the game (spec #5 §3.2, §6): Seat takes the seat colour, Tint turns white so
 * instance colours show, Low quality drops the clearcoat, and `emissive` readies it to flash. A changed
 * material is a copy, so shared ones stay as they were.
 */
export function prepareMaterial(material: Material, { seat, clearcoat = true, emissive }: ModelOptions): Material {
  if (!(material instanceof MeshStandardMaterial)) return material;
  const tint = seat !== undefined && material.name === 'Seat';
  const white = material.name === 'Tint' && !material.color.equals(WHITE);
  const uncoat = !clearcoat && material instanceof MeshPhysicalMaterial && material.clearcoat > 0;
  if (!tint && !white && !uncoat && emissive === undefined) return material;
  const copy = material.clone();
  if (tint) copy.color.set(seat);
  if (white) copy.color.copy(WHITE);
  if (uncoat) (copy as MeshPhysicalMaterial).clearcoat = 0;
  if (emissive !== undefined) {
    copy.emissive.set(emissive);
    copy.emissiveIntensity = 0;
  }
  return copy;
}

/** Ready a loaded model's materials and shadows. */
export function prepareModel(root: Object3D, options: ModelOptions): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = options.shadows ?? false;
    node.material = Array.isArray(node.material) ? node.material.map((m) => prepareMaterial(m, options)) : prepareMaterial(node.material, options);
  });
}
```

- in `preloadModels`, load only whole models:

```tsx
/** Start loading every whole model the game uses (the menu calls this), so a match never pops from stand-in to model. */
export function preloadModels(): void {
  const names = (Object.keys(SLOT_FILES) as SlotName[]).filter((name) => !MESH_SLOTS.has(name));
  const urls = names.map(slotUrl).filter((url): url is string => url !== null);
  if (urls.length > 0) void import('./GltfModel').then((m) => m.preload(urls));
}
```

- [ ] **Step 4: The hook.** Create `apps/client/src/assets/slotMesh.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MESH_SLOTS, type SlotName } from './slotFiles';
import { prepareMaterial, slotUrl } from './slots';

// Parts drawn many times (tiles, pads, vortices…) stay instanced (spec #5 §6): a slot's .glb becomes
// one geometry with a group per material, so every copy draws once per material.

export interface SlotMesh {
  geometry: BufferGeometry;
  /** One material per geometry group. */
  material: Material | Material[];
}

/** A whole model as one geometry, a group per material, with its transforms baked in. */
export function slotMeshFromScene(root: Object3D): SlotMesh {
  root.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (Array.isArray(node.material)) throw new Error('a model mesh has several materials');
    geometries.push((node.geometry as BufferGeometry).clone().applyMatrix4(node.matrixWorld));
    materials.push(node.material as Material);
  });
  if (geometries.length === 0) throw new Error('the model has no mesh');
  const geometry = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, true);
  if (!geometry) throw new Error("the model's meshes don't share their attributes");
  return { geometry, material: materials.length === 1 ? materials[0]! : materials };
}

/** Ready a slot mesh's materials (Tint white, no clearcoat on Low); the geometry is shared. */
export function prepareSlotMesh(mesh: SlotMesh, { clearcoat }: { clearcoat: boolean }): SlotMesh {
  const material = Array.isArray(mesh.material) ? mesh.material.map((m) => prepareMaterial(m, { clearcoat })) : prepareMaterial(mesh.material, { clearcoat });
  return { geometry: mesh.geometry, material };
}

const ready = new Map<string, SlotMesh>();
const loading = new Map<string, Promise<SlotMesh>>();
const warned = new Set<SlotName>();

/** Load a model as one mesh, once per file. three's GLTFLoader comes in only when a model loads. */
export function loadSlotMesh(url: string): Promise<SlotMesh> {
  let load = loading.get(url);
  if (!load) {
    load = import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .then((gltf) => {
        const mesh = slotMeshFromScene(gltf.scene);
        ready.set(url, mesh);
        return mesh;
      });
    loading.set(url, load);
  }
  return load;
}

/** Start loading every instanced model (the menu calls this with preloadModels). */
export function preloadSlotMeshes(): void {
  for (const name of MESH_SLOTS) {
    const url = slotUrl(name);
    // A failure warns when a scene uses the slot.
    if (url) void loadSlotMesh(url).catch(() => undefined);
  }
}

/**
 * A slot's mesh for instancing (spec #5 §6). It's the code-built stand-in until the model loads (at
 * once when the menu preloaded it), in unit tests, and when the model fails, which warns once like Slot.
 * It never suspends: callers rebuild their instanced mesh when the value changes.
 */
export function useSlotMesh(name: SlotName, fallback: () => SlotMesh, { clearcoat }: { clearcoat: boolean }): SlotMesh {
  const url = slotUrl(name);
  const [stand] = useState(fallback);
  const [model, setModel] = useState<SlotMesh | null>(() => (url ? (ready.get(url) ?? null) : null));
  useEffect(() => {
    if (!url || model) return;
    let live = true;
    loadSlotMesh(url).then(
      (mesh) => {
        if (live) setModel(mesh);
      },
      (error: unknown) => {
        if (warned.has(name)) return;
        warned.add(name);
        console.warn(`asset slot ${name} failed to load; using the built-in model`, error);
      },
    );
    return () => {
      live = false;
    };
  }, [name, url, model]);
  // The stand-in is this component's own; the model's geometry is shared and stays.
  useEffect(
    () => () => {
      stand.geometry.dispose();
      for (const material of Array.isArray(stand.material) ? stand.material : [stand.material]) material.dispose();
    },
    [stand],
  );
  return useMemo(() => (model ? prepareSlotMesh(model, { clearcoat }) : stand), [model, stand, clearcoat]);
}
```

In `apps/client/src/scene/MenuScene.tsx`:
- import `preloadSlotMeshes` from `../assets/slotMesh`;
- make the menu's preload effect (from plan 1) call `preloadSlotMeshes()` after `preloadModels()`, in a block body.

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/slotMesh.test.tsx apps/client/test/slotMeshLoad.test.tsx`
Expected: PASS.

If the failing-load test never warns, check why the load didn't reject in jsdom: GLTFLoader's fetch of a relative URL should reject. Fix the test's URL (an absolute `http://127.0.0.1:9/missing.glb` refuses at once) and ledger it as a ruling.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 6: Commit.** `git add -A apps/client && git commit -m "feat(client): instanced asset slots load a model as one mesh"` (with the trailer).

### Task 2: The tiles on their slot

The board's 100 tiles, and the menu's floating tiles, draw the `tile` slot. The stand-in becomes a rounded slab standing on its base, like the model will.

**Files:**
- Create: `apps/client/test/boardSwap.test.tsx`
- Modify:
  - `apps/client/src/scene/layout.ts`, `src/assets/models.ts`;
  - `src/scene/Board.tsx`, `src/scene/MatchScene.tsx`, `src/scene/MenuScene.tsx`;
  - `apps/client/test/models.test.ts`, `test/scene.test.tsx`.

**Interfaces:**
- **Consumes:** `useSlotMesh`, `SlotMesh` (Task 1).
- **Produces:**
  - `TILE_THICKNESS` exported from `scene/layout.ts`;
  - `tileGeometry(): BufferGeometry` (a 1.52 × 0.22 × 1.52 rounded slab, its base at y = 0);
  - `Board` takes `clearcoat: boolean`.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/models.test.ts`:
- add `tileGeometry` to the import from `../src/assets/models`;
- import `TILE_SIZE, TILE_THICKNESS` from `../src/scene/layout`;
- add:

```ts
  it('builds the tile stand-in: a rounded slab on its base, the 0.95 of a tile across, under 200 triangles (spec #5 §4.2)', () => {
    const g = tileGeometry();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(TILE_THICKNESS, 5);
    expect(box.max.x - box.min.x).toBeCloseTo(TILE_SIZE * 0.95, 5);
    expect(triangles(g)).toBeLessThanOrEqual(200);
  });
```

In `apps/client/test/scene.test.tsx`:
- add `Matrix4` to the `three` import;
- import `TILE_THICKNESS` from `../src/scene/layout`;
- add:

```ts
  it('stands each tile on its base, its top at the board surface (spec #5 §4.2)', async () => {
    const tiles = (await renderScene('high')).getObjectByName('tiles') as InstancedMesh;
    tiles.geometry.computeBoundingBox();
    const at = new Matrix4();
    tiles.getMatrixAt(0, at);
    const y = new Vector3().setFromMatrixPosition(at).y;
    expect(tiles.geometry.boundingBox!.min.y).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-TILE_THICKNESS, 5);
    expect(y + tiles.geometry.boundingBox!.max.y).toBeCloseTo(0, 5);
  });
```

Create `apps/client/test/boardSwap.test.tsx`:

```tsx
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Color, Matrix4, Vector3, type InstancedMesh, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BOARD_COLORS } from '../src/app/theme';
import { Director } from '../src/director/director';
import { Board } from '../src/scene/Board';
import { TILE_THICKNESS, tileToWorld } from '../src/scene/layout';
import { openingUpdate } from './support/fixtures';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// The moment a loaded model replaces the stand-in: useSlotMesh hands the board a new mesh.
const swap = vi.hoisted(() => ({ on: false }));
vi.mock('../src/assets/slotMesh', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/assets/slotMesh')>();
  const { BoxGeometry, MeshStandardMaterial } = await import('three');
  const geometry = new BoxGeometry(1.52, 0.22, 1.52).translate(0, 0.11, 0);
  geometry.name = 'tile-model';
  const model = { geometry, material: new MeshStandardMaterial({ name: 'Tint' }) };
  return {
    ...real,
    useSlotMesh: (...args: Parameters<typeof real.useSlotMesh>) => {
      const stand = real.useSlotMesh(...args);
      return swap.on && args[0] === 'tile' ? model : stand;
    },
  };
});

describe('the board when a model arrives (spec #5 §6)', () => {
  it('places and paints the tiles again on the new mesh', async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    const renderer = await ReactThreeTestRenderer.create(<Board board={board} director={director} clearcoat />);
    swap.on = true;
    await renderer.update(<Board board={board} director={director} clearcoat />);
    const tiles = (renderer.scene.instance as Object3D).getObjectByName('tiles') as InstancedMesh;
    expect(tiles.geometry.name).toBe('tile-model');
    const at = new Matrix4();
    tiles.getMatrixAt(99, at);
    const p = new Vector3().setFromMatrixPosition(at);
    const [x, , z] = tileToWorld(100);
    expect(p.x).toBeCloseTo(x, 5);
    expect(p.y).toBeCloseTo(-TILE_THICKNESS, 5);
    expect(p.z).toBeCloseTo(z, 5);
    const colour = new Color();
    tiles.getColorAt(99, colour);
    expect(colour.getHexString()).toBe(new Color(BOARD_COLORS.goal).getHexString());
  });
});
```

Run: `pnpm vitest run apps/client/test/models.test.ts apps/client/test/scene.test.tsx apps/client/test/boardSwap.test.tsx`
Expected: FAIL.
- `tileGeometry` doesn't exist, and `TILE_THICKNESS` isn't in `layout.ts`.
- The tile is centred on its middle.
- The board ignores the slot, so its geometry is never `tile-model`.

- [ ] **Step 2: Move the thickness, and build the stand-in.**
- **`scene/layout.ts`:** after `TILE_SIZE`, add:

```ts
/** Tiles are this thick; their top faces sit at y = 0. */
export const TILE_THICKNESS = 0.22;
```

- **`scene/Board.tsx`:** delete its `TILE_THICKNESS` (with its comment), and import it from `./layout`.
- **`assets/models.ts`:** change `import type { Vec3 } from '../scene/layout';` to `import { TILE_SIZE, TILE_THICKNESS, type Vec3 } from '../scene/layout';`, and add:

```ts
/** A board tile's stand-in (spec #5 §4.2): a rounded slab 0.95 of a tile across, standing on its base. Instancing paints it. */
export function tileGeometry(): BufferGeometry {
  return new RoundedBoxGeometry(TILE_SIZE * 0.95, TILE_THICKNESS, TILE_SIZE * 0.95, 1, 0.05).translate(0, TILE_THICKNESS / 2, 0);
}
```

- [ ] **Step 3: The board draws the slot.** In `scene/Board.tsx`:
- add `MeshStandardMaterial` to the `three` import;
- import `tileGeometry` from `../assets/models` and `useSlotMesh` from `../assets/slotMesh`;
- change the signature to `export function Board({ board, director, clearcoat }: { board: PublicBoard; director: Director; clearcoat: boolean })`;
- after `place`, add:

```tsx
  const tile = useSlotMesh('tile', () => ({ geometry: tileGeometry(), material: new MeshStandardMaterial({ roughness: 0.45 }) }), { clearcoat });
```

- in the tiles' `useLayoutEffect`:
  - set `at.position.set(x, -TILE_THICKNESS, z);` (the tile stands on its base);
  - make its dependencies `[size, mystery, tile]`;
  - add a comment above it: "Placed and painted again when the model replaces the stand-in: that's a new instanced mesh.";
- replace the tiles' `<instancedMesh>` element, with its geometry and material children, by:

```tsx
      <instancedMesh ref={tilesRef} name="tiles" args={[tile.geometry, tile.material, board.size]} receiveShadow />
```

In `scene/MatchScene.tsx`, pass `clearcoat={profile.clearcoat}` to `<Board>`.

- [ ] **Step 4: The menu's floating tiles.** In `scene/MenuScene.tsx`:
- remove the `RoundedBoxGeometry` import;
- add `MeshStandardMaterial` to the `three` import;
- import `tileGeometry` from `../assets/models`, `useSlotMesh` from `../assets/slotMesh`, and `TILE_SIZE, TILE_THICKNESS` from `./layout` (with the existing `type Vec3`);
- after `TILES`, add:

```tsx
/** The floating tiles are the board's tile, shrunk to 0.6 across and 0.14 thick (spec #5 §4.2). */
const MENU_TILE = { across: 0.6 / (TILE_SIZE * 0.95), up: 0.14 / TILE_THICKNESS } as const;
```

- replace `const tileGeometry = useMemo(() => new RoundedBoxGeometry(0.6, 0.14, 0.6, 2, 0.06), []);` with:

```tsx
  const tile = useSlotMesh('tile', () => ({ geometry: tileGeometry(), material: new MeshStandardMaterial({ roughness: 0.45 }) }), { clearcoat: profile.clearcoat });
```

- add `tile` to the dependencies of the `useLayoutEffect` that paints the tiles (`[place, profile.clouds, tile]`);
- in `useFrame`, replace `place.scale.setScalar(1);` for the tiles with:

```tsx
        place.scale.set(MENU_TILE.across, MENU_TILE.up, MENU_TILE.across);
        place.translateY((-TILE_THICKNESS / 2) * MENU_TILE.up); // turn about the tile's middle, not its base
```

- replace `<instancedMesh ref={tilesRef} args={[tileGeometry, undefined, TILES.length]}>` and its material child with:

```tsx
      <instancedMesh ref={tilesRef} args={[tile.geometry, tile.material, TILES.length]} />
```

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run apps/client/test/models.test.ts apps/client/test/scene.test.tsx apps/client/test/boardSwap.test.tsx apps/client/test/menuScene.test.tsx`
Expected: PASS; the scene and menu budgets still hold.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`. The menu's tiles drift and turn as before, now rounded slabs. In a match against bots, the board's tiles look as before, with softer edges, and the numbers and "?" glyphs sit on them.

- [ ] **Step 6: Commit.** `git commit -am "feat(client): tiles draw the tile slot, on the board and in the menu"` (with the trailer). The new test is untracked, so `git add apps/client/test/boardSwap.test.tsx` first.

### Task 3: Trails and slide channels

The loose dots become an arched glossy trail per pad, and the flat ribbon and its ink edge become a raised channel per slide (spec A7).

**Files:**
- Create: `apps/client/src/scene/tracks.ts`, `apps/client/test/tracks.test.ts`
- Modify:
  - `apps/client/src/scene/Jumps.tsx`, `src/scene/MatchScene.tsx`;
  - `apps/client/test/scene.test.tsx`.

**Interfaces:**
- **Consumes:** `LANE`, `arcPoint`, `slideCurve`, `tileToWorld` (`scene/layout.ts`).
- **Produces** (`scene/tracks.ts`):
  - `ribbonGeometry(points, width, y)`, moved from `Jumps.tsx` unchanged;
  - `sweepGeometry(points, section, unit): BufferGeometry`;
  - `TRAIL = { width: 0.34, depth: 0.08, lift: 0.04, samples: 24 }`, `trailPath(jump): Vector3[]`, `trailGeometry(points): BufferGeometry`;
  - `CHANNEL = { wall: 0.06, height: 0.09, floor: 0.02, samples: 40 }`, `channelGeometry(points): { floor; walls }`;
  - `Jumps` takes `clearcoat: boolean`.

- [ ] **Step 1: Write the failing tests.** Create `apps/client/test/tracks.test.ts`:

```ts
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { LANE, slideCurve, tileToWorld } from '../src/scene/layout';
import { CHANNEL, TRAIL, channelGeometry, trailGeometry, trailPath } from '../src/scene/tracks';

const triangles = (g: BufferGeometry) => g.index!.count / 3;
const ladder = { id: 'l1', from: 22, to: 52 };
/** Points across the trail's section: its lips, its floor and the curve between. */
const SECTION = 7;

describe('the jump tracks (spec #5 §4.2)', () => {
  it('arches a trail from the pad to its landing tile, as high as the pad sends a piece', () => {
    const path = trailPath(ladder);
    const [fx, , fz] = tileToWorld(ladder.from);
    const [tx, , tz] = tileToWorld(ladder.to);
    expect(path).toHaveLength(TRAIL.samples + 1);
    expect([path[0]!.x, path[0]!.z]).toEqual([fx, fz]);
    expect(path.at(-1)!.x).toBeCloseTo(tx, 5);
    expect(path.at(-1)!.z).toBeCloseTo(tz, 5);
    const span = Math.hypot(tx - fx, tz - fz);
    expect(Math.max(...path.map((p) => p.y))).toBeCloseTo(1.2 + span * 0.12 + TRAIL.lift, 2);
  });

  it('sweeps the trail as a rounded trough within 600 triangles, its floor below its lips and facing the sky', () => {
    const g = trailGeometry(trailPath(ladder));
    expect(triangles(g)).toBeLessThanOrEqual(600);
    const position = g.getAttribute('position');
    const normal = g.getAttribute('normal');
    const top = (TRAIL.samples / 2) * SECTION; // the section at the top of the arc
    const floor = top + 3;
    expect(position.getY(floor)).toBeLessThan(position.getY(top));
    expect(normal.getY(floor)).toBeGreaterThan(0.9);
  });

  it('runs v along the trail from the pad to the landing, so its lights travel there', () => {
    const uv = trailGeometry(trailPath(ladder)).getAttribute('uv');
    for (let i = 1; i <= TRAIL.samples; i++) expect(uv.getY(i * SECTION)).toBeGreaterThan(uv.getY((i - 1) * SECTION));
  });

  it("raises a slide's channel: two rounded walls outside the lane, from head to tail, within 1,200 triangles", () => {
    const points = slideCurve(79, 50).getPoints(CHANNEL.samples);
    const { floor, walls } = channelGeometry(points);
    expect(triangles(floor) + triangles(walls)).toBeLessThanOrEqual(1200);
    walls.computeBoundingBox();
    expect(walls.boundingBox!.max.y).toBeCloseTo(CHANNEL.height, 3);
    const normal = walls.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeGreaterThan(-0.01);
    // The walls' outer feet stand either side of the head at the first section, and of the tail at the last:
    // the left wall's first point, and the right wall's last.
    const position = walls.getAttribute('position');
    const perWall = (CHANNEL.samples + 1) * SECTION;
    for (const [at, point] of [[0, points[0]!], [CHANNEL.samples * SECTION, points.at(-1)!]] as const) {
      const right = perWall + at + SECTION - 1;
      expect((position.getX(at) + position.getX(right)) / 2).toBeCloseTo(point.x, 5);
      expect((position.getZ(at) + position.getZ(right)) / 2).toBeCloseTo(point.z, 5);
    }
    // No wall reaches into the lane.
    for (let i = 0; i < position.count; i++) {
      const gap = Math.min(...points.map((p) => Math.hypot(position.getX(i) - p.x, position.getZ(i) - p.z)));
      expect(gap).toBeGreaterThan(LANE.width / 2 - 0.01);
    }
  });
});
```

In `apps/client/test/scene.test.tsx`:
- change the `ribbonGeometry` import to come from `../src/scene/tracks`;
- add:

```ts
  it('draws every pad trail in one mesh, and every slide channel in two (spec #5 §4.2)', async () => {
    const root = await renderScene('high');
    for (const name of ['pad-trails', 'slide-floors', 'slide-walls']) expect(root.getObjectByName(name)).toBeInstanceOf(Mesh);
  });
```

Run: `pnpm vitest run apps/client/test/tracks.test.ts apps/client/test/scene.test.tsx`
Expected: FAIL. `../src/scene/tracks` doesn't exist.

- [ ] **Step 2: The tracks.** Create `apps/client/src/scene/tracks.ts`. Move `ribbonGeometry` into it from `Jumps.tsx` unchanged (its comment too), and add the rest:

```ts
import type { Jump } from '@laddorious/core';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANE, arcPoint, tileToWorld } from './layout';

// The jumps' tracks (spec #5 §4.2): the arched trail from a launch pad to its landing, and a slide's
// raised channel. Both are swept along a path, with v running along it so their chevrons scroll.

/** A flat strip along points, `width` wide at height y; v runs along it in widths so chevrons tile. */
export function ribbonGeometry(points: Vector3[], width: number, y: number): BufferGeometry {
  // …moved unchanged from Jumps.tsx…
}

/**
 * A cross-section swept along points. Each section point is (across, up): `across` to the path's
 * right, `up` square to the path. u runs across the section, v along the path in `unit`s.
 * Faces point to the section's left as you walk it: walk a wall's section left to right over its top
 * and they face out; walk down into a trough and up again and they face in.
 */
export function sweepGeometry(points: Vector3[], section: ReadonlyArray<readonly [number, number]>, unit: number): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const tangent = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const n = section.length;
  let along = 0;
  points.forEach((p, i) => {
    tangent.subVectors(points[Math.min(points.length - 1, i + 1)]!, points[Math.max(0, i - 1)]!).normalize();
    side.set(-tangent.z, 0, tangent.x).normalize();
    up.crossVectors(side, tangent);
    if (i > 0) along += p.distanceTo(points[i - 1]!);
    section.forEach(([a, b], k) => {
      positions.push(p.x + side.x * a + up.x * b, p.y + side.y * a + up.y * b, p.z + side.z * a + up.z * b);
      uvs.push(k / (n - 1), along / unit);
    });
    if (i === 0) return;
    for (let k = 0; k + 1 < n; k++) {
      const a = (i - 1) * n + k;
      const b = a + n;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A pad's trail: a rounded trough, open to the sky, arching from the pad to its landing. */
export const TRAIL = { width: 0.34, depth: 0.08, lift: 0.04, samples: 24 } as const;
const TRAIL_SECTION = Array.from({ length: 7 }, (_, k): [number, number] => {
  const a = Math.PI * (1 + k / 6);
  return [(TRAIL.width / 2) * Math.cos(a), TRAIL.depth * Math.sin(a)];
});

/** The arc a pad's trail follows, from the pad to the landing tile (the old dots' arc, lifted a little). */
export function trailPath(jump: Jump): Vector3[] {
  const from = tileToWorld(jump.from);
  const to = tileToWorld(jump.to);
  const height = 1.2 + Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.12;
  return Array.from({ length: TRAIL.samples + 1 }, (_, i) => {
    const [x, y, z] = arcPoint(from, to, i / TRAIL.samples, height);
    return new Vector3(x, y + TRAIL.lift, z);
  });
}

export function trailGeometry(points: Vector3[]): BufferGeometry {
  return sweepGeometry(points, TRAIL_SECTION, TRAIL.width);
}

/** A slide's channel: a dark floor between two rounded walls, the lane plus its walls across. */
export const CHANNEL = { wall: 0.06, height: 0.09, floor: 0.02, samples: 40 } as const;

/** One wall's section, walked left to right over its rounded top. */
function wallSection(centre: number): Array<[number, number]> {
  const half = CHANNEL.wall / 2;
  const top = CHANNEL.height;
  return [
    [centre - half, 0],
    [centre - half, top - half],
    [centre - half * 0.7, top - half * 0.3],
    [centre, top],
    [centre + half * 0.7, top - half * 0.3],
    [centre + half, top - half],
    [centre + half, 0],
  ];
}

export function channelGeometry(points: Vector3[]): { floor: BufferGeometry; walls: BufferGeometry } {
  const offset = LANE.width / 2 + CHANNEL.wall / 2;
  return {
    floor: ribbonGeometry(points, LANE.width, CHANNEL.floor),
    walls: mergeGeometries([sweepGeometry(points, wallSection(-offset), LANE.width), sweepGeometry(points, wallSection(offset), LANE.width)]),
  };
}
```

- [ ] **Step 3: The jumps draw them.** In `apps/client/src/scene/Jumps.tsx`:
- **Imports:**
  - drop `useLayoutEffect` from `react`;
  - drop `BufferGeometry`, `Float32BufferAttribute` and `type Vector3` from `three`;
  - drop `LANE`, `arcPoint` and `type Vec3` from `./layout`;
  - add `import { CHANNEL, channelGeometry, trailGeometry, trailPath } from './tracks';`.
- **Delete** `MAX_DOTS`, `ribbonGeometry` (moved), `padArc` and `strips`.
- Change the signature to `export function Jumps({ director, clearcoat }: { director: Director; clearcoat: boolean })`, and its comment to: "Slides and launch pads (spec #2 §6.1, spec #5 §4.2): each slide a raised channel, each pad an arched trail to its landing; parts a board edit adds or removes pop in or out."
- **Replace** the `paths`, `ribbons`, `edges` and `dots` memos with:

```tsx
  const channels = useMemo(() => {
    if (snakes.length === 0) return null;
    const each = snakes.map((j) => channelGeometry(slideCurve(j.from, j.to).getPoints(CHANNEL.samples)));
    return { floor: mergeGeometries(each.map((c) => c.floor)), walls: mergeGeometries(each.map((c) => c.walls)) };
  }, [snakes]);
  const trails = useMemo(() => (ladders.length === 0 ? null : mergeGeometries(ladders.map((j) => trailGeometry(trailPath(j))))), [ladders]);
```

- After `chevrons`, add `const lights = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.cloud), []);`.
- **Delete** `dotsRef` and the `useLayoutEffect` that places the dots.
- **Disposal:** make the effect dispose `channels?.floor`, `channels?.walls` and `trails`, with `[channels, trails]` as its dependencies.
- **In `useFrame`,** after the `chevrons` line, add `if (lights) lights.offset.y -= delta * 0.9; // the trail's lights travel toward the landing`.
- **In the JSX,** replace the `edges` mesh, the `ribbons` mesh and the dots' `<instancedMesh>` with:

```tsx
      {channels && (
        <>
          <mesh geometry={channels.walls} name="slide-walls">
            <meshStandardMaterial color={WORLD_COLORS.cloud} roughness={0.45} />
          </mesh>
          <mesh geometry={channels.floor} name="slide-floors" receiveShadow>
            <meshStandardMaterial {...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide })} side={DoubleSide} roughness={0.8} />
          </mesh>
        </>
      )}
      {trails && (
        <mesh geometry={trails} name="pad-trails">
          <meshPhysicalMaterial
            {...(lights ? { map: lights, emissiveMap: lights } : { color: WORLD_COLORS.pad })}
            emissive={WORLD_COLORS.cloud}
            emissiveIntensity={0.45}
            roughness={0.3}
            clearcoat={clearcoat ? 0.9 : 0}
            clearcoatRoughness={0.15}
            transparent
            opacity={0.85}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
```

In `scene/MatchScene.tsx`, pass `clearcoat={profile.clearcoat}` to `<Jumps>`.

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run apps/client/test/tracks.test.ts apps/client/test/scene.test.tsx`
Expected: PASS, including the crowded-board budget (60 jumps, capped at 24 of each).

If the trough's floor faces down, the section's walk is reversed. Its points go from the left lip down and up to the right; check `TRAIL_SECTION`'s angles before touching the winding, which the wall test also pins.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`, and a match against bots.
- Each pad has a mint trail arching to its landing, with cream chevrons gliding toward the landing.
- Each slide is a dark chute between cream walls, its pink chevrons flowing toward the exit.
- The tile numbers stay readable around them.
- Take a screenshot for the ledger.

- [ ] **Step 5: Commit.** `git add -A apps/client && git commit -m "feat(client): arched pad trails and raised slide channels"` (with the trailer).

### Task 4: Pads, targets, vortices and exits on slots

The jumps' four parts move onto their slots. Their stand-ins are baked lying flat and facing +Z, so stand-ins and models take the same turn.

**Files:**
- Modify:
  - `apps/client/src/assets/models.ts`, `src/scene/tracks.ts`, `src/scene/Jumps.tsx`;
  - `apps/client/test/models.test.ts`, `test/tracks.test.ts`, `test/scene.test.tsx`.

**Interfaces:**
- **Consumes:** `useSlotMesh`, `SlotMesh` (Task 1); `CHANNEL`, `channelGeometry`, `trailGeometry`, `trailPath` (Task 3).
- **Produces:**
  - `padGeometry()`, `targetGeometry()`, `vortexGeometry()`, `exitGeometry()`, each lying flat at y = 0.03;
  - `padHeading(jump): number`;
  - instanced meshes named `vortices`, `exits`, `pads` and `targets`.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/models.test.ts`, add the four stand-ins to the import, and:

```ts
  it("lays the jumps' stand-ins flat on the tile, the pad's chevrons pointing forward (+Z) like its model's arrow (spec #5 §4.2)", () => {
    for (const g of [padGeometry(), targetGeometry(), vortexGeometry(), exitGeometry()]) {
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeCloseTo(0.03, 5);
      expect(g.boundingBox!.max.y).toBeCloseTo(0.03, 5);
    }
    const pad = padGeometry();
    const uv = pad.getAttribute('uv');
    let tip = 0;
    for (let i = 0; i < uv.count; i++) if (uv.getY(i) > uv.getY(tip)) tip = i;
    expect(pad.getAttribute('position').getZ(tip)).toBeCloseTo(0.6, 3);
  });
```

In `apps/client/test/tracks.test.ts`:
- add `Vector3` to an import from `three`, and `padHeading` to the tracks import;
- add:

```ts
  it("turns a pad's front (+Z) toward its landing tile", () => {
    for (const jump of [ladder, { id: 'l2', from: 5, to: 26 }, { id: 'l3', from: 82, to: 99 }, { id: 'l4', from: 58, to: 88 }]) {
      const front = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), padHeading(jump));
      const [fx, , fz] = tileToWorld(jump.from);
      const [tx, , tz] = tileToWorld(jump.to);
      expect(front.dot(new Vector3(tx - fx, 0, tz - fz).normalize())).toBeCloseTo(1, 5);
    }
  });
```

In `apps/client/test/scene.test.tsx`:
- add `Quaternion` to the `three` import, and `tileToWorld` to the layout import;
- import `openingUpdate` (already there);
- add:

```ts
  it('stands the jump parts on their tiles and turns each pad toward its landing (spec #5 §4.2)', async () => {
    const root = await renderScene('high');
    for (const name of ['vortices', 'exits', 'pads', 'targets']) expect(root.getObjectByName(name)).toBeInstanceOf(InstancedMesh);
    const pads = root.getObjectByName('pads') as InstancedMesh;
    const ladder = openingUpdate().view.board.jumps.find((j) => j.to > j.from)!;
    const at = new Matrix4();
    pads.getMatrixAt(0, at);
    const [p, q, s] = [new Vector3(), new Quaternion(), new Vector3()];
    at.decompose(p, q, s);
    const [fx, , fz] = tileToWorld(ladder.from);
    const [tx, , tz] = tileToWorld(ladder.to);
    expect(p.x).toBeCloseTo(fx, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(fz, 5);
    expect(new Vector3(0, 0, 1).applyQuaternion(q).dot(new Vector3(tx - fx, 0, tz - fz).normalize())).toBeCloseTo(1, 5);
  });
```

Run: `pnpm vitest run apps/client/test/models.test.ts apps/client/test/tracks.test.ts apps/client/test/scene.test.tsx`
Expected: FAIL. The stand-ins and `padHeading` don't exist, and the parts are unnamed and laid flat by their instance turn.

- [ ] **Step 2: The stand-ins and the turn.** In `apps/client/src/assets/models.ts`:
- add `CircleGeometry` and `RingGeometry` to the `three` import;
- add `LANE` to the layout import;
- add:

```ts
// The jumps' stand-ins (spec #5 §4.2): lying flat a hair above the tile top, facing +Z like the models.

/** A launch pad: its chevrons' tips (+v) point forward (+Z), where the model's arrow points. */
export function padGeometry(): BufferGeometry {
  return new CircleGeometry(0.6, 28).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, 0.03, 0);
}

export function targetGeometry(): BufferGeometry {
  return new RingGeometry(0.42, 0.6, 28).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
}

export function vortexGeometry(): BufferGeometry {
  return new CircleGeometry(LANE.vortexRadius, 32).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
}

export function exitGeometry(): BufferGeometry {
  return new RingGeometry(LANE.exitInner, LANE.exitOuter, 28).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
}
```

In `apps/client/src/scene/tracks.ts`, add:

```ts
/** The turn about Y that points a pad's front (+Z, like every model's) at its landing tile. */
export function padHeading(jump: Jump): number {
  const [fx, , fz] = tileToWorld(jump.from);
  const [tx, , tz] = tileToWorld(jump.to);
  return Math.atan2(tx - fx, tz - fz);
}
```

- [ ] **Step 3: The jumps draw the slots.** Replace `apps/client/src/scene/Jumps.tsx` with:

```tsx
import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from 'zustand';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import { exitGeometry, padGeometry, targetGeometry, vortexGeometry } from '../assets/models';
import { useSlotMesh, type SlotMesh } from '../assets/slotMesh';
import type { Director } from '../director/director';
import { slideCurve, tileToWorld } from './layout';
import { clamp01, easeOutBack } from './motion';
import { chevronTexture, swirlTexture } from './textures';
import { CHANNEL, channelGeometry, padHeading, trailGeometry, trailPath } from './tracks';

/** A cap that keeps a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;

/** A model's material named Glow, which the game may pulse (spec #5 §3.2). */
function glowOf(mesh: SlotMesh): MeshStandardMaterial | undefined {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.find((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial && m.name === 'Glow');
}

/**
 * Slides and launch pads (spec #2 §6.1, spec #5 §4.2): each slide a raised channel from its vortex to
 * its exit collar, each pad an arched trail to its landing target. Parts a board edit adds or removes
 * pop in or out.
 */
export function Jumps({ director, clearcoat }: { director: Director; clearcoat: boolean }) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const channels = useMemo(() => {
    if (snakes.length === 0) return null;
    const each = snakes.map((j) => channelGeometry(slideCurve(j.from, j.to).getPoints(CHANNEL.samples)));
    return { floor: mergeGeometries(each.map((c) => c.floor)), walls: mergeGeometries(each.map((c) => c.walls)) };
  }, [snakes]);
  const trails = useMemo(() => (ladders.length === 0 ? null : mergeGeometries(ladders.map((j) => trailGeometry(trailPath(j))))), [ladders]);
  const chevrons = useMemo(() => chevronTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const lights = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.cloud), []);
  const padChevrons = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.ink), []);
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vortex = useSlotMesh(
    'slide.vortex',
    () => ({ geometry: vortexGeometry(), material: new MeshBasicMaterial(swirl ? { map: swirl, transparent: true } : { color: BOARD_COLORS.slide }) }),
    { clearcoat },
  );
  const exit = useSlotMesh('slide.exit', () => ({ geometry: exitGeometry(), material: new MeshBasicMaterial({ color: WORLD_COLORS.chevron }) }), { clearcoat });
  const pad = useSlotMesh(
    'pad',
    () => ({ geometry: padGeometry(), material: new MeshStandardMaterial(padChevrons ? { map: padChevrons, roughness: 0.5 } : { color: WORLD_COLORS.pad, roughness: 0.5 }) }),
    { clearcoat },
  );
  const target = useSlotMesh('pad.target', () => ({ geometry: targetGeometry(), material: new MeshBasicMaterial({ color: WORLD_COLORS.pad }) }), { clearcoat });
  const targetGlow = useMemo(() => glowOf(target), [target]);
  const vorticesRef = useRef<InstancedMesh>(null);
  const exitsRef = useRef<InstancedMesh>(null);
  const padsRef = useRef<InstancedMesh>(null);
  const targetsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);

  useEffect(
    () => () => {
      channels?.floor.dispose();
      channels?.walls.dispose();
      trails?.dispose();
    },
    [channels, trails],
  );

  useFrame(({ clock }, delta) => {
    const { beat, presentation } = director.store.getState();
    const t = beat ? clamp01((Date.now() - beat.startedAt) / beat.durationMs) : 1;
    const pop = (id: string) => {
      if (beat?.kind !== 'boardEdit' || !presentation) return 1;
      const before = presentation.jumps.some((j) => j.id === id);
      const after = beat.after.jumps.some((j) => j.id === id);
      if (before && !after) return 1 - t;
      return !before && after ? Math.max(0, easeOutBack(t)) : 1;
    };
    // Every part stands on its tile's top and turns only about Y.
    const stamp = (mesh: InstancedMesh | null, list: Jump[], tile: (j: Jump) => number, turn: (j: Jump) => number) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        const [x, , z] = tileToWorld(tile(j));
        place.position.set(x, 0, z);
        place.rotation.set(0, turn(j), 0);
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    stamp(vorticesRef.current, snakes, (j) => j.from, () => clock.elapsedTime * 2.5);
    stamp(exitsRef.current, snakes, (j) => j.to, () => 0);
    stamp(padsRef.current, ladders, (j) => j.from, padHeading);
    stamp(targetsRef.current, ladders, (j) => j.to, () => 0);
    // The landing stars breathe (spec #5 §4.2).
    if (targetGlow) {
      const base = (targetGlow.userData.glow ??= targetGlow.emissiveIntensity) as number;
      targetGlow.emissiveIntensity = base * (0.65 + 0.35 * Math.sin(clock.elapsedTime * 3));
    }
    if (chevrons) chevrons.offset.y -= delta * 0.8;
    if (lights) lights.offset.y -= delta * 0.9; // the trail's lights travel toward the landing
    if (padChevrons) padChevrons.offset.y -= delta * 0.6;
  });

  return (
    <group>
      {channels && (
        <>
          <mesh geometry={channels.walls} name="slide-walls">
            <meshStandardMaterial color={WORLD_COLORS.cloud} roughness={0.45} />
          </mesh>
          <mesh geometry={channels.floor} name="slide-floors" receiveShadow>
            <meshStandardMaterial {...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide })} side={DoubleSide} roughness={0.8} />
          </mesh>
        </>
      )}
      {trails && (
        <mesh geometry={trails} name="pad-trails">
          <meshPhysicalMaterial
            {...(lights ? { map: lights, emissiveMap: lights } : { color: WORLD_COLORS.pad })}
            emissive={WORLD_COLORS.cloud}
            emissiveIntensity={0.45}
            roughness={0.3}
            clearcoat={clearcoat ? 0.9 : 0}
            clearcoatRoughness={0.15}
            transparent
            opacity={0.85}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
      <instancedMesh ref={vorticesRef} name="vortices" args={[vortex.geometry, vortex.material, MAX_JUMPS]} />
      <instancedMesh ref={exitsRef} name="exits" args={[exit.geometry, exit.material, MAX_JUMPS]} />
      <instancedMesh ref={padsRef} name="pads" args={[pad.geometry, pad.material, MAX_JUMPS]} />
      <instancedMesh ref={targetsRef} name="targets" args={[target.geometry, target.material, MAX_JUMPS]} />
    </group>
  );
}
```

Every part is stamped every frame, so a model replacing a stand-in needs nothing more.

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run apps/client/test/models.test.ts apps/client/test/tracks.test.ts apps/client/test/scene.test.tsx`
Expected: PASS.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`, and a match against bots.
- Each pad's chevrons point along its trail toward the landing; check a few pads on different rows.
- The vortices swirl.
- A card that adds or removes a jump still pops its parts in and out. If no such card comes up within a couple of minutes, ledger that it went unchecked; the pop code is unchanged.

- [ ] **Step 5: Commit.** `git commit -am "feat(client): pads, targets, vortices and exits draw their slots"` (with the trailer).

### Task 5: The board models' contract

The rules for the five models before any exists. Also the busy-match budget test, and the Blender helpers the models need.

**Files:**
- Create: `art/test/budget.test.ts`
- Modify:
  - `art/contract.ts`, `art/test/contract.test.ts`, `art/test/tsconfig.json`;
  - `art/lib/palette.py`, `art/lib/shapes.py`, `art/preview.py`.

**Interfaces:**
- **Consumes:**
  - `ModelRule`, `MODELS`, `contractProblems`, `GlbSummary`, `readGlb` (plan 1);
  - `slideCurve`, `CHANNEL`, `channelGeometry`, `trailGeometry`, `trailPath` (Tasks 3–4);
  - the slot names (Task 1).
- **Produces:**
  - `MODELS` entries `tile`, `pad`, `target`, `vortex`, `exit`, and the check `arrowForward`;
  - `palette.MINT`, `palette.PINK`, `palette.SLIDE`;
  - `shapes.outline(…, view='top', lift=…)`, `shapes.tube(name, points, radius, material, sides=6)`;
  - `preview.py`, which spaces models by width.

- [ ] **Step 1: Write the failing tests.** In `art/test/contract.test.ts`, add:

```ts
  it("checks a pad's arrow points forward (+Z), the way the game turns it toward the landing", () => {
    const pad = (arrowZ: [number, number]): GlbSummary => ({
      min: [-0.57, 0, -0.57],
      max: [0.57, 0.2, 0.57],
      triangles: 900,
      materials: ['Pad', 'Arrow'],
      byMaterial: { Arrow: { min: [-0.26, 0.17, arrowZ[0]], max: [0.26, 0.2, arrowZ[1]] } },
      transformedNodes: [],
    });
    expect(contractProblems('pad', pad([-0.21, 0.37]))).toEqual([]);
    expect(contractProblems('pad', pad([-0.37, 0.21]))).toEqual(['the arrow does not point forward (+Z): it reaches 0.21 forward and 0.37 back']);
  });

  it('keeps a tile to its one Tint material, so instancing can paint it', () => {
    const tile: GlbSummary = { min: [-0.76, 0, -0.76], max: [0.76, 0.22, 0.76], triangles: 120, materials: ['Tint', 'Edge'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('tile', tile)).toEqual(['it has 2 materials; at most 1']);
  });
```

Create `art/test/budget.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { slideCurve } from '../../apps/client/src/scene/layout';
import { CHANNEL, channelGeometry, trailGeometry, trailPath } from '../../apps/client/src/scene/tracks';
import { MODELS } from '../contract';
import { readGlb, type GlbSummary } from '../glb';

// A busy match on High quality, priced with the built models (spec #5 §1: at most 100 draw calls and
// 150,000 triangles). The busiest moment is a roll: four dice tumble while every piece and part shows.
// Today's boards have 8 slides and 10 pads; cards add a few, so this prices 12 and 14.

const DIR = new URL('../../apps/client/public/models/', import.meta.url);
const SLIDES = 12;
const PADS = 14;
const SEATS = 4;
/** The scene's own parts during a roll: the sky, the number overlay, the "?" rings and four shield bubbles. */
const CODE = { calls: 7, triangles: 3_200 };

/** How the game draws each model: its copies, whether each copy is its own draw (not instanced), and shadows (drawn twice). */
const USES: Record<string, { copies: number; separate?: boolean; shadows?: boolean }> = {
  die: { copies: SEATS, separate: true, shadows: true },
  crown: { copies: 1, separate: true, shadows: true },
  tile: { copies: 100 },
  pad: { copies: PADS },
  target: { copies: PADS },
  vortex: { copies: SLIDES },
  exit: { copies: SLIDES },
  island: { copies: 1, separate: true },
  bumper: { copies: 36 },
  cloud: { copies: 8 },
  prop_die: { copies: 1, separate: true },
  prop_cards: { copies: 1, separate: true },
  prop_spinner: { copies: 1, separate: true },
  prop_hourglass: { copies: 1, separate: true },
  prop_chips: { copies: 1, separate: true },
};

const triangles = (g: BufferGeometry) => g.index!.count / 3;

function built(id: string): GlbSummary | null {
  const url = new URL(`${id}.glb`, DIR);
  return existsSync(url) ? readGlb(new Uint8Array(readFileSync(url))) : null;
}

describe('a busy match with the built models (spec #5 §1)', () => {
  it('stays within 100 draw calls and 150,000 triangles', () => {
    const rows: string[] = [];
    let calls = CODE.calls;
    let total = CODE.triangles;
    const add = (name: string, c: number, t: number) => {
      calls += c;
      total += t;
      rows.push(`${name}: ${c} calls, ${t} triangles`);
    };
    // The tracks, priced with the game's own builders on a long slide and a long pad.
    const slide = channelGeometry(slideCurve(99, 2).getPoints(CHANNEL.samples));
    add('slide channels', 2, SLIDES * (triangles(slide.floor) + triangles(slide.walls)));
    add('pad trails', 1, PADS * triangles(trailGeometry(trailPath({ id: 'l', from: 3, to: 97 }))));
    // One piece per seat, the heaviest four, each drawn twice for shadows.
    const pieces = Object.keys(MODELS)
      .filter((id) => MODELS[id]!.slot.startsWith('piece.'))
      .map(built)
      .filter((m): m is GlbSummary => m !== null);
    const heaviest = (key: (m: GlbSummary) => number) =>
      pieces
        .map(key)
        .sort((a, b) => b - a)
        .slice(0, SEATS)
        .reduce((sum, v) => sum + v, 0);
    add('pieces', heaviest((m) => m.materials.length) * 2, heaviest((m) => m.triangles) * 2);
    for (const [id, use] of Object.entries(USES)) {
      const model = built(id);
      if (!model) continue;
      const passes = use.shadows ? 2 : 1;
      add(id, model.materials.length * passes * (use.separate ? use.copies : 1), model.triangles * use.copies * passes);
    }
    expect(calls, rows.join('\n')).toBeLessThanOrEqual(100);
    expect(total, rows.join('\n')).toBeLessThanOrEqual(150_000);
  });
});
```

In `art/test/tsconfig.json`, add `"compilerOptions": { "lib": ["ES2023", "DOM"] }`. three's types need the DOM, now that the budget test reaches the game's tracks.

Run: `pnpm vitest run art/test`
Expected:
- FAIL: `pad` and `tile` have no rule in `art/contract.ts`.
- `budget.test.ts` passes already, pricing Step 1's models and the tracks. Read its rows with `pnpm vitest run art/test/budget.test.ts --reporter verbose` and ledger the totals as the starting point.

- [ ] **Step 2: The rules.** In `art/contract.ts`, add after `oneOnTop`:

```ts
/** A pad's arrow points forward (+Z), the way the game turns pads toward their landing: its tip reaches further forward than its tail reaches back. */
function arrowForward(model: GlbSummary): string | null {
  const arrow = model.byMaterial.Arrow;
  if (!arrow) return null; // requiredMaterials reports a missing Arrow
  const forward = arrow.max[2]!;
  const back = -arrow.min[2]!;
  return forward > back + 0.05 ? null : `the arrow does not point forward (+Z): it reaches ${forward.toFixed(2)} forward and ${back.toFixed(2)} back`;
}
```

Then add to `MODELS`, after `crown`:

```ts
  // The board (spec #5 §4.2): parts stand on the tile top; instancing draws each once per material.
  tile: { slot: 'tile', origin: 'base', height: [0.21, 0.23], maxWidth: 1.53, maxTriangles: 200, maxMaterials: 1, requiredMaterials: ['Tint'] },
  pad: { slot: 'pad', origin: 'base', height: [0.12, 0.26], maxWidth: 1.25, maxTriangles: 1500, maxMaterials: 2, requiredMaterials: ['Arrow'], checks: [arrowForward] },
  target: { slot: 'pad.target', origin: 'base', height: [0.03, 0.12], maxWidth: 1.3, maxTriangles: 800, maxMaterials: 2, requiredMaterials: ['Glow'] },
  vortex: { slot: 'slide.vortex', origin: 'base', height: [0.05, 0.16], maxWidth: 0.72, maxTriangles: 1500, maxMaterials: 2, requiredMaterials: ['Glow'] },
  exit: { slot: 'slide.exit', origin: 'base', height: [0.04, 0.12], maxWidth: 0.72, maxTriangles: 800, maxMaterials: 1, requiredMaterials: [] },
```

Run: `pnpm vitest run art/test`
Expected: PASS.

- [ ] **Step 3: The Blender helpers.** In `art/lib/palette.py`, add:

```python
MINT = '#5ff0c5'   # launch pads and their trails
PINK = '#ff5470'   # slide rims and collars
SLIDE = '#2a2140'  # inside a slide's vortex
```

In `art/lib/shapes.py`:
- change `from mathutils import Matrix` to `from mathutils import Matrix, Vector`;
- give `outline` a `lift=0.0` parameter after `resolution`, and a third view. Add to its docstring: "view='top': the outline lies flat, its base at z = lift; the drawing's x is the model's left to right and its up (+y) is the model's forward (−Y). It's turned half round, a rotation, not a mirror.";
- replace everything from `dx, dy = offset` to the end of the function with:

```python
    dx, dy = offset
    if view == 'side':
        obj.rotation_euler = (math.pi / 2, 0.0, -math.pi / 2)
        obj.location = (0.0, -dx, dy)
    elif view == 'front':
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
        obj.location = (dx, 0.0, dy)
    elif view == 'top':
        obj.rotation_euler = (0.0, 0.0, math.pi)
        obj.location = (-dx, -dy, lift + depth / 2)
    else:
        raise ValueError(f'unknown view {view!r}')
    return obj
```

- add after `rounded_box`:

```python
def tube(name, points, radius, material, sides=6, smooth=True):
    """A round tube along a path of (x, y, z) points, its ends open: a spring's coil, a spiral ridge."""
    bm = bmesh.new()
    rings = []
    for i, point in enumerate(points):
        ahead = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        across = ahead.cross(Vector((0.0, 0.0, 1.0)) if abs(ahead.z) < 0.9 else Vector((1.0, 0.0, 0.0))).normalized()
        up = across.cross(ahead)
        centre = Vector(point)
        rings.append([bm.verts.new(centre + (across * math.cos(a) + up * math.sin(a)) * radius) for a in (k * math.tau / sides for k in range(sides))])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth)
```

Replace `art/preview.py`'s `GAP` and its layout and camera, from `for i, model_id in enumerate(ids):` to `scene.camera = camera`, with spacing by width (a tile is wider than a piece, the island much wider):

```python
        groups = []
        for model_id in ids:
            before = set(scene.objects)
            bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{model_id}.glb'))
            groups.append([obj for obj in set(scene.objects) - before if obj.parent is None])
        bpy.context.view_layer.update()
        sizes = [extent(roots) for roots in groups]
        gap = max(hi.x - lo.x for lo, hi in sizes) + 0.4
        for i, (roots, (lo, hi)) in enumerate(zip(groups, sizes)):
            shift = (i - (len(groups) - 1) / 2) * gap - (lo.x + hi.x) / 2
            for obj in roots:
                obj.location.x += shift
        low = min(lo.z for lo, _ in sizes)
        tall = max(hi.z - lo.z for lo, hi in sizes)
        distance = max(4.0, max(len(groups) * gap, tall * 2.5) * 1.6)
        camera = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
        scene.collection.objects.link(camera)
        camera.location = (distance * 0.5, -distance, low + tall * 0.5 + distance * 0.15)  # a three-quarter view
        camera.rotation_euler = (Vector((0.0, 0.0, low + tall * 0.45)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.clip_end = distance * 4
        scene.camera = camera
```

And add, after `arguments()`:

```python
def extent(roots):
    """The world bounds of imported objects and everything under them: (lowest corner, highest corner)."""
    corners = [obj.matrix_world @ Vector(c) for root in roots for obj in (root, *root.children_recursive) if obj.type == 'MESH' for c in obj.bound_box]
    return (Vector([min(c[k] for c in corners) for k in range(3)]), Vector([max(c[k] for c in corners) for k in range(3)]))
```

Then check the helpers through the link: rebuild the pawn (plan 1's build snippet with `'ART_IDS': ['pawn']`). Expected: the same report as in plan 1, and `untouched: True`. Preview `['knight', 'pawn', 'duck']` and Read the PNG. Expected: three pieces side by side, framed like before.

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run art/test`, then `pnpm typecheck` (now with DOM types for `art/test`), `pnpm lint` and `pnpm test`.
Expected: all green, and `git status` shows no changed `.glb` (the pawn rebuilt the same).

- [ ] **Step 5: Commit.** `git add -A art && git commit -m "test(art): the board models' contract, a busy-match budget, and helpers for flat outlines and tubes"` (with the trailer).

### Task 6: The tile model

**Files:**
- Create: `art/models/tile.py`, `apps/client/public/models/tile.glb`
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** the build and helpers (plan 1 Task 4, this plan's Task 5); the `tile` rule (Task 5); the tile slot (Task 2).
- **Produces:** `tile.glb`, listed for `tile`.

- [ ] **Step 1: List it (the failing test).** Add `tile: 'tile',` to `SLOT_FILES`.

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "tile is listed in slotFiles.ts but tile.glb isn't built".

- [ ] **Step 2: Write the model.** Create `art/models/tile.py`:

```python
"""A board tile (spec #5 §4.2): the mockup's chunky rounded slab, standing on its base. Its one material
is Tint, white, so the game paints each square its colour through instancing."""
from lib import finish, palette, shapes

SIZE = 1.52       # 0.95 of a 1.6 tile, leaving a gap between squares
THICKNESS = 0.22  # TILE_THICKNESS in the game: the top sits at the board surface


def build():
    tint = finish.satin('Tint', palette.WHITE)
    return [shapes.rounded_box('tile', (SIZE, SIZE, THICKNESS), 0.07, tint, location=(0.0, 0.0, THICKNESS / 2), segments=2)]
```

- [ ] **Step 3: Build it through the link** (plan 1's build snippet with `'ART_IDS': ['tile']`).

Expected: one entry, `tile`, about 100–120 triangles, `['Tint']`, 0.22 tall, `untouched: True`.

- [ ] **Step 4: Look at it.** Preview `['tile', 'pawn']` (the pawn for scale) and Read the PNG. Expected: a flat white slab with soft rounded edges, about one and a half pawn-widths across.

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`. Expected: PASS; `tile.glb keeps its contract`, and the budget holds.

Then the browser: `pnpm dev`, and a match against bots.
- The board's tiles are the Blender slabs, in their colours.
- The purple "?" squares and the gold last tile show.
- The numbers sit on top.
- The menu's floating tiles are the same slab.
- The console has no "asset slot" warning.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the board tile"` (with the trailer).

### Task 7: The pad and its landing target

**Files:**
- Create: `art/models/pad.py`, `art/models/target.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:**
  - `shapes.tube` and the top-view `shapes.outline` (Task 5);
  - the `pad` (with `arrowForward`) and `target` rules (Task 5);
  - the slots (Task 4).
- **Produces:** `pad.glb`, `target.glb`, listed for `pad` and `pad.target`.

- [ ] **Step 1: List them (the failing test).** Add `pad: 'pad',` and `'pad.target': 'target',` to `SLOT_FILES`.

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "pad is listed in slotFiles.ts but pad.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/pad.py`:

```python
"""A launch pad (spec #5 §4.2): a glossy mint spring pad, its plate on a chunky coil, with a big dark
arrow pointing forward (-Y here, +Z in the game), which the game turns toward the landing tile."""
import math

from lib import finish, palette, shapes

BASE = [(0, 0), (0.55, 0), (0.57, 0.02), (0.55, 0.04), (0, 0.04)]
PLATE = [(0, 0.12), (0.5, 0.12), (0.54, 0.135), (0.54, 0.155), (0.5, 0.17), (0, 0.17)]
ARROW = [('M', 0, 0.36), ('L', 0.25, 0.1), ('L', 0.1, 0.1), ('L', 0.1, -0.2), ('L', -0.1, -0.2), ('L', -0.1, 0.1), ('L', -0.25, 0.1), ('L', 0, 0.36)]
TURNS = 2


def build():
    pad = finish.glossy('Pad', palette.MINT)
    arrow = finish.glossy('Arrow', palette.INK)
    steps = 12 * TURNS
    coil = []
    for i in range(steps + 1):
        a = i * math.tau * TURNS / steps
        coil.append((0.36 * math.cos(a), 0.36 * math.sin(a), 0.04 + 0.08 * i / steps))
    return [
        shapes.revolve('base', BASE, pad, segments=28),
        shapes.tube('coil', coil, 0.03, pad, sides=6),
        shapes.revolve('plate', PLATE, pad, segments=28),
        shapes.outline('arrow', ARROW, 0.03, arrow, bevel=0.008, view='top', resolution=1, lift=0.17),
    ]
```

Create `art/models/target.py`:

```python
"""A launch pad's landing target (spec #5 §4.2): a raised glossy mint ring round a gold star that glows;
the game makes it breathe."""
import math

from lib import finish, palette, shapes

RING = [(0.44, 0), (0.6, 0), (0.615, 0.03), (0.6, 0.06), (0.44, 0.06), (0.425, 0.03)]  # a loop: the ring's section
# Five points, the first straight ahead; outer radius 0.3, inner 0.13.
STAR = [('M' if i == 0 else 'L', (0.3 if i % 2 == 0 else 0.13) * math.sin(i * math.pi / 5), (0.3 if i % 2 == 0 else 0.13) * math.cos(i * math.pi / 5)) for i in range(10)]
STAR.append(('L', 0.0, 0.3))


def build():
    ring = finish.glossy('Ring', palette.MINT)
    star = finish.glow('Glow', palette.GOLD, 1.5)
    return [
        shapes.revolve('ring', RING, ring, segments=36),
        shapes.outline('star', STAR, 0.04, star, bevel=0.01, view='top', resolution=1),
    ]
```

- [ ] **Step 3: Build them through the link** (`'ART_IDS': ['pad', 'target']`).

Expected:
- pad: 700–1,200 triangles, `['Pad', 'Arrow']`, about 0.2 tall;
- target: 500–800 triangles, `['Ring', 'Glow']`, about 0.06 tall;
- `untouched: True`.

- [ ] **Step 4: Look at them.** Preview `['pad', 'target']` and Read the PNG. Check that:
- the pad's arrow points toward the camera's side (−Y);
- the coil shows between base and plate;
- the star sits inside the ring, flat and unbroken (a star with a hole or a twisted point means `_bezier` met a sharp corner badly; raise its `bevel` or simplify the outline, then rebuild).

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`.
Expected: PASS, including `the arrow … forward` (Review Focus 1) and the budget.

Then the browser: in a match, every pad's arrow points along its trail to its landing (check at least three pads on different rows), and the stars breathe.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the launch pad and its landing target"` (with the trailer).

### Task 8: The vortex and the exit collar

**Files:**
- Create: `art/models/vortex.py`, `art/models/exit.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** `shapes.tube` (Task 5); the `vortex` and `exit` rules (Task 5); the slots (Task 4).
- **Produces:** `vortex.glb`, `exit.glb`, listed for `slide.vortex` and `slide.exit`.

- [ ] **Step 1: List them (the failing test).** Add `'slide.vortex': 'vortex',` and `'slide.exit': 'exit',` to `SLOT_FILES`.

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "slide.vortex is listed in slotFiles.ts but vortex.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/vortex.py`:

```python
"""A slide's head (spec #5 §4.2): a dark funnel with three glowing spiral ridges, inside a pink rim that
glows. The tile under it is solid, so the funnel can't sink in: its rim stands up and the funnel slopes
down to the tile, which reads as sunken. The game spins it."""
import math

from lib import finish, palette, shapes

FUNNEL = [(0, 0.006), (0.29, 0.07), (0.29, 0.0), (0, 0.0)]
RIM = [(0.28, 0.03), (0.33, 0.03), (0.35, 0.065), (0.33, 0.1), (0.29, 0.1), (0.27, 0.065)]  # a loop
ARMS = 3
STEPS = 13


def surface(r):
    """The funnel's height at radius r."""
    return 0.006 + (0.07 - 0.006) * r / 0.29


def build():
    inside = finish.glossy('Inside', palette.SLIDE)
    glow = finish.glow('Glow', palette.PINK, 1.2)
    parts = [shapes.revolve('funnel', FUNNEL, inside, segments=32), shapes.revolve('rim', RIM, glow, segments=32)]
    for k in range(ARMS):
        arm = []
        for i in range(STEPS + 1):
            t = i / STEPS
            r = 0.05 + 0.22 * t
            a = k * math.tau / ARMS + 2.2 * math.pi * t
            arm.append((r * math.cos(a), r * math.sin(a), surface(r) + 0.008))
        parts.append(shapes.tube(f'ridge{k}', arm, 0.016, glow, sides=5))
    return parts
```

Create `art/models/exit.py`:

```python
"""A slide's tail (spec #5 §4.2): a raised glossy pink collar where the piece pops out."""
from lib import finish, palette, shapes

COLLAR = [(0.24, 0), (0.34, 0), (0.345, 0.03), (0.32, 0.075), (0.28, 0.085), (0.245, 0.06)]  # a loop


def build():
    collar = finish.glossy('Collar', palette.PINK)
    return [shapes.revolve('collar', COLLAR, collar, segments=32)]
```

- [ ] **Step 3: Build them through the link** (`'ART_IDS': ['vortex', 'exit']`).

Expected:
- vortex: 700–1,200 triangles, `['Inside', 'Glow']`, about 0.1 tall, at most 0.7 wide;
- exit: about 380 triangles, `['Collar']`, about 0.085 tall;
- `untouched: True`.

- [ ] **Step 4: Look at them.** Preview `['vortex', 'exit']` and Read the PNG. Check that:
- three pink ridges spiral down a dark funnel inside a pink rim;
- the ridges ride on the funnel's surface, neither floating nor buried;
- the collar is a clean ring.

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`.
Expected: PASS, with all five board models keeping their contract and the budget holding. Ledger the budget test's totals.

Then the browser: in a match, each slide starts at a spinning, glowing vortex and ends at a pink collar, and the channel runs between them.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the slide vortex and exit collar"` (with the trailer).

### Task 9: Shots, docs, the gate and the Step 2 review

**Files:**
- Modify:
  - `apps/client/e2e/shots.spec.ts`, `apps/client/playwright.config.ts`;
  - `apps/client/README.md`, `art/README.md`, `docs/superpowers/HANDOFF.md`.

- [ ] **Step 1: The jumps shot.**
- In `apps/client/playwright.config.ts`, make the `shots` project `use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 }`, so the crops are sharp.
- In `apps/client/e2e/shots.spec.ts`, in "a match: the overview and a close-up", rename the test "a match: the overview, the jumps and a close-up". Right after the `match-overview.png` screenshot, add:

```ts
  // The middle of the board from the overview, at 2x: pad trails and slide channels (spec #5 §7).
  await page.screenshot({ path: `${OUT}/match-jumps.png`, clip: { x: 320, y: 140, width: 640, height: 400 } });
```

Run: `pnpm shots`
Expected: 3 passed, and `match-jumps.png` holds at least one trail and one slide. If the crop misses them, move the clip (ledger the numbers).

- [ ] **Step 2: Write the docs.**
- **`apps/client/README.md`**, in "Asset slots and Blender models", add after the Loading bullet:

```markdown
- **Instanced slots** (`MESH_SLOTS`: tiles, pads, targets, vortices, exits) load through `useSlotMesh` (`src/assets/slotMesh.ts`): the model becomes one geometry with a group per material, so every copy draws once per material. It returns the stand-in until the model loads and never suspends, so callers re-place their instances when it changes. The stand-ins lie flat and face +Z, like the models, so pads turn the same way either way (`padHeading`).
- **Tracks** (`src/scene/tracks.ts`): each pad's arched trail and each slide's raised channel are swept in code along the jump's arc or lane, with v running along them so their chevrons scroll.
```

- **`art/README.md`**, in "The rules", add:
  - "Board parts stand on the tile top with their origin at the base, and face −Y; the game turns them only about the vertical."
  - "A model with `Tint` has only that material: instance colours tint every material of a mesh."
  - "Flat outlines (arrows, stars) use `shapes.outline(…, view='top', lift=…)`; coils and ridges use `shapes.tube`."
  - "`art/test/budget.test.ts` prices a busy match with the built models; a heavy model fails it before the browser tests do."
- **`docs/superpowers/HANDOFF.md`:**
  - the Spec #5 row: "Step 2 of 3 done: tiles, pads and trails, targets, vortices and slide channels, exits; awaiting the user's review";
  - next step: the user reviews the Step 2 shots, then plan 3 (`docs/superpowers/plans/2026-10-09-art-pass-step3.md`) runs;
  - add this plan's deferred minors to Open items.

- [ ] **Step 3: Gate.**
  - Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e`. Expected: all green; e2e 14 passed:
    - the whole-match test logs no slot warning;
    - the budget test stays within 100 draw calls and 150,000 triangles. Ledger the highest numbers it saw.
  - Run `BLENDER="E:/Software/Blender/blender.exe" pnpm art`. Expected: fourteen report lines, no changed `.glb` in `git status`, and `pnpm vitest run art/test` passes.
- [ ] **Step 4: Commit.** `git commit -am "docs: instanced slots, the tracks, and the hand-off for spec #5 step 2"` (with the trailer).
- [ ] **Step 5: The review.**
  - **Self-review:** review this plan's commits against its Review Focus, and say it was a self-review. Ledger findings as plan 1 did: Critical and Important get a test and a fix in one pass; Minor go to HANDOFF's Open items.
  - **Shots:** run `pnpm shots`. Add a Step 2 section to the Step 1 review page, and republish it to the same link. If the local file is gone, read the page back with the Artifact tool first. The section shows:
    - the match overview;
    - the jumps crop;
    - the close-up;
    - the menu (tiles);
    - a short list of what changed, and the two calls the user may want to change: cream channel walls, and the gold star.
  - Send the user the link.
  - **Stop.** Plan 3 starts only after the user approves or asks for changes. Changes they ask for in Step 2 are made first, with the same build and checks.

After the user approves:
1. Fast-forward merge `art/spec-5` into `main` locally, and run `pnpm test` on `main`.
2. Keep the branch for Step 3.
3. Update memory (`handoff`).
