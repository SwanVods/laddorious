# Art Pass, Step 3: the World (Implementation Plan)

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blender models for the world around the board: the toy-box island (a cream slab on a candy rock), its bumpers, the clouds, the menu podium, and five oversized props on floating rocks (a die, a card stack, a spinner, an hourglass, poker chips). Screenshots go to the user for the Step 3 review, and Spec #5 is finished.

**Architecture:**
- **Bumpers and clouds** are drawn many times, so they join the instanced slots (`useSlotMesh`, plan 2).
- **The island, the podium and the props** are whole models in `Slot`s, which gain `receiveShadow`.
- **Props** bob and turn slowly on their rocks in code. They have no stand-in: a prop that doesn't load leaves the sky clear.
- **Models** come from the same `art/` build. A rock helper makes every low-poly, flat-shaded candy rock, from the island's to each prop's.

**Tech Stack:** Blender 5.2 (Python 3.13, the bundled glTF exporter), TypeScript, React Three Fiber, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-art-pass-design.md` (§4.3 is this plan's step; §3, §5, §6 and §7 hold for every step).

**This is plan 3 of 3.** The user asked for all three plans at once, so this one was written before the Step 1 and Step 2 reviews. It starts only after the user approves Step 2. Changes that review asks for are made first, with plan 2's build and checks. Any that touch this plan are ledgered as rulings before Task 1.

**Builds on plans 1 and 2.** It assumes:
- **plan 1:** `slotFiles.ts`, `slots.tsx` (`Slot`, `ModelOptions`, `prepareModel`, `prepareMaterial`), the `art/` build, `contract.ts`, `glb.ts`, `pnpm shots`;
- **plan 2:** `useSlotMesh`, `MESH_SLOTS`, `preloadSlotMeshes`, `TILE_THICKNESS` in `layout.ts`, `tileGeometry`, `art/test/budget.test.ts` (which already prices the world's models once built), `shapes.tube`, the top-view `shapes.outline`, and `preview.py` spacing by width.

## Global Constraints

- Everything in plan 1's and plan 2's Global Constraints holds.
- **Budgets for this step (spec §4.3):**
  - island ≤ 8,000 triangles;
  - bumper ≤ 200;
  - cloud ≤ 300;
  - podium ≤ 3,000;
  - each prop ≤ 3,000.
- **A busy match stays within 100 draw calls and 150,000 triangles** (`art/test/budget.test.ts` and e2e). The props are separate draws, one per material, so each has at most 3 materials.
- **The props stay out of the board view's centre** (spec §4.3): never over the board, never between the overview camera and the board.
- **Colours come from `theme.ts`.** The spec's "red and white" bumpers are the palette's pink (`#ff5470`) and cream (`#fff7ec`).

## Decisions made while planning

The spec is the authority; these fill in what it leaves open.

1. **The island's origin is its top,** where the tiles stand (contract `origin: 'top'`). The game puts it at y = −`TILE_THICKNESS`, under the tiles' bases. Every other model keeps its origin at the base (or the die's middle).
2. **The island:**
   - a 19.2 × 19.2 cream slab, 0.45 thick, with rounded edges, under the 16-unit board and its bumpers (which stand 8.6 out);
   - on a rock 12 across its top and 6 deep, with a sand-coloured top and teal sides, flat-shaded and jittered;
   - the rock is wider than the slab, so a ring of sand shows round it.
3. **Bumpers alternate pink and cream** (`WORLD_COLORS.bumper` becomes `['#ff5470', '#fff7ec']`). This is the spec's "red and white" in Tangerine Dusk colours; today's are pink and mint.
4. **A cloud is one model:** three chunky low-poly lumps on a flat base, drawn once per cloud, where today each cloud is three sphere puffs. The menu's clouds use it too, one per cluster.
5. **The podium model stands on its base, 0.75 to its top,** where the menu stands the piece. The menu puts it at y = −0.2, which leaves today's piece height (`TOP_Y` 0.55) unchanged.
   - It holds the top, band, base and glowing ring.
   - The floating rock under the podium stays code-built.
6. **Props have no stand-in.** They're decoration, so a missing one leaves the sky clear (`fallback={null}`), and unit tests draw none.
7. **Prop ids** are `prop_die`, `prop_cards`, `prop_spinner`, `prop_hourglass` and `prop_chips` (Python module names can't hold a dot). Their slots are `prop.die` and so on.
8. **Each prop has 3 materials,** its rock in one teal (`Rock`). That keeps the five at 15 draw calls; the budget test prices a busy match at about 92.
9. **The props' places** start round the back and sides of the island, 17–19 out. They bob 0.3 and turn slowly. The spec leaves the exact places to the review, which tunes them from the shots.
10. **Contract rules gain `offCentre`,** a per-model tolerance for how far the footprint's middle may sit from the origin. The default stays 0.08; jagged rocks and tipped props get more.
11. **`ModelOptions.receiveShadow`:** the island and the podium receive shadows, as their stand-ins do today.

## Review Focus

1. **The island floats above or sinks into the board.** Expected: its slab's top meets the tiles' bases at y = −0.22. Pinned:
   - Task 1: the island group stands at −`TILE_THICKNESS`;
   - Task 4: the contract checks the island's top is at its origin.
2. **The menu piece floats over or sinks into the podium model.** Expected: it stands on the top. Pinned:
   - Task 3: the podium group plus 0.75 is the turntable's height;
   - Task 4: the contract checks the podium's `Top` reaches 0.75.
3. **A prop drifts over the board or into the camera's view of it.** Expected: props stay round the island's back and sides. Pinned in Task 2 (every prop is more than 14 from the middle and behind z = 6).
4. **The bumper model replaces the stand-in, and the bumpers end up unplaced and unpainted.** Expected: the ring of pink and cream stays. Pinned in Task 1 (a swap mid-render, then bumper 35's place and colour).
5. **The world's models push a busy match past 100 draw calls.** The props are separate draws. Expected: within budget. Pinned:
   - Task 7: `budget.test.ts` prices the props once they're built;
   - Task 8: e2e measures a real match.

## File map

| Path | Task | What it holds |
|---|---|---|
| `apps/client/src/assets/slotFiles.ts` | 1 | slot names `bumper`, `cloud`, `podium`, `prop.*`; `MESH_SLOTS` gains `bumper`, `cloud` |
| `apps/client/src/assets/slots.tsx` | 1 | `ModelOptions.receiveShadow` |
| `apps/client/src/app/theme.ts` | 1 | pink and cream bumpers |
| `apps/client/src/assets/models.ts` | 1 | stand-ins `bumperGeometry`, `cloudGeometry` |
| `apps/client/src/scene/Surroundings.tsx` | 1, 2 | the island on its slot, bumpers and clouds through `useSlotMesh`, `PROPS` |
| `apps/client/src/scene/MenuScene.tsx` | 3 | the podium on its slot, one cloud model per cloud |
| `art/contract.ts`, `art/test/contract.test.ts` | 4 | `origin: 'top'`, `offCentre`, `topAt`, the world's rules |
| `art/lib/palette.py`, `art/lib/shapes.py` | 4 | the island and podium colours; `rock`, `lump`, `place`, several materials per part |
| `art/models/{island,bumper,cloud,podium,prop_*}.py` | 5–7 | the nine models |
| `apps/client/public/models/*.glb` | 5–7 | built (committed) |

---

### Before Task 1: fold in the Step 2 review

- [ ] Read the user's Step 2 review. Make the changes they asked for with plan 2's build and checks, and commit them on `art/spec-5`.
- Ledger each one that changes something this plan relies on as `Before: Ruling: …`.
- Then run `pnpm test`. Expected: green, the same count as at the end of plan 2.

### Task 1: The island, bumpers and clouds in the match

The match's world moves onto its slots: the island as a whole model, and the bumpers and clouds through instancing.

**Files:**
- Create: `apps/client/test/surroundings.test.tsx`
- Modify:
  - `apps/client/src/assets/slotFiles.ts`, `src/assets/slots.tsx`, `src/assets/models.ts`;
  - `src/app/theme.ts`, `src/scene/Surroundings.tsx`;
  - `apps/client/test/slots.test.tsx`, `test/models.test.ts`.

**Interfaces:**
- **Consumes:** `useSlotMesh` (plan 2); `Slot`, `ModelOptions`, `prepareModel` (plan 1); `TILE_THICKNESS` (plan 2).
- **Produces:**
  - slot names `bumper`, `cloud`, `podium`, `prop.die`, `prop.cards`, `prop.spinner`, `prop.hourglass`, `prop.chips`;
  - `MESH_SLOTS` with `bumper` and `cloud`;
  - `ModelOptions.receiveShadow?: boolean`;
  - `bumperGeometry()` (a post on its base), `cloudGeometry()` (three puffs on their base);
  - in `Surroundings`: the instanced meshes `bumpers` and `clouds`, and the group `island`.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/slots.test.tsx`, in "casts shadows only when asked", add:

```tsx
    const floor = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    prepareModel(floor, { receiveShadow: true });
    expect(floor.receiveShadow).toBe(true);
    expect(flat.receiveShadow).toBe(false);
```

and rename it "casts and receives shadows only when asked".

In `apps/client/test/models.test.ts`, add `bumperGeometry` and `cloudGeometry` to the import, and:

```ts
  it('stands the bumper and cloud stand-ins on their base (spec #5 §4.3)', () => {
    for (const g of [bumperGeometry(), cloudGeometry()]) {
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeCloseTo(0, 5);
    }
  });
```

Create `apps/client/test/surroundings.test.tsx`:

```tsx
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Box3, Color, Matrix4, Vector3, type InstancedMesh, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WORLD_COLORS } from '../src/app/theme';
import { TILE_THICKNESS } from '../src/scene/layout';
import { Surroundings } from '../src/scene/Surroundings';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// The moment the bumper model replaces the stand-in: useSlotMesh hands the world a new mesh.
const swap = vi.hoisted(() => ({ on: false }));
vi.mock('../src/assets/slotMesh', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/assets/slotMesh')>();
  const { CylinderGeometry, MeshStandardMaterial } = await import('three');
  const geometry = new CylinderGeometry(0.2, 0.25, 0.45, 12).translate(0, 0.225, 0);
  geometry.name = 'bumper-model';
  const model = { geometry, material: new MeshStandardMaterial({ name: 'Tint' }) };
  return {
    ...real,
    useSlotMesh: (...args: Parameters<typeof real.useSlotMesh>) => {
      const stand = real.useSlotMesh(...args);
      return swap.on && args[0] === 'bumper' ? model : stand;
    },
  };
});

async function renderWorld(clouds = 8) {
  const renderer = await ReactThreeTestRenderer.create(<Surroundings shadows clouds={clouds} clearcoat />);
  return { renderer, root: renderer.scene.instance as Object3D };
}

const positionOf = (mesh: InstancedMesh, i: number) => {
  const at = new Matrix4();
  mesh.getMatrixAt(i, at);
  return new Vector3().setFromMatrixPosition(at);
};
const colourOf = (mesh: InstancedMesh, i: number) => {
  const colour = new Color();
  mesh.getColorAt(i, colour);
  return colour.getHexString();
};
const hex = (colour: string) => new Color(colour).getHexString();

describe('the world round the board (spec #5 §4.3)', () => {
  it('sets the island under the tiles, its top where their bases stand', async () => {
    const island = (await renderWorld()).root.getObjectByName('island')!;
    expect(island.position.y).toBeCloseTo(-TILE_THICKNESS, 5);
    expect(new Box3().setFromObject(island).max.y).toBeCloseTo(-TILE_THICKNESS, 3);
  });

  it('rings the slab with bumpers standing on it, alternating pink and cream', async () => {
    const bumpers = (await renderWorld()).root.getObjectByName('bumpers') as InstancedMesh;
    expect(bumpers.count).toBe(36);
    expect(positionOf(bumpers, 0).y).toBeCloseTo(-TILE_THICKNESS, 5);
    expect([colourOf(bumpers, 0), colourOf(bumpers, 1)]).toEqual([hex('#ff5470'), hex('#fff7ec')]);
    expect(WORLD_COLORS.bumper).toEqual(['#ff5470', '#fff7ec']);
  });

  it('draws one cloud model per cloud, as many as the quality allows', async () => {
    for (const clouds of [8, 4]) {
      const mesh = (await renderWorld(clouds)).root.getObjectByName('clouds') as InstancedMesh;
      expect(mesh.count).toBe(clouds);
    }
  });

  it('places and paints the bumpers again when their model arrives (spec #5 §6)', async () => {
    const { renderer } = await renderWorld();
    swap.on = true;
    try {
      await renderer.update(<Surroundings shadows clouds={8} clearcoat />);
      const bumpers = (renderer.scene.instance as Object3D).getObjectByName('bumpers') as InstancedMesh;
      expect(bumpers.geometry.name).toBe('bumper-model');
      expect(positionOf(bumpers, 35).y).toBeCloseTo(-TILE_THICKNESS, 5);
      expect(colourOf(bumpers, 35)).toBe(hex(WORLD_COLORS.bumper[1]));
    } finally {
      swap.on = false;
    }
  });
});
```

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/models.test.ts apps/client/test/surroundings.test.tsx`
Expected: FAIL. `receiveShadow` is ignored, the stand-ins don't exist, there's no `island` group or named `bumpers`/`clouds`, and the bumpers are pink and mint.

- [ ] **Step 2: Slots, options, colours, stand-ins.**
- **`assets/slotFiles.ts`:**
  - add to `SlotName`, after `'slide.exit'`: `| 'bumper' | 'cloud' | 'podium' | 'prop.die' | 'prop.cards' | 'prop.spinner' | 'prop.hourglass' | 'prop.chips'` (one per line, as the type is);
  - add `'bumper'` and `'cloud'` to `MESH_SLOTS`.
- **`assets/slots.tsx`:** add to `ModelOptions`:

```tsx
  /** Meshes receive shadows (the island, the podium). */
  receiveShadow?: boolean;
```

  In `prepareModel`, after `node.castShadow = …`, add `node.receiveShadow = options.receiveShadow ?? false;`.
- **`app/theme.ts`:** make `bumper: ['#ff5470', '#fff7ec'],` and its line comment "pink and cream: the spec's red and white (spec #5 §4.3)".
- **`assets/models.ts`:** add `SphereGeometry` to the `three` import, and:

```ts
// The world's stand-ins (spec #5 §4.3), standing on their base like the models.

/** A bumper post round the slab's edge. */
export function bumperGeometry(): BufferGeometry {
  return new CylinderGeometry(0.22, 0.26, 0.4, 14).translate(0, 0.2, 0);
}

/** A cloud: three puffs merged, resting on its base. */
export function cloudGeometry(): BufferGeometry {
  const puffs: Array<[number, number, number]> = [
    [-0.9, 0, 1],
    [0, 0.35, 1.3],
    [0.9, -0.05, 0.95],
  ];
  // The lowest points are the outer puffs' bottoms, at -1.0: lift them to the base.
  return merge(puffs.map(([x, y, r]) => new SphereGeometry(r, 14, 10).translate(x, y, 0))).translate(0, 1, 0);
}
```

- [ ] **Step 3: The match's world.** In `scene/Surroundings.tsx`:
- **Imports:**
  - add `MeshLambertMaterial` and `MeshStandardMaterial` to `three`;
  - import `bumperGeometry` and `cloudGeometry` with `crownGeometry`;
  - import `useSlotMesh` from `../assets/slotMesh`;
  - import `TILE_THICKNESS` with the layout names.
- **Constants:**
  - make each bumper spot's y `-TILE_THICKNESS` (the bumper stands on the slab, its base at the tiles' bases), in place of `-0.02`;
  - delete `PUFFS` and its comment.
- **Hooks:** after `crown`, add:

```tsx
  const bumper = useSlotMesh('bumper', () => ({ geometry: bumperGeometry(), material: new MeshStandardMaterial({ roughness: 0.45 }) }), { clearcoat });
  const cloud = useSlotMesh('cloud', () => ({ geometry: cloudGeometry(), material: new MeshLambertMaterial({ color: WORLD_COLORS.cloud }) }), { clearcoat });
```

- **The bumpers' `useLayoutEffect`:** make its dependencies `[bumper]`, with the comment "Placed and painted again when the model replaces the stand-in."
- **The clouds:** rename `puffsRef` to `cloudMeshRef`, and replace its `useLayoutEffect` with:

```tsx
  // One cloud model per cloud; Low quality shows fewer.
  useLayoutEffect(() => {
    const mesh = cloudMeshRef.current;
    if (!mesh) return;
    const at = new Object3D();
    const shown = CLOUDS.slice(0, clouds);
    shown.forEach(([x, y, z], c) => {
      at.position.set(x, y, z);
      at.scale.setScalar(1 + (c % 3) * 0.15);
      at.updateMatrix();
      mesh.setMatrixAt(c, at.matrix);
    });
    mesh.count = shown.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [clouds, cloud]);
```

- **In the JSX:**
  - wrap the island `Slot` in `<group name="island" position-y={-TILE_THICKNESS}>`;
  - give the `Slot` `clearcoat={clearcoat} receiveShadow`, and its fallback mesh `position-y={-1.2}` (the 2.4-tall stand-in's top at the group's 0);
  - replace the bumpers' `<instancedMesh>` (and its geometry and material children) with `<instancedMesh ref={bumpersRef} name="bumpers" args={[bumper.geometry, bumper.material, BUMPERS.length]} />`;
  - inside the clouds `<group>`, replace the puffs' `<instancedMesh>` with `<instancedMesh ref={cloudMeshRef} name="clouds" args={[cloud.geometry, cloud.material, CLOUDS.length]} />`.
- **The component's comment** becomes "Sky, fog, light, the island with its bumpers, the clouds, the props and the crown on tile 100 (spec #2 §6.1, spec #5 §4.3)."

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/models.test.ts apps/client/test/surroundings.test.tsx apps/client/test/scene.test.tsx`
Expected: PASS; the scene budgets hold (one cloud stand-in per cloud is three puffs, as before).

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`, and a match against bots.
- The island and clouds look as before.
- The bumpers alternate pink and cream.
- Nothing floats or sinks at the board's edge.

- [ ] **Step 5: Commit.** `git add -A apps/client && git commit -m "feat(client): the island, bumpers and clouds draw their slots"` (with the trailer).

### Task 2: The props round the island

Five slots for the oversized toys, placed round the back and sides, bobbing slowly. They have no stand-in, so nothing shows until their models land (Task 7).

**Files:**
- Modify: `apps/client/src/scene/Surroundings.tsx`, `apps/client/test/surroundings.test.tsx`

**Interfaces:**
- **Consumes:** the `prop.*` slot names (Task 1), `Slot` (plan 1).
- **Produces:** `PROPS: ReadonlyArray<{ slot: SlotName; at: Vec3; turn: number }>`, exported from `Surroundings.tsx`.

- [ ] **Step 1: Write the failing test.** In `apps/client/test/surroundings.test.tsx`, import `PROPS` with `Surroundings`, and add:

```tsx
  it("keeps the props off the board and out of the overview camera's way", () => {
    expect(PROPS.map((p) => p.slot)).toEqual(['prop.die', 'prop.cards', 'prop.spinner', 'prop.hourglass', 'prop.chips']);
    for (const { at } of PROPS) {
      const [x, , z] = at;
      expect(Math.hypot(x, z)).toBeGreaterThan(14); // past the island's edge (12.5) and the board's corners (11.3)
      expect(z).toBeLessThan(6); // never between the overview camera (z 26) and the board
    }
  });
```

Run: `pnpm vitest run apps/client/test/surroundings.test.tsx`
Expected: FAIL. `PROPS` isn't exported.

- [ ] **Step 2: The props.** In `scene/Surroundings.tsx`:
- import `type SlotName` with `Slot`;
- after `CLOUDS`, add:

```tsx
/**
 * The oversized toys on their floating rocks (spec #5 §4.3): round the island's back and sides, off
 * the board and out of the overview camera's way. They bob and turn slowly.
 */
export const PROPS: ReadonlyArray<{ slot: SlotName; at: Vec3; turn: number }> = [
  { slot: 'prop.die', at: [-17, -1, -4], turn: 0.6 },
  { slot: 'prop.cards', at: [-11, 0.5, -14], turn: -0.3 },
  { slot: 'prop.spinner', at: [1, 1, -19], turn: 0.2 },
  { slot: 'prop.hourglass', at: [12, 0, -14], turn: -0.5 },
  { slot: 'prop.chips', at: [17.5, -1.5, -3], turn: 0.9 },
];
```

- add `const propsRef = useRef<Group>(null);` with the other refs;
- in `useFrame`, change the parameters to `({ clock }, delta)`, and add:

```tsx
    propsRef.current?.children.forEach((prop, i) => {
      const { at, turn } = PROPS[i]!;
      prop.position.y = at[1] + Math.sin(clock.elapsedTime * 0.5 + i * 1.3) * 0.3;
      prop.rotation.y = turn + clock.elapsedTime * 0.08;
    });
```

- in the JSX, after the clouds' group, add:

```tsx
      {/* No stand-in: a prop that doesn't load leaves the sky clear. */}
      <group ref={propsRef}>
        {PROPS.map(({ slot, at, turn }) => (
          <group key={slot} position={at} rotation-y={turn}>
            <Slot name={slot} clearcoat={clearcoat} fallback={null} />
          </group>
        ))}
      </group>
```

- [ ] **Step 3: Run the tests.**

Run: `pnpm vitest run apps/client/test/surroundings.test.tsx apps/client/test/scene.test.tsx`
Expected: PASS; the scene draws no prop in unit tests, so its budget is unchanged.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 4: Commit.** `git commit -am "feat(client): five prop slots round the island"` (with the trailer).

### Task 3: The menu's podium and clouds

**Files:**
- Modify: `apps/client/src/scene/MenuScene.tsx`, `apps/client/test/menuScene.test.tsx`

**Interfaces:**
- **Consumes:**
  - `Slot` with `receiveShadow` (Task 1);
  - `useSlotMesh` (plan 2) and `cloudGeometry` (Task 1);
  - `TOP_Y` (0.55) in `MenuScene.tsx`.
- **Produces:**
  - the group `menu-podium` at y = −0.2, holding the `podium` slot;
  - the instanced mesh `menu-clouds`, one cloud per cloud.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/menuScene.test.tsx`, add:

```tsx
  it('stands the podium on its base, its top where the piece stands (spec #5 §4.3)', async () => {
    const { root } = await renderMenu('knight', 'high', true);
    const podium = root.getObjectByName('menu-podium')!;
    const turntable = root.getObjectByName('menu-turntable')!;
    // 0.75: the podium model's height to its top (art/contract.ts checks the model keeps it).
    expect(podium.position.y + 0.75).toBeCloseTo(turntable.position.y, 5);
  });

  it.each([
    ['high', 8],
    ['low', 4],
  ] as const)('draws one cloud model per cloud on %s', async (level, clouds) => {
    const { root } = await renderMenu('knight', level);
    expect((root.getObjectByName('menu-clouds') as InstancedMesh).count).toBe(clouds);
  });
```

Run: `pnpm vitest run apps/client/test/menuScene.test.tsx`
Expected: FAIL. There's no `menu-podium` group, and no `menu-clouds`.

- [ ] **Step 2: The podium on its slot.** In `scene/MenuScene.tsx`:
- import `cloudGeometry` with `tileGeometry` from `../assets/models`;
- after `TOP_Y`, add:

```tsx
/** The podium stands on its base this far down; the model is 0.75 to its top, so its top is TOP_Y (spec #5 §4.3). */
const PODIUM_BASE = -0.2;
```

- add, above `MenuContent`:

```tsx
/** The code-built podium (spec #2 §7.4 podium tokens), standing on its base like the model. */
function PodiumStandIn({ shadows }: { shadows: boolean }) {
  return (
    <>
      <mesh position-y={0.58} receiveShadow castShadow={shadows}>
        <cylinderGeometry args={[1.35, 1.42, 0.34, 48]} />
        <meshStandardMaterial color={PODIUM_COLORS.top} roughness={0.5} />
      </mesh>
      <mesh position-y={0.4}>
        <cylinderGeometry args={[1.46, 1.46, 0.12, 48]} />
        <meshStandardMaterial color={PODIUM_COLORS.band} metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position-y={0.18} castShadow={shadows}>
        <cylinderGeometry args={[1.5, 1.15, 0.36, 48]} />
        <meshStandardMaterial color={PODIUM_COLORS.base} roughness={0.45} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={TOP_Y - PODIUM_BASE + 0.005}>
        <torusGeometry args={[1.18, 0.045, 10, 64]} />
        <meshStandardMaterial color={PODIUM_COLORS.ring} emissive={PODIUM_COLORS.ring} emissiveIntensity={0.7} />
      </mesh>
    </>
  );
}
```

- in the JSX, replace the four podium meshes (top, band, base and the ring torus) with:

```tsx
        <group name="menu-podium" position-y={PODIUM_BASE}>
          <Slot name="podium" clearcoat={profile.clearcoat} shadows={profile.shadows} receiveShadow fallback={<PodiumStandIn shadows={profile.shadows} />} />
        </group>
```

The floating rock (the cone and the chunk) and the soft shadow disc stay as they are.

- [ ] **Step 3: One cloud model per cloud.**
- Replace `PUFFS` with:

```tsx
/** Clouds below and behind the podium, one cloud model each. */
const MENU_CLOUDS = Array.from({ length: 8 }, (_, i) => ({ x: -9 + i * 2.6, y: -4.2 + (i % 3) * 0.6, z: -6 - (i % 2) * 3, s: 1.1 + ((i * 5) % 4) * 0.12 }));
```

- After `tile`, add:

```tsx
  const cloud = useSlotMesh(
    'cloud',
    () => ({ geometry: cloudGeometry(), material: new MeshStandardMaterial({ color: WORLD_COLORS.cloud, roughness: 1, emissive: WORLD_COLORS.cloud, emissiveIntensity: 0.22 }) }),
    { clearcoat: profile.clearcoat },
  );
```

- In the `useLayoutEffect` that fills the puffs, rename `puffs` to `clouds`, and set them from `MENU_CLOUDS`:

```tsx
    const clouds = cloudsRef.current;
    if (!clouds) return;
    const shown = MENU_CLOUDS.slice(0, profile.clouds);
    shown.forEach((c, i) => {
      place.position.set(c.x, c.y, c.z);
      place.rotation.set(0, 0, 0);
      place.scale.set(c.s * 1.2, c.s, c.s);
      place.updateMatrix();
      clouds.setMatrixAt(i, place.matrix);
    });
    clouds.count = shown.length;
    clouds.instanceMatrix.needsUpdate = true;
```

  Make its dependencies `[place, profile.clouds, tile, cloud]`, and rename `puffsRef` to `cloudsRef`.
- Replace the puffs' `<instancedMesh>` (and its sphere and material children) with `<instancedMesh ref={cloudsRef} name="menu-clouds" args={[cloud.geometry, cloud.material, MENU_CLOUDS.length]} />`.

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run apps/client/test/menuScene.test.tsx`
Expected: PASS, including the menu's budget on High and Low.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`.
- The menu's podium looks as before, and the piece stands on it.
- The clouds sit below and behind.
- The arrows and the name plate still track the podium.
- Check a landscape phone size (844 × 390) too.

- [ ] **Step 5: Commit.** `git commit -am "feat(client): the menu podium and clouds draw their slots"` (with the trailer).

### Task 4: The world models' contract and helpers

**Files:**
- Modify: `art/contract.ts`, `art/test/contract.test.ts`, `art/lib/palette.py`, `art/lib/shapes.py`

**Interfaces:**
- **Consumes:** `ModelRule`, `MODELS`, `contractProblems` (plans 1–2).
- **Produces:**
  - `ModelRule.origin` gains `'top'`;
  - `ModelRule.offCentre?: number`;
  - the check `topAt(height)`;
  - rules `island`, `bumper`, `cloud`, `podium`, `prop_die`, `prop_cards`, `prop_spinner`, `prop_hourglass`, `prop_chips`;
  - `palette.ISLAND_ROCK`, `ISLAND_SAND`, `PODIUM_BAND`, `PODIUM_BASE`;
  - `shapes.rock(name, radius, depth, side, top=None, location, seed, subdivisions)`, `shapes.lump(name, radius, material, location, seed, floor)`, `shapes.place(parts, location, rotation)`;
  - parts with several materials.

- [ ] **Step 1: Write the failing tests.** In `art/test/contract.test.ts`, add:

```ts
  it("keeps the island's top at its origin, where the tiles stand", () => {
    const island = (top: number): GlbSummary => ({
      min: [-12.5, top - 6.4, -12.6],
      max: [12.4, top, 12.3],
      triangles: 1800,
      materials: ['Slab', 'Rock', 'Sand'],
      byMaterial: {},
      transformedNodes: [],
    });
    expect(contractProblems('island', island(0))).toEqual([]);
    expect(contractProblems('island', island(0.45))).toEqual(['its top is at y = 0.450, not 0']);
  });

  it("checks the podium's top is where the menu stands the piece", () => {
    const podium = (top: number): GlbSummary => ({
      min: [-1.5, 0, -1.5],
      max: [1.5, 0.78, 1.5],
      triangles: 1900,
      materials: ['Top', 'Band', 'Base', 'Glow'],
      byMaterial: { Top: { min: [-1.42, 0.41, -1.42], max: [1.42, top, 1.42] } },
      transformedNodes: [],
    });
    expect(contractProblems('podium', podium(0.75))).toEqual([]);
    expect(contractProblems('podium', podium(0.7))).toEqual(['its top is at 0.70, not 0.75 (the menu stands the piece there)']);
  });

  it('lets a prop on its jagged rock sit a little off centre', () => {
    const prop: GlbSummary = { min: [-1.2, 0, -1.4], max: [1.4, 3.1, 1.2], triangles: 1600, materials: ['Frame', 'Glass', 'Rock'], byMaterial: {}, transformedNodes: [] };
    expect(contractProblems('prop_hourglass', prop)).toEqual([]);
  });
```

Run: `pnpm vitest run art/test/contract.test.ts`
Expected: FAIL. `island`, `podium` and `prop_hourglass` have no rule.

- [ ] **Step 2: The rules.** In `art/contract.ts`:
- in `ModelRule`:
  - make `origin: 'base' | 'centre' | 'top';` with the comment "Where the origin sits: the base centre, the middle (the die tumbles round it), or the top (the island, where the tiles stand).";
  - add:

```ts
  /** How far the footprint's middle may sit from the origin (default 0.08): jagged rocks and tipped props need more. */
  offCentre?: number;
```

- after `arrowForward`, add:

```ts
/** The menu stands its piece on the podium's top, this high above the podium's base. */
function topAt(height: number) {
  return (model: GlbSummary): string | null => {
    const top = model.byMaterial.Top;
    if (!top) return null; // requiredMaterials reports a missing Top
    return Math.abs(top.max[1]! - height) <= 0.01 ? null : `its top is at ${top.max[1]!.toFixed(2)}, not ${height} (the menu stands the piece there)`;
  };
}

const prop = (slot: SlotName): ModelRule => ({ slot, origin: 'base', height: [1.2, 5], maxWidth: 4, maxTriangles: 3000, maxMaterials: 3, requiredMaterials: ['Rock'], offCentre: 0.5 });
```

- add to `MODELS`, after `exit`:

```ts
  // The world (spec #5 §4.3).
  island: { slot: 'island', origin: 'top', height: [3, 9], maxWidth: 28, maxTriangles: 8000, maxMaterials: 3, requiredMaterials: ['Slab'], offCentre: 0.8 },
  bumper: { slot: 'bumper', origin: 'base', height: [0.35, 0.55], maxWidth: 0.6, maxTriangles: 200, maxMaterials: 1, requiredMaterials: ['Tint'] },
  cloud: { slot: 'cloud', origin: 'base', height: [1, 2.5], maxWidth: 4.5, maxTriangles: 300, maxMaterials: 1, requiredMaterials: [], offCentre: 0.3 },
  podium: { slot: 'podium', origin: 'base', height: [0.74, 0.82], maxWidth: 3.1, maxTriangles: 3000, maxMaterials: 4, requiredMaterials: ['Top'], checks: [topAt(0.75)] },
  prop_die: prop('prop.die'),
  prop_cards: prop('prop.cards'),
  prop_spinner: prop('prop.spinner'),
  prop_hourglass: prop('prop.hourglass'),
  prop_chips: prop('prop.chips'),
```

- in `contractProblems`:
  - after the `centre` line, add ``if (rule.origin === 'top' && Math.abs(y1) > LEVEL) problems.push(`its top is at y = ${y1.toFixed(3)}, not 0`);``;
  - in the off-centre check, compare against `rule.offCentre ?? CENTRED` in place of `CENTRED`.

Run: `pnpm vitest run art/test`
Expected: PASS.

- [ ] **Step 3: The Blender helpers.** In `art/lib/palette.py`, add:

```python
ISLAND_ROCK = '#0f5d63'  # the candy rocks' sides
ISLAND_SAND = '#ffb070'  # the island rock's top
PODIUM_BAND = '#ff9a3d'
PODIUM_BASE = '#147676'
```

In `art/lib/shapes.py`:
- add `import random`, and change the `mathutils` import to `from mathutils import Euler, Matrix, Vector`;
- let a part carry several materials. Replace `_object` with:

```python
def _object(name, bm, materials, smooth=True):
    """A mesh object from a bmesh, with one material or a list (faces pick theirs by material_index)."""
    for face in bm.faces:
        face.smooth = smooth
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for material in materials if isinstance(materials, (list, tuple)) else [materials]:
        mesh.materials.append(material)
    return bpy.data.objects.new(name, mesh)
```

- add at the end:

```python
def rock(name, radius, depth, side, top=None, location=(0.0, 0.0, 0.0), seed=1, subdivisions=2):
    """A low-poly floating rock, flat-shaded: a flat top at its origin and a jagged underside tapering to
    a point exactly `depth` below, so a model can stand on that point. With `top`, the faces on top take
    that material and the rest `side`: a candy rock's two colours."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        spread = radius * (1.0 + rng.uniform(-0.08, 0.08))
        if z >= 0.0:
            v.co = (x * spread, y * spread, 0.0)
        else:
            down = -z
            narrow = 1.0 - 0.45 * down
            sag = 1.0 if down > 0.999 else 1.0 + rng.uniform(-0.1, 0.1)
            v.co = (x * spread * narrow, y * spread * narrow, -depth * down ** 1.3 * sag)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    if top is not None:
        for face in bm.faces:
            face.material_index = 1 if face.calc_center_median().z > -1e-4 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = _object(name, bm, [side] if top is None else [side, top], smooth=False)
    obj.location = location
    return obj


def lump(name, radius, material, location=(0.0, 0.0, 0.0), seed=1, floor=0.0):
    """A chunky low-poly lump for a cloud: flat-shaded, a little uneven, and cut flat at z = floor."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
    centre = Vector(location)
    for v in bm.verts:
        p = v.co * (1.0 + rng.uniform(-0.1, 0.1)) + centre
        v.co = (p.x, p.y, max(p.z, floor))
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth=False)


def place(parts, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0)):
    """Turn, then move, a group of parts together as one: a die tipped on its rock."""
    turn = Matrix.Translation(location) @ Euler(rotation).to_matrix().to_4x4()
    for part in parts:
        part.matrix_basis = turn @ part.matrix_basis
    return parts
```

Then check through the link: rebuild `['pawn', 'tile']` with plan 1's build snippet. Expected: the same reports as before, and `untouched: True`.

- [ ] **Step 4: Run the tests.** `pnpm vitest run art/test`, `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green, and `git status` shows no changed `.glb`.

- [ ] **Step 5: Commit.** `git add -A art && git commit -m "test(art): the world models' contract, and helpers for rocks, lumps and tipped parts"` (with the trailer).

### Task 5: The island, the bumper and the cloud

**Files:**
- Create: `art/models/island.py`, `art/models/bumper.py`, `art/models/cloud.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** `shapes.rock`, `shapes.lump` and the palette (Task 4); the rules (Task 4); the slots (Task 1).
- **Produces:** `island.glb`, `bumper.glb`, `cloud.glb`, listed for `island`, `bumper` and `cloud`.

- [ ] **Step 1: List them (the failing test).** Add `island: 'island',`, `bumper: 'bumper',` and `cloud: 'cloud',` to `SLOT_FILES`.

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "island is listed in slotFiles.ts but island.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/island.py`:

```python
"""The island under the board (spec #5 §4.3): the mockup's cream satin slab on a low-poly, flat-shaded
candy rock. Its origin is the slab's top, where the tiles stand; the game puts it at y = -0.22."""
from lib import finish, palette, shapes

SLAB = 19.2      # the board is 16 across, and the bumpers stand 8.6 out from the middle
THICKNESS = 0.45


def build():
    slab = finish.satin('Slab', palette.CREAM)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    sand = finish.satin('Sand', palette.ISLAND_SAND)
    return [
        shapes.rounded_box('slab', (SLAB, SLAB, THICKNESS), 0.2, slab, location=(0.0, 0.0, -THICKNESS / 2), segments=3),
        # Wider than the slab, so a ring of sand shows round it.
        shapes.rock('rock', 12.0, 6.0, rock, sand, location=(0.0, 0.0, -THICKNESS + 0.02), seed=5, subdivisions=3),
    ]
```

Create `art/models/bumper.py`:

```python
"""A bumper post (spec #5 §4.3): a rounded post round the slab's edge. Its one material is Tint, so the
game alternates its colours."""
from lib import finish, palette, shapes

POST = [(0, 0), (0.26, 0), (0.27, 0.03), (0.25, 0.06), (0.21, 0.08), (0.21, 0.3), (0.19, 0.38), (0.13, 0.43), (0, 0.45)]


def build():
    tint = finish.satin('Tint', palette.WHITE)
    return [shapes.revolve('post', POST, tint, segments=12)]
```

Create `art/models/cloud.py`:

```python
"""A cloud (spec #5 §4.3): three chunky low-poly lumps in cream on a flat base, drawn once per cloud."""
from lib import finish, palette, shapes

LUMPS = [(-0.9, 0.55, 1.0), (0.0, 0.75, 1.3), (0.95, 0.5, 0.95)]  # (across, height of the middle, radius)


def build():
    cloud = finish.satin('Cloud', palette.CREAM)
    return [shapes.lump(f'lump{i}', r, cloud, location=(x, 0.0, z), seed=i + 1) for i, (x, z, r) in enumerate(LUMPS)]
```

- [ ] **Step 3: Build them through the link** (`'ART_IDS': ['island', 'bumper', 'cloud']`).

Expected:
- island: 1,500–3,000 triangles, `['Slab', 'Rock', 'Sand']`, 6–7 tall;
- bumper: 150–200 triangles, `['Tint']`, 0.45 tall;
- cloud: about 240 triangles, `['Cloud']`, about 2.1 tall;
- `untouched: True`.

If the bumper passes 200 triangles, drop its `segments` to 10.

- [ ] **Step 4: Look at them.** Preview `['island']`, then `['bumper', 'cloud', 'pawn']`, and Read both PNGs. Check that:
- the slab sits on the rock;
- the sand ring shows round the slab;
- the rock's underside is jagged and flat-shaded, coming to a point;
- the cloud is three lumps on a flat base.

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`. Expected: PASS, with the budget holding. Ledger the budget test's totals.

Then the browser: in a match against bots, check that:
- the board sits on the cream slab with no gap or overlap at its edge;
- the bumpers stand on the slab;
- the clouds drift;
- the console has no "asset slot" warning.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the island, the bumper and the cloud"` (with the trailer).

### Task 6: The podium

**Files:**
- Create: `art/models/podium.py`, `apps/client/public/models/podium.glb`
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** the palette (Task 4); the `podium` rule with `topAt(0.75)` (Task 4); the slot (Task 3).
- **Produces:** `podium.glb`, listed for `podium`.

- [ ] **Step 1: List it (the failing test).** Add `podium: 'podium',` to `SLOT_FILES`.

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "podium is listed in slotFiles.ts but podium.glb isn't built".

- [ ] **Step 2: Write the model.** Create `art/models/podium.py`:

```python
"""The menu podium (spec #5 §4.3): a cream top on an orange band and a teal base, with a glowing pink
ring set into the top. Its origin is the base's bottom; the menu stands the piece on the top, 0.75 up."""
from lib import finish, palette, shapes

BASE = [(0, 0), (1.15, 0), (1.5, 0.34), (1.48, 0.36), (0, 0.36)]
BAND = [(0, 0.34), (1.46, 0.34), (1.47, 0.4), (1.46, 0.46), (0, 0.46)]
TOP = [(0, 0.41), (1.42, 0.41), (1.38, 0.72), (1.35, 0.75), (0, 0.75)]
RING = [(1.13, 0.73), (1.18, 0.71), (1.23, 0.73), (1.225, 0.76), (1.18, 0.78), (1.135, 0.76)]  # a loop, set into the top


def build():
    top = finish.satin('Top', palette.PODIUM_TOP)
    band = finish.glossy('Band', palette.PODIUM_BAND)
    base = finish.satin('Base', palette.PODIUM_BASE)
    ring = finish.glow('Glow', palette.PINK, 1.2)
    return [
        shapes.revolve('base', BASE, base, segments=56),
        shapes.revolve('band', BAND, band, segments=56),
        shapes.revolve('top', TOP, top, segments=56),
        shapes.revolve('ring', RING, ring, segments=56),
    ]
```

- [ ] **Step 3: Build it through the link** (`'ART_IDS': ['podium']`).

Expected: about 1,600–2,400 triangles, `['Base', 'Band', 'Top', 'Glow']`, 0.78 tall, `untouched: True`.

- [ ] **Step 4: Look at it.** Preview `['podium', 'knight']` and Read the PNG. Check that:
- the band shows between top and base;
- the ring sits in the top's rim, glowing;
- the knight is about the size it stands at in the menu, for scale.

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`. Expected: PASS, including the podium's top check (Review Focus 2).

Then the browser: `pnpm dev`. Cycle the menu through the seven pieces: each stands on the Blender podium's top, neither floating nor sunk. Check a landscape phone size too.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the menu podium"` (with the trailer).

### Task 7: The five props

**Files:**
- Create: `art/models/prop_die.py`, `prop_cards.py`, `prop_spinner.py`, `prop_hourglass.py`, `prop_chips.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`; `apps/client/src/scene/Surroundings.tsx` (only if the shots call for new places)

**Interfaces:**
- **Consumes:**
  - `shapes.rock`, `shapes.place` (Task 4), the top-view `shapes.outline` (plan 2);
  - `models.die`'s `FACES` and `PIPS` (plan 1);
  - the prop rules (Task 4) and slots (Task 2).
- **Produces:** five `.glb` files, listed for `prop.die`, `prop.cards`, `prop.spinner`, `prop.hourglass` and `prop.chips`.

- [ ] **Step 1: List them (the failing test).** Add to `SLOT_FILES`:

```ts
  'prop.die': 'prop_die',
  'prop.cards': 'prop_cards',
  'prop.spinner': 'prop_spinner',
  'prop.hourglass': 'prop_hourglass',
  'prop.chips': 'prop_chips',
```

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "prop.die is listed in slotFiles.ts but prop_die.glb isn't built".

- [ ] **Step 2: Write the models.** Each stands on its rock's lowest point (the origin) with the rock's flat top `ROCK_DEPTH` up.

Create `art/models/prop_die.py`:

```python
"""A giant die (spec #5 §4.3), tipped on an edge into its small floating candy rock."""
from lib import finish, palette, shapes
from models.die import FACES, PIPS

SIZE = 1.3
SPACING = 0.34
ROCK_DEPTH = 1.3


def build():
    body = finish.glossy('Body', palette.CREAM)
    pip = finish.glossy('Pip', palette.INK)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    die = [shapes.rounded_box('die', (SIZE, SIZE, SIZE), 0.18, body, segments=3)]
    for value, (normal, across, up) in FACES.items():
        for i, (a, b) in enumerate(PIPS[value]):
            centre = tuple(normal[k] * (SIZE / 2 - 0.02) + across[k] * a * SPACING + up[k] * b * SPACING for k in range(3))
            flat = tuple(1 - abs(normal[k]) * 0.7 for k in range(3))  # pressed flat into the face
            die.append(shapes.sphere(f'pip{value}{i}', 0.11, pip, location=centre, scale=flat, segments=8, rings=4))
    shapes.place(die, location=(0.0, 0.0, ROCK_DEPTH + 0.62), rotation=(0.6, 0.0, 0.45))
    return [shapes.rock('rock', 1.2, ROCK_DEPTH, rock, location=(0.0, 0.0, ROCK_DEPTH), seed=11), *die]
```

Create `art/models/prop_cards.py`:

```python
"""A fanned stack of giant playing cards (spec #5 §4.3), a pink heart on the top one, on a floating
candy rock."""
from lib import finish, palette, shapes

ROCK_DEPTH = 1.2
CARD = (1.05, 1.5, 0.05)
FAN = 0.22  # the turn between cards
HEART = [('M', 0, -0.28), ('Q', -0.34, 0.02, -0.2, 0.2), ('Q', -0.08, 0.32, 0, 0.16), ('Q', 0.08, 0.32, 0.2, 0.2), ('Q', 0.34, 0.02, 0, -0.28)]


def build():
    card = finish.glossy('Card', palette.CREAM)
    mark = finish.glossy('Mark', palette.PINK)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    parts = [shapes.rock('rock', 1.25, ROCK_DEPTH, rock, location=(0.0, 0.0, ROCK_DEPTH), seed=12)]
    for i in range(5):
        lift = ROCK_DEPTH + CARD[2] / 2 + i * 0.06
        parts.append(shapes.rounded_box(f'card{i}', CARD, 0.02, card, location=(0.0, 0.0, lift), rotation=(0.0, 0.0, (i - 2) * FAN), segments=2))
    top = ROCK_DEPTH + CARD[2] + 4 * 0.06
    heart = shapes.outline('heart', HEART, 0.03, mark, bevel=0.008, view='top', resolution=6, lift=top)
    shapes.place([heart], rotation=(0.0, 0.0, 2 * FAN))  # turned with the top card
    return [*parts, heart]
```

Create `art/models/prop_spinner.py`:

```python
"""A board-game spinner (spec #5 §4.3): a tangerine dial with dark dividers and a dark pointer on a
hub, lying on a floating candy rock."""
import math

from lib import finish, palette, shapes

ROCK_DEPTH = 1.2
DIAL = [(0, 0), (1.0, 0), (1.04, 0.04), (1.0, 0.1), (0, 0.1)]
HUB = [(0, 0), (0.12, 0), (0.12, 0.12), (0.08, 0.16), (0, 0.16)]
POINTER = [('M', 0, 0.85), ('L', 0.12, 0.55), ('L', 0.05, 0.55), ('L', 0.05, -0.3), ('L', -0.05, -0.3), ('L', -0.05, 0.55), ('L', -0.12, 0.55), ('L', 0, 0.85)]


def build():
    dial = finish.glossy('Dial', palette.TANGERINE)
    ink = finish.glossy('Ink', palette.INK)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    base = ROCK_DEPTH + 0.02
    parts = [
        shapes.rock('rock', 1.3, ROCK_DEPTH, rock, location=(0.0, 0.0, ROCK_DEPTH), seed=13),
        shapes.revolve('dial', [(r, h + base) for r, h in DIAL], dial, segments=40),
        shapes.revolve('hub', [(r, h + base + 0.1) for r, h in HUB], ink, segments=16),
    ]
    for i in range(6):
        a = i * math.tau / 6
        # Each divider runs out from the hub along its own turn.
        parts.append(shapes.rounded_box(f'divider{i}', (0.05, 0.9, 0.03), 0.01, ink, location=(-0.5 * math.sin(a), 0.5 * math.cos(a), base + 0.115), rotation=(0.0, 0.0, a), segments=1))
    pointer = shapes.outline('pointer', POINTER, 0.04, ink, bevel=0.01, view='top', resolution=1, lift=base + 0.16)
    shapes.place([pointer], rotation=(0.0, 0.0, 0.7))
    return [*parts, pointer]
```

Create `art/models/prop_hourglass.py`:

```python
"""A giant toy hourglass (spec #5 §4.3): gold end plates and posts round two cream bulbs, standing on
a floating candy rock and leaning a little."""
import math

from lib import finish, palette, shapes

ROCK_DEPTH = 1.1
PLATE = [(0, 0), (0.62, 0), (0.64, 0.04), (0.62, 0.12), (0, 0.12)]
GLASS = [(0, 0.12), (0.45, 0.14), (0.52, 0.35), (0.42, 0.62), (0.1, 0.9), (0.08, 1.0), (0.1, 1.1), (0.42, 1.38), (0.52, 1.65), (0.45, 1.86), (0, 1.88)]
POST = [(0, 0.12), (0.05, 0.12), (0.05, 1.88), (0, 1.88)]


def build():
    gold = finish.glossy('Frame', palette.GOLD)
    glass = finish.satin('Glass', palette.CREAM)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    hourglass = [
        shapes.revolve('bottom', PLATE, gold, segments=32),
        shapes.revolve('glass', GLASS, glass, segments=32),
        shapes.revolve('top', [(r, h + 1.88) for r, h in PLATE], gold, segments=32),
    ]
    for i in range(3):
        a = i * math.tau / 3 + 0.3
        post = shapes.revolve(f'post{i}', POST, gold, segments=8)
        post.location = (0.55 * math.cos(a), 0.55 * math.sin(a), 0.0)
        hourglass.append(post)
    shapes.place(hourglass, location=(0.0, 0.0, ROCK_DEPTH - 0.05), rotation=(0.12, 0.0, 0.0))
    return [shapes.rock('rock', 1.1, ROCK_DEPTH, rock, location=(0.0, 0.0, ROCK_DEPTH), seed=14), *hourglass]
```

Create `art/models/prop_chips.py`:

```python
"""Two stacks of giant poker chips (spec #5 §4.3), pink and cream, on a floating candy rock."""
from lib import finish, palette, shapes

ROCK_DEPTH = 1.1
CHIP = [(0, 0), (0.42, 0), (0.45, 0.025), (0.45, 0.065), (0.42, 0.09), (0, 0.09)]
STACKS = [((-0.35, 0.1), 6), ((0.45, -0.2), 4)]  # (where, how many chips)


def build():
    pink = finish.glossy('Chip', palette.PINK)
    cream = finish.glossy('Stripe', palette.CREAM)
    rock = finish.satin('Rock', palette.ISLAND_ROCK)
    parts = [shapes.rock('rock', 1.15, ROCK_DEPTH, rock, location=(0.0, 0.0, ROCK_DEPTH), seed=15)]
    for s, ((x, y), count) in enumerate(STACKS):
        for i in range(count):
            chip = shapes.revolve(f'chip{s}{i}', [(r, h + ROCK_DEPTH + i * 0.095) for r, h in CHIP], pink if i % 2 == 0 else cream, segments=20)
            chip.location = (x + 0.02 * ((i * 7) % 3 - 1), y + 0.02 * ((i * 5) % 3 - 1), 0.0)  # stacked a little untidily
            parts.append(chip)
    return parts
```

- [ ] **Step 3: Build them through the link** (`'ART_IDS': ['prop_die', 'prop_cards', 'prop_spinner', 'prop_hourglass', 'prop_chips']`).

Expected:
- five entries, each under 3,000 triangles with three materials (`Rock` last or first);
- heights 1.4–3.5 (the flat spinner and cards are the lowest);
- `untouched: True`.

If one passes 3,000 triangles, lower its pips', chips' or plates' `segments` first, then the rock's `subdivisions` (ledger it).

- [ ] **Step 4: Look at them.** Preview all five and Read the PNG. Check that each reads as its toy at a glance:
- a die, tipped;
- a fan of cards with a heart;
- a spinner;
- an hourglass;
- chip stacks.

Also check that:
- each sits on its rock's flat top, neither floating nor buried (the die and the hourglass sink a little into the rock, on purpose);
- the rocks come to a point below.

- [ ] **Step 5: Run the tests.** `pnpm vitest run art/test`, then `pnpm test`.
Expected: PASS, with all fourteen world and board models keeping their contracts. The budget test holds at about 92 draw calls (Review Focus 5); ledger its rows.

Then `pnpm shots`, and Read `match-overview.png`.
- At least three props show round the frame's edges, none over the board.
- If a prop is hidden by the island or out of frame, move it in `PROPS` (still past 14 out and behind z = 6), and ledger the new places.
- Run the Surroundings test again after any move.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src apps/client/public/models && git commit -m "feat(art): five toy props on floating rocks"` (with the trailer).

### Task 8: Docs, the gate, the Step 3 review, and finishing Spec #5

**Files:**
- Modify: `apps/client/README.md`, `art/README.md`, `README.md`, `docs/superpowers/HANDOFF.md`

- [ ] **Step 1: Write the docs.**
- **`apps/client/README.md`**, in "Asset slots and Blender models":
  - add bumpers and clouds to the instanced slots;
  - add a bullet: "Whole models (`Slot`): the pieces, die, crown, island, podium and props. The island's origin is its top, where the tiles stand. Props have no stand-in: a missing one leaves the sky clear.".
- **`art/README.md`**, in "The rules":
  - "The island keeps its origin at its top, where the tiles stand.";
  - "Rocks come from `shapes.rock` (flat-shaded, seeded, so a rebuild is the same), clouds from `shapes.lump`; `shapes.place` tips a group of parts together.";
  - "Props have 3 materials at most: each is its own draw call per material."
- **`README.md`:** the intro's Spec #5 line becomes "**Spec #5 (done):** the art pass, Blender models for the seven pieces, the board and the world ([design](docs/superpowers/specs/2026-10-09-art-pass-design.md))."
- **`docs/superpowers/HANDOFF.md`:**
  - the Spec #5 row: "Done (the merge date): three steps, each reviewed by the user";
  - the next step is the user's choice, offered: the deferred-minors batch (Open items), Capacitor packaging, or new board themes (memory `future-board-themes`);
  - add this plan's deferred minors to Open items.
- [ ] **Step 2: Gate.**
  - Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e`. Expected: all green; e2e 14 passed:
    - no slot warning in the whole match;
    - draw calls ≤ 100 and triangles ≤ 150,000. Ledger the highest seen.
  - Run `BLENDER="E:/Software/Blender/blender.exe" pnpm art`. Expected:
    - twenty-three report lines (nine from Step 1, five from Step 2, nine from Step 3);
    - no changed `.glb` in `git status`, since the seeded rocks rebuild the same;
    - `pnpm vitest run art/test` passes;
    - all the models together under 2.5 MB (`files.test.ts`).
- [ ] **Step 3: Commit.** `git commit -am "docs: the world models, and the hand-off after spec #5"` (with the trailer).
- [ ] **Step 4: The review.**
  - **Self-review:** a final review of all of Spec #5 (`git diff 8d76381..HEAD`, the three plans' Review Focus lists, every ledger's `Ruling:` lines). Say it was a self-review. Critical and Important findings get a test and a fix in one pass; Minor go to HANDOFF's Open items.
  - **Shots:** run `pnpm shots`, add a Step 3 section to the review page, and republish it to the same link. The section shows:
    - the match overview (the island, bumpers, clouds and props);
    - the menu, desktop and phone (the podium and clouds);
    - the jumps crop and the close-up again, so the whole look is in one place.
  - **Name the calls** the user may want to change: the props' places, and the pink-and-cream bumpers.
  - Send the user the link.
  - **Stop** until the user approves or asks for changes. Changes are made with the same build and checks.

After the user approves:
1. Use superpowers:finishing-a-development-branch:
   - the suite green on the branch;
   - fast-forward merge `art/spec-5` into `main` locally (the user's standing rule);
   - the suite again on `main`;
   - delete the branch with `git branch -d`.
2. Delete the three plans' ledger directories under `.superpowers/sdd/`.
3. Update memory:
   - `handoff`: Spec #5 done, next step offered;
   - `blender-for-3d-objects`: done, and how to rebuild (`pnpm art`).
4. Never push or deploy: the user pushes, and deploys with `pnpm deploy:cloudflare`, themselves.
