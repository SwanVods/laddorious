# Art Pass, Step 1: the Pipeline and the Pieces (Implementation Plan)

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Blender models for the seven pieces (the four, plus the new rook, top hat and rubber duck), the die and the crown, built from scripts in `art/` and loaded by the game. Every model is checked against its contract, and screenshots go to the user for the Step 1 review.

**Architecture:**
- **The build:** `art/` holds Blender Python: shared helpers (`lib/`), one script per model (`models/`), and `build.py`, which merges each model's parts into one mesh and exports a `.glb` into `apps/client/public/models/`. It runs through the Blender link (the MCP, in a separate scene) or headless with `pnpm art`.
- **The checks:** a small GLB reader in `art/` checks every file against a per-model contract.
- **The game:** it loads the files through its existing asset slots and readies their materials: the seat colour, no clearcoat on Low quality, the die's flash. The menu preloads every model.

**Tech Stack:** Blender 5.2 (Python 3.13, the bundled glTF exporter), TypeScript, React Three Fiber with drei's `useGLTF`, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-art-pass-design.md` (§4.1 is this plan's step; §3, §5, §6 and §7 hold for every step).

**This is plan 1 of 3.** Spec #5's three steps each end with the user's review, and that feedback shapes the next step. So the board (Step 2) and the world (Step 3) get their own plans, written after each review.

## Global Constraints

- **Blender:**
  - Blender 5.2 with its bundled glTF exporter, and no add-ons. This machine's Blender is at `E:\Software\Blender\blender.exe`.
  - Builds through the link never touch the open file's own scenes or objects. They work in a scene named `ArtBuild` and switch back afterwards.
- **Model rules (spec §5):**
  - 1 tile = 1.6 units; Z is up in Blender, and models face −Y (the exporter turns that into Y up and +Z forward);
  - the origin sits at the base centre, except the die, which keeps its middle at the origin (it tumbles around it);
  - pieces are about 1 unit tall, since the scene scales them by `PIECE_SCALE`;
  - transforms are applied before export.
- **Finishes (spec §3.1):**
  - glossy: roughness 0.3, Coat Weight 0.9, Coat Roughness 0.15;
  - satin: roughness 0.45, no coat;
  - glow: emission in the base colour.
- **Material names the game reads:** `Seat` (player colour), `Tint` (instance colour, Step 2), `Glow` (kept lit). Any other name is drawn as exported.
- **Budgets:**
  - pieces ≤ 5,000 triangles and ≤ 4 materials;
  - die ≤ 2,000 triangles;
  - crown ≤ 3,000 triangles;
  - all model files together < 2.5 MB;
  - a match ≤ 100 draw calls and ≤ 150,000 triangles.
- **Colours** come from `apps/client/src/app/theme.ts`; `art/lib/palette.py` mirrors them, and a test checks it.
- **`PROTOCOL_VERSION` becomes 2,** since the piece list changed.
- Commit at the end of every task with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer. Read test counts with `grep -E "Test Files|Tests "`.

## Decisions made while planning

The spec is the authority; these fill in what it leaves open.

1. **Slot files:** `SlotName` moves to a plain module, `apps/client/src/assets/slotFiles.ts`, beside `SLOT_FILES` (slot → model id), so the art tests can read it without React. `SLOT_URLS` goes; `modelUrl(id)` gives `/models/<id>.glb`.
2. **Model ids:** a short name (`knight`, `pawn`, … `duck`, `die`, `crown`) links `art/models/<id>.py`, `public/models/<id>.glb` and the contract entry.
3. **Unit tests** (Vitest's `test` mode) keep the code-built models: jsdom can't load `.glb`, and the art tests check the files themselves.
4. **`Slot`'s colour prop becomes `seat`.** Slots also take `clearcoat`, `emissive` and `shadows` (one `ModelOptions` shape).
5. **The crown moves its origin to its base,** like every other model. Its code-built stand-in shifts up to match, and the scene places it at y = 0.01 (unchanged on screen).
6. **Widths:** the spec gives no widths, so the contract allows pieces up to 1.1 units wide and the crown 1.15.
7. **`art/preview.py`** renders built models side by side to a PNG. It's for quick looks while modelling, before the in-game screenshots.
8. **The picker:** its tiles shrink so seven fit beside PLAY on a landscape phone; an e2e test pins it.
9. **Stand-ins:** the three new pieces' code-built stand-ins are simple turned shapes and spheres. They show only before a model loads or if it fails.
10. **The probe scene:** the `StyleProbe` scene Claude made in the user's Blender while brainstorming is removed in Task 4. It held only Claude's samples.
11. **The branch** (`art/spec-5`) stays open through the Step 1 review and merges to `main` locally once the user approves the look.

## Review Focus

1. **The die model's faces don't match the game's face map,** so the wrong number shows on top. Expected: the rolled face is up. Pinned in Task 2: the contract checks that the one-pip face is +Y, which is where `dieRotationFor(1)` leaves it.
2. **Seven picker tiles on a landscape phone run into PLAY.** Expected: they fit beside it. Pinned in Task 8 (an e2e test at 844 × 390).
3. **Phones on Low quality still pay for the clearcoat on models.** Expected: it's dropped. Pinned in Task 3 (`prepareModel` with `clearcoat: false`, and `QUALITY.low.clearcoat === false`).
4. **A game from before the new pieces talks to a newer server,** or the reverse. Expected: "Please reload, the game was updated", not a closed socket. Pinned in Task 1 (`PROTOCOL_VERSION` is 2; the lobby already refuses other versions with that message).
5. **A build through the Blender link wipes the user's open scene.** Expected: their objects are untouched. Pinned in Task 4: the step compares the user scene's objects before and after a build.

## File map

| Path | Task | What it holds |
|---|---|---|
| `packages/host/src/types.ts`, `protocol.ts` | 1 | seven `PieceId`s, `PROTOCOL_VERSION = 2` |
| `apps/client/src/ui/PieceIcon.tsx`, `assets/models.ts`, `hud/labels.ts`, `audio/sounds.ts`, `app/menu.css` | 1 | portraits, stand-ins, names, notes, picker size |
| `apps/client/src/assets/slotFiles.ts` | 2 | `SlotName`, `SLOT_FILES`, `modelUrl` |
| `art/glb.ts`, `art/contract.ts`, `art/test/*` | 2, 4 | the GLB reader, the per-model contract, their tests, the palette test |
| `apps/client/src/assets/slots.tsx`, `GltfModel.tsx` | 3 | `slotUrl`, `prepareModel`, `setEmissive`, `preloadModels` |
| `art/build.py`, `art/build.mjs`, `art/preview.py`, `art/lib/*`, `art/README.md` | 4 | the Blender build |
| `art/models/*.py` | 4–7 | one script per model |
| `apps/client/public/models/*.glb` | 4–7 | the built models (committed) |
| `apps/client/e2e/shots.spec.ts` | 8 | the review screenshots (`pnpm shots`) |

---
### Task 1: Three new pieces in the game

The rook, the top hat and the rubber duck join the piece list everywhere it reaches (spec §4.1's table), with code-built stand-ins. Their Blender models come in Task 6.

**Files:**
- Modify:
  - `packages/host/src/types.ts`, `packages/host/src/protocol.ts`, `packages/host/test/seats.test.ts`;
  - `apps/server/test/validate.test.ts`;
  - `apps/client/src/hud/labels.ts`, `src/ui/PieceIcon.tsx`, `src/assets/models.ts`, `src/assets/slots.tsx` (three slot names), `src/audio/sounds.ts`, `src/app/menu.css`;
  - `apps/client/test/MenuScreen.test.tsx`.
- Create: `apps/client/test/pieces.test.tsx`

**Interfaces:**
- **Produces:**
  - `PieceId` = `'knight' | 'pawn' | 'meeple' | 'dragon' | 'rook' | 'hat' | 'duck'`, and `PIECES` in that order;
  - `PROTOCOL_VERSION = 2`;
  - `PIECE_NAMES` for all seven;
  - `PIECE_NOTES` (exported; 7 notes);
  - `PIECE_GEOMETRY` for all seven;
  - slot names `piece.rook`, `piece.hat`, `piece.duck`.

- [ ] **Step 1: Write the failing tests.**

In `packages/host/test/seats.test.ts`, add the imports `import { PROTOCOL_VERSION } from '../src/protocol';` and `import { PIECES } from '../src/types';`. Then add:

```ts
describe('the seven pieces (spec #5 §4.1)', () => {
  it('lists the new pieces after the four, and bots still take free pieces in that order', () => {
    expect(PIECES).toEqual(['knight', 'pawn', 'meeple', 'dragon', 'rook', 'hat', 'duck']);
    const seats = buildSeats([
      { nickname: 'Ari', piece: 'rook' },
      { nickname: 'Bo', piece: 'duck' },
    ]);
    expect(seats.map((s) => s.piece)).toEqual(['rook', 'duck', 'knight', 'pawn']);
  });

  it('is protocol 2, so builds from before the new pieces ask to reload', () => {
    expect(PROTOCOL_VERSION).toBe(2);
  });
});
```

In `apps/server/test/validate.test.ts`, inside `describe('parseLobbyMessage (spec #4 §6, §7)', ...)`, add:

```ts
  it('accepts the three new pieces (spec #5 §4.1)', () => {
    for (const piece of ['rook', 'hat', 'duck']) {
      expect(parseLobbyMessage(json({ type: 'hello', version: 2, profile: { nickname: 'Ari', piece } }))).toMatchObject({ kind: 'ok', msg: { profile: { piece } } });
    }
  });
```

Create `apps/client/test/pieces.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PIECE_NOTES } from '../src/audio/sounds';
import { PIECE_NAMES } from '../src/hud/labels';
import { PIECES } from '../src/service/matchService';
import { Portrait } from '../src/ui/PieceIcon';

afterEach(cleanup);

describe('the seven pieces (spec #5 §4.1)', () => {
  it('names every piece', () => {
    expect(PIECES.map((p) => PIECE_NAMES[p])).toEqual(['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck']);
  });

  it.each(PIECES)('draws a portrait of the %s', (piece) => {
    const { container } = render(<Portrait piece={piece} color="#ff5470" />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(20);
    expect(d).not.toContain('NaN');
  });

  it('gives each piece its own picker note', () => {
    expect(PIECE_NOTES).toHaveLength(PIECES.length);
    expect(new Set(PIECE_NOTES).size).toBe(PIECES.length);
  });
});
```

In `apps/client/test/MenuScreen.test.tsx`:
- in "picks my piece from the picker or the arrows beside the podium", the line after the click on `Next piece` becomes `expect(prefs.getState().profile.piece).toBe('rook');`;
- in "gives each piece its own pick sound…", the `Previous piece` expectation becomes `.toBe('6')` (from the knight, the arrow wraps to the duck);
- add:

```tsx
  it('offers all seven pieces in the picker (spec #5 §4.1)', () => {
    open();
    const picker = screen.getByRole('group', { name: 'Choose your piece' });
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck']);
  });
```

Import `within` from `@testing-library/react` if the file doesn't already.

`apps/client/test/models.test.ts` already builds every `PIECES` entry's stand-in, so it covers the three new ones with no change.

Run: `pnpm vitest run packages/host/test/seats.test.ts apps/server/test/validate.test.ts apps/client/test/pieces.test.tsx apps/client/test/MenuScreen.test.tsx apps/client/test/models.test.ts`
Expected: FAIL. The piece list and protocol tests fail, `validate` closes on `rook`, `PIECE_NOTES` isn't exported, and the stand-ins and portraits are missing.

- [ ] **Step 2: The shared list.** In `packages/host/src/types.ts`:

```ts
export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon' | 'rook' | 'hat' | 'duck';

/** Piece picker order. Bots take the pieces no human chose, in this order (spec #2 §4.4, spec #5 §4.1). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon', 'rook', 'hat', 'duck'];
```

In `packages/host/src/protocol.ts`, set `export const PROTOCOL_VERSION = 2;` and add to its comment: "2 since spec #5's three new pieces."

- [ ] **Step 3: Names, notes and slots.** In `apps/client/src/hud/labels.ts`:

```ts
export const PIECE_NAMES: Record<PieceId, string> = { knight: 'Knight', pawn: 'Pawn', meeple: 'Meeple', dragon: 'Dragon head', rook: 'Rook', hat: 'Top hat', duck: 'Rubber duck' };
```

In `apps/client/src/audio/sounds.ts`:
- replace the `PIECE_NOTES` line with:

```ts
/** One marimba note per piece in picker order (spec #3 §5, spec #5 §4.1). */
export const PIECE_NOTES = ['C5', 'E5', 'G5', 'C6', 'D5', 'A5', 'E6'] as const;
```

- in `U2`, use `PIECE_NOTES[piece % PIECE_NOTES.length]!`.

In `apps/client/src/assets/slots.tsx`, add `'piece.rook' | 'piece.hat' | 'piece.duck'` to `SlotName`, after `'piece.dragon'`.

- [ ] **Step 4: Portraits.** In `apps/client/src/ui/PieceIcon.tsx`:
- change the header comment's "the four pieces" to "the pieces";
- add three entries to `SHAPES` after `meeple`:

```ts
  rook: {
    cmds: [['M', -0.34, 0], ['L', 0.34, 0], ['L', 0.34, 0.08], ['L', 0.26, 0.12], ['L', 0.22, 0.62], ['L', 0.32, 0.66], ['L', 0.32, 0.92], ['L', 0.19, 0.92], ['L', 0.19, 0.83], ['L', 0.07, 0.83], ['L', 0.07, 0.92], ['L', -0.07, 0.92], ['L', -0.07, 0.83], ['L', -0.19, 0.83], ['L', -0.19, 0.92], ['L', -0.32, 0.92], ['L', -0.32, 0.66], ['L', -0.22, 0.62], ['L', -0.26, 0.12], ['L', -0.34, 0.08], ['L', -0.34, 0]],
  },
  hat: {
    cmds: [['M', -0.46, 0.04], ['Q', -0.46, 0, -0.38, 0], ['L', 0.38, 0], ['Q', 0.46, 0, 0.46, 0.04], ['Q', 0.46, 0.1, 0.3, 0.12], ['L', 0.27, 0.86], ['Q', 0.27, 0.92, 0.2, 0.92], ['L', -0.2, 0.92], ['Q', -0.27, 0.92, -0.27, 0.86], ['L', -0.3, 0.12], ['Q', -0.46, 0.1, -0.46, 0.04]],
  },
  duck: {
    eye: [0.16, 0.76],
    cmds: [['M', -0.3, 0], ['L', 0.24, 0], ['Q', 0.44, 0.02, 0.42, 0.22], ['Q', 0.4, 0.4, 0.2, 0.44], ['Q', 0.36, 0.5, 0.34, 0.66], ['L', 0.5, 0.62], ['L', 0.52, 0.68], ['L', 0.34, 0.74], ['Q', 0.3, 0.92, 0.12, 0.92], ['Q', -0.06, 0.9, -0.06, 0.7], ['Q', -0.06, 0.56, 0.04, 0.48], ['Q', -0.2, 0.48, -0.34, 0.36], ['L', -0.44, 0.42], ['L', -0.4, 0.22], ['Q', -0.42, 0.04, -0.3, 0]],
  },
```

- build `DRAWN` from the list, importing `PIECES` from `'../service/matchService'`:

```ts
const DRAWN = Object.fromEntries(PIECES.map((piece) => [piece, draw(piece)])) as Record<PieceId, Drawn>;
```

- [ ] **Step 5: Stand-ins.** In `apps/client/src/assets/models.ts`, add `ConeGeometry` and `SphereGeometry` to the `three` import. Add before `PIECE_GEOMETRY`:

```ts
function rookGeometry(): BufferGeometry {
  const tower = lathe([[0, 0], [0.4, 0], [0.42, 0.05], [0.4, 0.1], [0.31, 0.14], [0.28, 0.2], [0.24, 0.6], [0.31, 0.64], [0.33, 0.68], [0.33, 0.84], [0, 0.84]]);
  const merlons = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const m = new RoundedBoxGeometry(0.16, 0.16, 0.16, 1, 0.03);
    m.rotateY(-a);
    m.translate(Math.cos(a) * 0.24, 0.91, Math.sin(a) * 0.24);
    return m;
  });
  return merge([tower, ...merlons]);
}

function hatGeometry(): BufferGeometry {
  return lathe([[0, 0], [0.46, 0], [0.485, 0.035], [0.46, 0.07], [0.3, 0.085], [0.275, 0.1], [0.27, 0.9], [0.255, 0.95], [0.2, 0.965], [0, 0.97]]);
}

/** A round body, a head, a flat beak and a tail, facing +Z; stood on the origin. */
function duckGeometry(): BufferGeometry {
  const body = new SphereGeometry(0.34, 20, 14);
  body.scale(0.9, 0.75, 1.15);
  body.translate(0, 0.27, 0);
  const head = new SphereGeometry(0.2, 18, 12);
  head.translate(0, 0.72, 0.12);
  const beak = new SphereGeometry(0.09, 12, 8);
  beak.scale(1.1, 0.45, 1.6);
  beak.translate(0, 0.68, 0.33);
  const tail = new ConeGeometry(0.1, 0.22, 10);
  tail.rotateX(-0.8);
  tail.translate(0, 0.42, -0.36);
  const g = merge([body, head, beak, tail]);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  return g;
}
```

Add them to `PIECE_GEOMETRY`: `rook: rookGeometry, hat: hatGeometry, duck: duckGeometry`.

- [ ] **Step 6: The picker fits seven.** In `apps/client/src/app/menu.css`, in `.picker-tile`:
- change `width` to `max(50px, 10cqh)`;
- change `font-size` to `max(9px, 1.7cqh)`;
- add `text-align: center;` and `padding-inline: 2px;`.

Task 8's e2e test checks the picker stays clear of PLAY on a landscape phone.

- [ ] **Step 7: Run the tests.**

Run: `pnpm vitest run packages/host/test/seats.test.ts apps/server/test/validate.test.ts apps/client/test/pieces.test.tsx apps/client/test/MenuScreen.test.tsx apps/client/test/models.test.ts`
Expected: PASS. The stand-ins stand on the origin, 0.9 to 1.2 tall and under 1.05 wide.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green. TypeScript checks that every `Record<PieceId, …>` has the new keys.

- [ ] **Step 8: Commit.** `git add -A packages apps && git commit -m "feat: three new pieces: the rook, the top hat and the rubber duck"` (with the trailer).

### Task 2: The model contract and its checks

Before any model exists, the checks do. They cover a GLB reader, the per-model contract, a test over every built file, and the list of which slots load which file.

**Files:**
- Create:
  - `apps/client/src/assets/slotFiles.ts`;
  - `art/glb.ts`, `art/contract.ts`;
  - `art/test/glb.test.ts`, `art/test/contract.test.ts`, `art/test/files.test.ts`, `art/test/tsconfig.json`.
- Modify:
  - `apps/client/src/assets/slots.tsx`: `SlotName` and the files come from `slotFiles.ts`; `SLOT_URLS` goes;
  - `vitest.config.ts`, `package.json` (typecheck).

**Interfaces:**
- **Consumes:** the seven slot names (Task 1).
- **Produces:**
  - `SlotName`, `SLOT_FILES: Partial<Record<SlotName, string>>` (slot → model id), `modelUrl(id): string`;
  - `readGlb(bytes): GlbSummary` with `{ min, max, triangles, materials, byMaterial, transformedNodes }`;
  - `MODELS: Record<string, ModelRule>`, `contractProblems(id, summary): string[]`, `MAX_TOTAL_BYTES`.

- [ ] **Step 1: Move the slot names into a plain module.** Create `apps/client/src/assets/slotFiles.ts`:

```ts
// Which asset slots have a Blender model, and its file (spec #5 §6). `pnpm art` writes
// apps/client/public/models/<id>.glb; art/test checks each listed file is built and keeps its
// contract. Plain TypeScript, so the art tests can read it too.

export type SlotName =
  | 'piece.knight'
  | 'piece.pawn'
  | 'piece.meeple'
  | 'piece.dragon'
  | 'piece.rook'
  | 'piece.hat'
  | 'piece.duck'
  | 'die'
  | 'pad'
  | 'slide.vortex'
  | 'crown'
  | 'island';

/** The model id (file name without .glb) for each slot that has a Blender model. A slot not listed keeps its code-built model. */
export const SLOT_FILES: Partial<Record<SlotName, string>> = {};

/** Where the game loads a model from (served from apps/client/public). */
export function modelUrl(id: string): string {
  return `/models/${id}.glb`;
}
```

In `apps/client/src/assets/slots.tsx`:
- delete the `SlotName` type and `SLOT_URLS`, and add:

```tsx
import { SLOT_FILES, modelUrl, type SlotName } from './slotFiles';

export type { SlotName } from './slotFiles';
```

- in `Slot`, replace `const url = SLOT_URLS[name];` and `if (!url) return fallback;` with:

```tsx
  const file = SLOT_FILES[name];
  if (!file) return fallback;
  const url = modelUrl(file);
```

Run: `pnpm typecheck && pnpm vitest run apps/client/test/slots.test.tsx`
Expected: green; nothing else used `SLOT_URLS`.

- [ ] **Step 2: Wire the art tests in.** Create `art/test/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["."]
}
```

- In `vitest.config.ts`, add `'art/test/**/*.test.ts'` to `include`.
- In the root `package.json`, append `&& tsc -p art/test` to `typecheck`.

- [ ] **Step 3: Write the failing tests.** Create `art/test/glb.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readGlb } from '../glb';

/** A .glb with this JSON and no binary chunk: enough for the reader, which never reads vertices. */
function glb(json: object): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(20 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

const MODEL = {
  asset: { version: '2.0' },
  accessors: [
    { count: 3, type: 'VEC3', componentType: 5126, min: [-0.4, 0, -0.3], max: [0.4, 1.1, 0.35] },
    { count: 6, type: 'SCALAR', componentType: 5123 },
    { count: 3, type: 'VEC3', componentType: 5126, min: [0.1, 0.9, -0.2], max: [0.2, 1.0, -0.1] },
  ],
  materials: [{ name: 'Seat' }, { name: 'Eye' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }, { attributes: { POSITION: 2 }, material: 1 }] }],
  nodes: [{ name: 'knight', mesh: 0 }],
};

describe('readGlb (spec #5 §7)', () => {
  it('reads the bounds, the triangles and the materials', () => {
    const model = readGlb(glb(MODEL));
    expect(model.min).toEqual([-0.4, 0, -0.3]);
    expect(model.max).toEqual([0.4, 1.1, 0.35]);
    expect(model.triangles).toBe(3); // 6 indices, plus 3 vertices without indices
    expect(model.materials).toEqual(['Seat', 'Eye']);
    expect(model.byMaterial.Eye).toEqual({ min: [0.1, 0.9, -0.2], max: [0.2, 1.0, -0.1] });
    expect(model.transformedNodes).toEqual([]);
  });

  it('lists nodes that still carry a transform', () => {
    const model = readGlb(glb({ ...MODEL, nodes: [{ name: 'knight', mesh: 0, translation: [0, 0.2, 0] }, { name: 'still', scale: [1, 1, 1] }] }));
    expect(model.transformedNodes).toEqual(['knight']);
  });

  it('refuses a file that is not a glb', () => {
    expect(() => readGlb(new TextEncoder().encode('not a model, just text here'))).toThrow('not a .glb file');
  });
});
```

Create `art/test/contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contractProblems } from '../contract';
import type { GlbSummary } from '../glb';

const knight = (change: Partial<GlbSummary> = {}): GlbSummary => ({
  min: [-0.42, 0, -0.45],
  max: [0.42, 1.2, 0.45],
  triangles: 3200,
  materials: ['Seat', 'Eye', 'Shine'],
  byMaterial: {},
  transformedNodes: [],
  ...change,
});

describe('the model contract (spec #5 §4.1, §5)', () => {
  it('passes a knight that keeps the rules', () => {
    expect(contractProblems('knight', knight())).toEqual([]);
  });

  it('names every rule a model breaks', () => {
    const problems = contractProblems('knight', knight({ min: [-0.42, 0.1, -0.45], max: [0.42, 1.6, 0.45], triangles: 6000, materials: ['Body'], transformedNodes: ['knight'] }));
    expect(problems).toEqual([
      'its base is at y = 0.100, not 0',
      'it is 1.50 tall; 0.85–1.3 expected',
      'it has 6000 triangles; at most 5000',
      'it has no Seat material',
      'these nodes still carry a transform: knight',
    ]);
  });

  it('refuses a model with no rule', () => {
    expect(contractProblems('teapot', knight())).toEqual(['teapot has no rule in art/contract.ts']);
  });

  it('checks the die keeps its middle at the origin and its one-pip face up (+Y)', () => {
    const die = (oneAt: [number, number, number]): GlbSummary => ({
      min: [-0.25, -0.25, -0.25],
      max: [0.25, 0.25, 0.25],
      triangles: 1200,
      materials: ['Body', 'Pip', 'One'],
      byMaterial: { One: { min: [oneAt[0] - 0.07, oneAt[1] - 0.02, oneAt[2] - 0.07], max: [oneAt[0] + 0.07, oneAt[1] + 0.02, oneAt[2] + 0.07] } },
      transformedNodes: [],
    });
    expect(contractProblems('die', die([0, 0.24, 0]))).toEqual([]);
    expect(contractProblems('die', die([0, 0, 0.24]))).toEqual(['the one-pip face is not on top (+Y): its pip is at 0.00, 0.00, 0.24']);
  });
});
```

Create `art/test/files.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLOT_FILES } from '../../apps/client/src/assets/slotFiles';
import { MAX_TOTAL_BYTES, MODELS, contractProblems } from '../contract';
import { readGlb } from '../glb';

const DIR = new URL('../../apps/client/public/models/', import.meta.url);
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort() : [];

describe('the built models (spec #5 §7)', () => {
  it('has a built file for every slot the game loads, built for that slot', () => {
    for (const [slot, id] of Object.entries(SLOT_FILES)) {
      expect(files, `${slot} is listed in slotFiles.ts but ${id}.glb isn't built`).toContain(`${id}.glb`);
      expect(MODELS[id!]?.slot, `${id} is built for another slot`).toBe(slot);
    }
  });

  for (const file of files) {
    it(`${file} keeps its contract`, () => {
      const model = readGlb(new Uint8Array(readFileSync(new URL(file, DIR))));
      expect(contractProblems(file.replace(/\.glb$/, ''), model)).toEqual([]);
    });
  }

  it('keeps all the models together under 2.5 MB', () => {
    const total = files.reduce((sum, f) => sum + statSync(new URL(f, DIR)).size, 0);
    expect(total).toBeLessThan(MAX_TOTAL_BYTES);
  });
});
```

Run: `pnpm vitest run art/test`
Expected: FAIL; `../glb` and `../contract` don't exist.

- [ ] **Step 4: Implement the reader.** Create `art/glb.ts`:

```ts
// A small reader for .glb files, enough to check a model against its contract (spec #5 §7).
// It reads the header and the JSON chunk; the bounds come from the POSITION accessors' min and max,
// which glTF requires, so no vertex is read.

type Vec3 = [number, number, number];

export interface GlbSummary {
  /** The bounds of every mesh (glTF: Y up, +Z forward). */
  min: Vec3;
  max: Vec3;
  triangles: number;
  materials: string[];
  /** Each material's bounds, over the primitives drawn with it. */
  byMaterial: Record<string, { min: Vec3; max: Vec3 }>;
  /** Nodes with a transform. The build applies transforms, so this should be empty. */
  transformedNodes: string[];
}

interface Accessor {
  count: number;
  min?: number[];
  max?: number[];
}

interface Node {
  name?: string;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
}

interface Gltf {
  accessors?: Accessor[];
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number; mode?: number }> }>;
  nodes?: Node[];
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

const empty = (): { min: Vec3; max: Vec3 } => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });

function grow(box: { min: Vec3; max: Vec3 }, min: number[], max: number[]): void {
  for (let k = 0; k < 3; k++) {
    box.min[k] = Math.min(box.min[k]!, min[k]!);
    box.max[k] = Math.max(box.max[k]!, max[k]!);
  }
}

const isIdentity = (n: Node): boolean =>
  !n.matrix &&
  (!n.translation || n.translation.every((v) => v === 0)) &&
  (!n.rotation || (n.rotation[0] === 0 && n.rotation[1] === 0 && n.rotation[2] === 0 && n.rotation[3] === 1)) &&
  (!n.scale || n.scale.every((v) => v === 1));

export function readGlb(bytes: Uint8Array): GlbSummary {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new Error('not a .glb file');
  if (view.getUint32(4, true) !== 2) throw new Error('not glTF 2.0');
  if (view.getUint32(16, true) !== JSON_CHUNK) throw new Error('the first chunk is not JSON');
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true)))) as Gltf;
  const accessors = gltf.accessors ?? [];
  const materials = (gltf.materials ?? []).map((m, i) => m.name ?? `material ${i}`);
  const all = empty();
  const byMaterial: GlbSummary['byMaterial'] = {};
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error('only triangle meshes are supported');
      const position = accessors[primitive.attributes.POSITION ?? -1];
      if (!position?.min || !position.max) throw new Error('a primitive has no POSITION bounds');
      triangles += (primitive.indices === undefined ? position.count : accessors[primitive.indices]!.count) / 3;
      const name = primitive.material === undefined ? '(none)' : materials[primitive.material]!;
      grow(all, position.min, position.max);
      grow((byMaterial[name] ??= empty()), position.min, position.max);
    }
  }
  const transformedNodes = (gltf.nodes ?? []).flatMap((n, i) => (isIdentity(n) ? [] : [n.name ?? `node ${i}`]));
  return { ...all, triangles, materials, byMaterial, transformedNodes };
}
```

- [ ] **Step 5: Implement the contract.** Create `art/contract.ts`:

```ts
import type { SlotName } from '../apps/client/src/assets/slotFiles';
import type { GlbSummary } from './glb';

// What every model file must keep (spec #5 §4, §5): one rule per art/models/<id>.py.

export interface ModelRule {
  slot: SlotName;
  /** Where the origin sits: at the base centre, or the middle (the die, which tumbles round it). */
  origin: 'base' | 'centre';
  height: [number, number];
  /** The widest footprint, across X or Z. */
  maxWidth: number;
  maxTriangles: number;
  maxMaterials: number;
  requiredMaterials: string[];
  /** Extra checks; each returns a problem, or null. */
  checks?: Array<(model: GlbSummary) => string | null>;
}

/** The game turns face 1 up by leaving the die unrotated (dieRotationFor), so the one-pip face must be +Y. */
function oneOnTop(model: GlbSummary): string | null {
  const one = model.byMaterial.One;
  if (!one) return null; // requiredMaterials reports a missing One
  const mid = [0, 1, 2].map((k) => (one.min[k]! + one.max[k]!) / 2);
  if (mid[1]! > 0.2 && Math.abs(mid[0]!) < 0.03 && Math.abs(mid[2]!) < 0.03) return null;
  return `the one-pip face is not on top (+Y): its pip is at ${mid.map((v) => (v + 0).toFixed(2)).join(', ')}`;
}

const piece = (slot: SlotName): ModelRule => ({ slot, origin: 'base', height: [0.85, 1.3], maxWidth: 1.1, maxTriangles: 5000, maxMaterials: 4, requiredMaterials: ['Seat'] });

export const MODELS: Record<string, ModelRule> = {
  knight: piece('piece.knight'),
  pawn: piece('piece.pawn'),
  meeple: piece('piece.meeple'),
  dragon: piece('piece.dragon'),
  rook: piece('piece.rook'),
  hat: piece('piece.hat'),
  duck: piece('piece.duck'),
  die: { slot: 'die', origin: 'centre', height: [0.45, 0.56], maxWidth: 0.56, maxTriangles: 2000, maxMaterials: 3, requiredMaterials: ['One'], checks: [oneOnTop] },
  crown: { slot: 'crown', origin: 'base', height: [0.5, 0.9], maxWidth: 1.15, maxTriangles: 3000, maxMaterials: 3, requiredMaterials: [] },
};

/** All the model files together stay under this (spec #5 A9). */
export const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;
const LEVEL = 0.012;
const CENTRED = 0.08;

/** Every rule a model file breaks, in words; empty when it keeps them all. */
export function contractProblems(id: string, model: GlbSummary): string[] {
  const rule = MODELS[id];
  if (!rule) return [`${id} has no rule in art/contract.ts`];
  const [x0, y0, z0] = model.min;
  const [x1, y1, z1] = model.max;
  const height = y1 - y0;
  const problems: string[] = [];
  if (rule.origin === 'base' && Math.abs(y0) > LEVEL) problems.push(`its base is at y = ${y0.toFixed(3)}, not 0`);
  if (rule.origin === 'centre' && Math.abs((y0 + y1) / 2) > LEVEL) problems.push(`its middle is at y = ${((y0 + y1) / 2).toFixed(3)}, not 0`);
  if (Math.abs((x0 + x1) / 2) > CENTRED || Math.abs((z0 + z1) / 2) > CENTRED) problems.push(`it is off centre: ${((x0 + x1) / 2).toFixed(2)}, ${((z0 + z1) / 2).toFixed(2)}`);
  if (height < rule.height[0] || height > rule.height[1]) problems.push(`it is ${height.toFixed(2)} tall; ${rule.height[0]}–${rule.height[1]} expected`);
  const width = Math.max(x1 - x0, z1 - z0);
  if (width > rule.maxWidth) problems.push(`it is ${width.toFixed(2)} wide; at most ${rule.maxWidth}`);
  if (model.triangles > rule.maxTriangles) problems.push(`it has ${model.triangles} triangles; at most ${rule.maxTriangles}`);
  if (model.materials.length > rule.maxMaterials) problems.push(`it has ${model.materials.length} materials; at most ${rule.maxMaterials}`);
  for (const name of rule.requiredMaterials) if (!model.materials.includes(name)) problems.push(`it has no ${name} material`);
  if (model.transformedNodes.length > 0) problems.push(`these nodes still carry a transform: ${model.transformedNodes.join(', ')}`);
  for (const check of rule.checks ?? []) {
    const problem = check(model);
    if (problem) problems.push(problem);
  }
  return problems;
}
```

- [ ] **Step 6: Run the tests.**

Run: `pnpm vitest run art/test`
Expected: PASS. `files.test.ts` passes too: nothing is listed or built yet.

Then `pnpm typecheck` (now including `art/test`), `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 7: Commit.** `git add -A art apps/client/src/assets vitest.config.ts package.json && git commit -m "test(art): the model contract, a glb reader and the slot file list"` (with the trailer).

### Task 3: The game readies and preloads models

The game side, done before any model is listed, so no step ever loads a `.glb` into a unit test.

**Files:**
- Modify:
  - `apps/client/src/assets/slots.tsx`, `apps/client/src/assets/GltfModel.tsx`;
  - `apps/client/src/scene/quality.ts`, `scene/Pieces.tsx`, `scene/Surroundings.tsx`, `scene/MatchScene.tsx`, `scene/MenuScene.tsx`;
  - `apps/client/src/assets/models.ts` (the crown stands on its base);
  - `apps/client/test/slots.test.tsx`, `test/quality.test.ts`, `test/models.test.ts`.

**Interfaces:**
- **Consumes:** `SLOT_FILES`, `modelUrl`, `SlotName` (Task 2).
- **Produces:**
  - `slotUrl(name): string | null` (null in unit tests and for unlisted slots);
  - `ModelOptions { seat?; clearcoat?; emissive?; shadows? }`;
  - `prepareModel(root, options)`, `setEmissive(root, intensity)`, `preloadModels()`;
  - `<Slot name fallback {...ModelOptions} />`;
  - `QualityProfile.clearcoat` (high: true, low: false);
  - `Pieces` and `Surroundings` take `clearcoat`.

- [ ] **Step 1: Write the failing tests.** Replace `apps/client/test/slots.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotBoundary, prepareModel, setEmissive, slotUrl } from '../src/assets/slots';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error('404 knight.glb');
}

describe('asset slots (spec #2 §6.3, spec #5 §6)', () => {
  it('gives materials named Seat the seat colour, leaving shared materials and other parts alone', () => {
    const seat = new MeshStandardMaterial({ name: 'Seat', color: '#ffffff' });
    const trim = new MeshStandardMaterial({ name: 'Trim', color: '#000000' });
    const body = new Mesh(new BoxGeometry(), seat);
    const hat = new Mesh(new BoxGeometry(), [seat, trim]);
    const root = new Group();
    root.add(body, hat);
    prepareModel(root, { seat: '#ff5470' });
    expect((body.material as MeshStandardMaterial).color.getHexString()).toBe('ff5470');
    const [tinted, untouched] = hat.material as MeshStandardMaterial[];
    expect(tinted!.color.getHexString()).toBe('ff5470');
    expect(untouched).toBe(trim);
    expect(seat.color.getHexString()).toBe('ffffff');
  });

  it('drops the clearcoat on Low quality, on a copy, and keeps it on High', () => {
    const glossy = new MeshPhysicalMaterial({ name: 'Seat', clearcoat: 0.9 });
    const low = new Mesh(new BoxGeometry(), glossy);
    prepareModel(low, { clearcoat: false });
    expect((low.material as MeshPhysicalMaterial).clearcoat).toBe(0);
    expect(glossy.clearcoat).toBe(0.9);
    const high = new Mesh(new BoxGeometry(), glossy);
    prepareModel(high, { clearcoat: true });
    expect(high.material).toBe(glossy);
  });

  it('readies every lit material to flash, then flashes it', () => {
    const body = new MeshStandardMaterial({ name: 'Body' });
    const die = new Mesh(new BoxGeometry(), body);
    prepareModel(die, { emissive: '#ffcc33' });
    const ready = die.material as MeshStandardMaterial;
    expect(ready.emissive.getHexString()).toBe('ffcc33');
    expect(ready.emissiveIntensity).toBe(0);
    setEmissive(die, 0.5);
    expect(ready.emissiveIntensity).toBe(0.5);
    expect(body.emissiveIntensity).toBe(1);
  });

  it('casts shadows only when asked', () => {
    const lit = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    prepareModel(lit, { shadows: true });
    expect(lit.castShadow).toBe(true);
    const flat = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    prepareModel(flat, {});
    expect(flat.castShadow).toBe(false);
  });

  it('keeps the code-built models in unit tests', () => {
    expect(slotUrl('piece.knight')).toBeNull();
  });

  it('shows the built-in model and warns when a model fails to load', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SlotBoundary name="piece.knight" fallback={<p>built-in knight</p>}>
        <Broken />
      </SlotBoundary>,
    );
    expect(screen.getByText('built-in knight')).toBeTruthy();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('piece.knight');
  });
});
```

In `apps/client/test/quality.test.ts`, in the test that checks the profiles, add:

```ts
    expect(QUALITY.high.clearcoat).toBe(true);
    expect(QUALITY.low.clearcoat).toBe(false); // phones skip the clearcoat (spec #5 §3.1)
```

In `apps/client/test/models.test.ts`, replace "gives the crown five raised points" with:

```ts
  it('stands the crown on its base, with five raised points', () => {
    const g = crownGeometry();
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 3);
    const pos = g.getAttribute('position');
    // Keyed in hundredths: the seam repeats the first vertex up to a float error.
    const points = new Set<string>();
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.6) points.add(`${Math.round(pos.getX(i) * 100)},${Math.round(pos.getZ(i) * 100)}`);
    expect(points.size).toBe(5);
  });
```

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/quality.test.ts apps/client/test/models.test.ts`
Expected: FAIL. `prepareModel`, `setEmissive`, `slotUrl` and `clearcoat` don't exist, and the crown's base is at −0.21.

- [ ] **Step 2: Ready models in `slots.tsx`.** Replace `tintSeat` and `Slot` in `apps/client/src/assets/slots.tsx`, and add the new pieces:
- change the `three` import to `import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Material, type Object3D } from 'three';`;
- import `SLOT_FILES`, `modelUrl` and `SlotName` as in Task 2;
- add:

```tsx
/**
 * Blender models load in the game. Unit tests (Vitest's "test" mode) keep the code-built models:
 * jsdom can't load .glb files, and the art tests check the files themselves (spec #5 §7).
 */
const MODELS_ON = import.meta.env.MODE !== 'test';

/** A slot's model URL, or null where the slot keeps its code-built model. */
export function slotUrl(name: SlotName): string | null {
  const file = SLOT_FILES[name];
  return MODELS_ON && file ? modelUrl(file) : null;
}

/** How a loaded model is readied for the game (spec #5 §6). */
export interface ModelOptions {
  /** Materials named Seat take this colour (spec #2 §6.3). */
  seat?: string;
  /** False on Low quality: glossy plastic drops its clearcoat (spec #5 §3.1). */
  clearcoat?: boolean;
  /** Every lit material gets this emissive colour at intensity 0, so the game can flash it (the die). */
  emissive?: string;
  /** Meshes cast shadows (High quality). */
  shadows?: boolean;
}

/** Ready a loaded model's materials and shadows. Changed materials are copies, so shared ones stay as they were. */
export function prepareModel(root: Object3D, { seat, clearcoat = true, emissive, shadows = false }: ModelOptions): void {
  const prepare = (material: Material): Material => {
    if (!(material instanceof MeshStandardMaterial)) return material;
    const tint = seat !== undefined && material.name === 'Seat';
    const uncoat = !clearcoat && material instanceof MeshPhysicalMaterial && material.clearcoat > 0;
    if (!tint && !uncoat && emissive === undefined) return material;
    const copy = material.clone();
    if (tint) copy.color.set(seat);
    if (uncoat) (copy as MeshPhysicalMaterial).clearcoat = 0;
    if (emissive !== undefined) {
      copy.emissive.set(emissive);
      copy.emissiveIntensity = 0;
    }
    return copy;
  };
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = shadows;
    node.material = Array.isArray(node.material) ? node.material.map(prepare) : prepare(node.material);
  });
}

/** Light every lit material in a model by this much (the die's forced-face flash). */
export function setEmissive(root: Object3D, intensity: number): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof MeshStandardMaterial) material.emissiveIntensity = intensity;
    }
  });
}
```

Keep `SlotBoundary` and the lazy `GltfModel`. Then replace `Slot` with:

```tsx
/** An asset slot: its Blender model when it has one, its code-built default otherwise or on failure. */
export function Slot({ name, fallback, ...options }: { name: SlotName; fallback: ReactNode } & ModelOptions) {
  const url = slotUrl(name);
  if (!url) return fallback;
  return (
    <SlotBoundary name={name} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} {...options} />
      </Suspense>
    </SlotBoundary>
  );
}

/** Start loading every model the game uses (the menu calls this), so a match never pops from stand-in to model. */
export function preloadModels(): void {
  const urls = (Object.keys(SLOT_FILES) as SlotName[]).map(slotUrl).filter((url): url is string => url !== null);
  if (urls.length > 0) void import('./GltfModel').then((m) => m.preload(urls));
}
```

Replace `apps/client/src/assets/GltfModel.tsx` with:

```tsx
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { prepareModel, type ModelOptions } from './slots';

/** A slot's .glb model, readied for the game (spec #5 §6). Slot loads this module only when it has a URL. */
export default function GltfModel({ url, seat, clearcoat, emissive, shadows }: { url: string } & ModelOptions) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    prepareModel(copy, { seat, clearcoat, emissive, shadows });
    return copy;
  }, [scene, seat, clearcoat, emissive, shadows]);
  return <primitive object={model} />;
}

/** Start loading these model files now. */
export function preload(urls: string[]): void {
  for (const url of urls) useGLTF.preload(url);
}
```

- [ ] **Step 3: Quality, pieces, die and crown.**
- **`scene/quality.ts`:** add `/** Glossy plastic keeps its clearcoat (spec #5 §3.1). */ clearcoat: boolean;` to `QualityProfile`. Set `clearcoat: true` on `high` and `clearcoat: false` on `low`.
- **`scene/MatchScene.tsx`:** pass `clearcoat={profile.clearcoat}` to `<Surroundings>` and `<Pieces>`.
- **`scene/Pieces.tsx`:**
  - add `clearcoat: boolean` to `PiecesProps` and to `ActorProps`, and pass it through;
  - import `setEmissive` with `Slot`;
  - make `dieRef` a `useRef<Group>(null)`;
  - give the piece's `<Slot>` the props `seat={seat.color} clearcoat={clearcoat} shadows={shadows}` (in place of `color=`), and make its fallback material's clearcoat `clearcoat={clearcoat ? 1 : 0}`;
  - replace the die `<mesh ref={dieRef} …>` element with:

```tsx
      <group ref={dieRef} visible={false}>
        <Slot
          name="die"
          clearcoat={clearcoat}
          shadows={shadows}
          emissive={WORLD_COLORS.crown}
          fallback={
            <mesh geometry={dieShape} castShadow={shadows}>
              <meshStandardMaterial {...(atlas ? { map: atlas } : { color: WORLD_COLORS.die })} emissive={WORLD_COLORS.crown} emissiveIntensity={0} roughness={0.4} />
            </mesh>
          }
        />
      </group>
```

  - in `useFrame`, replace the line that sets the die material's `emissiveIntensity` with `setEmissive(dieRef.current, roll.forced ? 0.35 + 0.35 * Math.sin(now / 90) : 0);`.
- **`scene/Surroundings.tsx`:**
  - add `clearcoat: boolean` to its props;
  - give the crown `<Slot>` the props `clearcoat={clearcoat} shadows={shadows}`;
  - move the crown group to `position={[goal[0], 0.01, goal[2]]}`, since the crown now stands on its base.
- **`assets/models.ts`:** in `crownGeometry`, after `g.computeVertexNormals();`, add `g.translate(0, 0.21, 0); // stand on the base, like the Blender crown (spec #5 §5)`.
- **`scene/MenuScene.tsx`:**
  - import `preloadModels` with `Slot`;
  - in `MenuContent`, add `useEffect(() => preloadModels(), []);` with a comment: "Load every model while the menu shows, so the match never pops in (spec #5 §6)";
  - give the menu piece's `<Slot>` the props `seat={SEAT_COLORS[0]} clearcoat={profile.clearcoat} shadows={profile.shadows}` (in place of `color=`).

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run apps/client/test/slots.test.tsx apps/client/test/quality.test.ts apps/client/test/models.test.ts apps/client/test/scene.test.tsx apps/client/test/matchScene.test.tsx apps/client/test/menuScene.test.tsx`
Expected: PASS; the scene tests keep their draw-call and triangle checks.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then a browser check: `pnpm dev`, play a match against bots. The die still tumbles and flashes on a forced face, the crown sits on tile 100 as before, and the console is clean.

- [ ] **Step 5: Commit.** `git commit -am "feat(client): ready Blender models for the game, and preload them from the menu"` (with the trailer).

### Task 4: The Blender build, and the pawn

The pipeline end to end, with the simplest model. The pawn is a turned profile with a ball head, as in the mockup.

**Files:**
- Create:
  - `art/README.md`, `art/build.py`, `art/build.mjs`, `art/preview.py`;
  - `art/lib/__init__.py`, `art/lib/palette.py`, `art/lib/finish.py`, `art/lib/shapes.py`, `art/lib/export.py`;
  - `art/models/__init__.py`, `art/models/pawn.py`;
  - `art/test/palette.test.ts`;
  - `apps/client/public/models/pawn.glb` (built).
- Modify:
  - `apps/client/src/assets/slotFiles.ts` (`'piece.pawn': 'pawn'`);
  - `package.json` (`art` script), `eslint.config.js` (Node globals for `art/*.mjs`), `.gitignore` (`__pycache__/`).

**Interfaces:**
- **Consumes:** `SLOT_FILES` and the contract (Task 2).
- **Produces:**
  - **Python helpers:**
    - `lib.palette`: `SEAT`, `INK`, `CREAM`, `WHITE`, `GOLD`, `TANGERINE`, `PODIUM_TOP`, `linear(hex)`;
    - `lib.finish`: `glossy(name, colour)`, `satin(name, colour)`, `glow(name, colour, strength=1.5)`;
    - `lib.shapes`: `revolve(name, profile, material, segments=48)`, `outline(name, commands, depth, material, bevel=0.045, view='side'|'front', offset=(dx, dy))`, `sphere(name, radius, material, location, scale, segments, rings)`, `cone(name, radius, height, material, location, rotation, segments)`, `rounded_box(name, size, radius, material, location, rotation, segments)`;
    - `lib.export`: `begin()`, `finish(scene, id, parts, path)`.
  - **Model scripts:** `art/models/<id>.py` with `build() -> list of parts`.
  - **Commands:**
    - `pnpm art [ids…]`;
    - through the link: `exec` `art/build.py` with `ART_IDS` set; it returns `RESULT`;
    - `art/preview.py` with `ART_IDS` and `PREVIEW_PATH`.

- [ ] **Step 1: Tidy the user's Blender.** Remove the `StyleProbe` scene Claude made while brainstorming, through the link (`execute_blender_code`):

```python
import bpy
scene = bpy.data.scenes.get('StyleProbe')
home = next((s for s in bpy.data.scenes if s.name != 'StyleProbe'), None)
if scene and home:
    bpy.context.window.scene = home
    bpy.data.scenes.remove(scene)
for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
    for block in list(collection):
        if block.users == 0:
            collection.remove(block)
result = {'scenes': [s.name for s in bpy.data.scenes], 'objects': sorted(o.name for o in bpy.context.window.scene.objects)}
```

Expected: `{'scenes': ['Scene'], 'objects': ['Camera', 'Cube', 'Light']}`: the user's own scene, as it was.

- [ ] **Step 2: Write the failing tests.** Create `art/test/palette.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const palette = readFileSync(new URL('../lib/palette.py', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../../apps/client/src/app/theme.ts', import.meta.url), 'utf8').toLowerCase();

describe('the model palette (spec #5 §3.1)', () => {
  it('uses only Tangerine Dusk colours from theme.ts', () => {
    const colours = [...palette.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]!.toLowerCase());
    expect(colours.length).toBeGreaterThan(4);
    expect(colours.filter((c) => !theme.includes(c))).toEqual([]);
  });
});
```

In `apps/client/src/assets/slotFiles.ts`, list the pawn: `export const SLOT_FILES: Partial<Record<SlotName, string>> = { 'piece.pawn': 'pawn' };`

Run: `pnpm vitest run art/test`
Expected: FAIL. `palette.py` doesn't exist, and "piece.pawn is listed in slotFiles.ts but pawn.glb isn't built".

- [ ] **Step 3: The palette and finishes.** Create `art/lib/__init__.py` and `art/models/__init__.py`, each with one line: `"""Laddorious art build (spec #5 §5)."""`.

Create `art/lib/palette.py`:

```python
"""Tangerine Dusk colours for the models (spec #5 §3.1), mirrored from apps/client/src/app/theme.ts.
art/test/palette.test.ts checks that every colour here also appears there."""

SEAT = '#ff5470'  # a stand-in: the game paints Seat materials in the player's colour
INK = '#0f2e36'
CREAM = '#fff7ec'
WHITE = '#ffffff'
GOLD = '#ffcc33'
TANGERINE = '#ffa22e'
PODIUM_TOP = '#fff3e3'


def linear(colour):
    """A '#rrggbb' sRGB colour as Blender's linear RGBA."""
    value = colour.lstrip('#')

    def channel(i):
        c = int(value[i:i + 2], 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (channel(0), channel(2), channel(4), 1.0)
```

Create `art/lib/finish.py`:

```python
"""The plastic finishes (spec #5 §3.1). Material names are the game's contract: Seat takes the
player's colour, Tint each instance's colour, Glow stays lit; any other name draws as exported."""
import bpy

from .palette import linear


def _material(name):
    if bpy.data.materials.get(name) is not None:
        raise RuntimeError(f'a material named {name} is already in this Blender file; build with `pnpm art` instead')
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    return material, bsdf


def glossy(name, colour):
    """Glossy toy plastic: a clearcoat over a shiny base (pieces, die, crown, pads, props)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(colour)
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Coat Weight'].default_value = 0.9
    bsdf.inputs['Coat Roughness'].default_value = 0.15
    return material


def satin(name, colour):
    """Satin plastic: the same plastic with a softer sheen (tiles, island, bumpers, podium)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(colour)
    bsdf.inputs['Roughness'].default_value = 0.45
    bsdf.inputs['Coat Weight'].default_value = 0.0
    return material


def glow(name, colour, strength=1.5):
    """A lit accent: emission in the base colour (the dragon's eyes, rims, stars)."""
    material, bsdf = _material(name)
    bsdf.inputs['Base Color'].default_value = linear(colour)
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Emission Color'].default_value = linear(colour)
    bsdf.inputs['Emission Strength'].default_value = strength
    return material
```

Run: `pnpm vitest run art/test/palette.test.ts`
Expected: PASS.

- [ ] **Step 4: Shapes and export.** Create `art/lib/shapes.py`:

```python
"""Building blocks for the models (spec #5 §5).

Units are game units (1 tile = 1.6). Z is up and models face -Y (Blender's front view); the glTF
export turns that into Y up and +Z forward. Each builder returns one object with one material,
and export.finish() merges a model's parts into a single mesh.
"""
import math

import bmesh
import bpy
from mathutils import Matrix


def _object(name, bm, material, smooth=True):
    for face in bm.faces:
        face.smooth = smooth
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    return bpy.data.objects.new(name, mesh)


def revolve(name, profile, material, segments=48, smooth=True):
    """Turn a profile of (radius, height) points round the Z axis.

    A profile that starts and ends on the axis makes a closed solid (a pawn). A loop of points off
    the axis makes a ring (a hat band); its last point joins back to the first.
    """
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, h)) for r, h in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    if profile[0][0] > 0 and profile[-1][0] > 0:
        edges.append(bm.edges.new((verts[-1], verts[0])))
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0.0, 0.0, 1.0), cent=(0.0, 0.0, 0.0), steps=segments, angle=math.tau, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, material, smooth)


def sphere(name, radius, material, location=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0), segments=24, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    obj = _object(name, bm, material)
    obj.location = location
    obj.scale = scale
    return obj


def cone(name, radius, height, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), segments=16):
    """A cone on its base with its tip up (+Z) before rotation; the base centre is its origin."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=0.0, depth=height, matrix=Matrix.Translation((0.0, 0.0, height / 2)))
    obj = _object(name, bm, material)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def rounded_box(name, size, radius, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0), segments=4):
    """A box of size (x, y, z) centred on its origin, with edges rounded by `radius` (a bevel, applied at export)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    obj = _object(name, bm, material)
    bevel = obj.modifiers.new('round', 'BEVEL')
    bevel.width = radius
    bevel.segments = segments
    bevel.limit_method = 'NONE'
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def _bezier(commands):
    """A closed outline of M/L/Q commands as Bezier points: [point, left handle, right handle]."""
    points = []
    current = None
    for command in commands:
        kind = command[0]
        if kind == 'M':
            current = (command[1], command[2])
            points.append([current, current, current])
        elif kind == 'L':
            end = (command[1], command[2])
            points[-1][2] = _lerp(current, end, 1 / 3)
            points.append([end, _lerp(current, end, 2 / 3), end])
            current = end
        else:  # 'Q': a control point, then the end point
            control = (command[1], command[2])
            end = (command[3], command[4])
            points[-1][2] = _lerp(current, control, 2 / 3)
            points.append([end, _lerp(end, control, 2 / 3), end])
            current = end
    first, last = points[0], points[-1]
    if math.dist(first[0], last[0]) < 1e-6:
        # The outline ends where it began: the last point's incoming handle belongs to the first.
        first[1] = last[1]
        points.pop()
    else:
        last[2] = _lerp(last[0], first[0], 1 / 3)
        first[1] = _lerp(last[0], first[0], 2 / 3)
    return points


def outline(name, commands, depth, material, bevel=0.045, view='side', offset=(0.0, 0.0), resolution=12):
    """Extrude a closed outline drawn with M/L/Q commands (x across, y up) to `depth` in all, its
    edges rounded by `bevel` (the rounding grows the outline by `bevel` all round).

    view='side': x is the model's forward (-Y) and the outline is extruded across X (a knight's head).
    view='front': x is the model's right (+X) and the outline is extruded along Y (a meeple).
    `offset` moves the outline by (x, y) in its own drawing.
    """
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.resolution_u = resolution
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    curve.extrude = max(0.001, depth / 2 - bevel)
    points = _bezier(commands)
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    spline.use_cyclic_u = True
    spline.use_smooth = True
    for bp, (point, left, right) in zip(spline.bezier_points, points):
        bp.handle_left_type = 'FREE'
        bp.handle_right_type = 'FREE'
        bp.co = (point[0], point[1], 0.0)
        bp.handle_left = (left[0], left[1], 0.0)
        bp.handle_right = (right[0], right[1], 0.0)
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    dx, dy = offset
    if view == 'side':
        obj.rotation_euler = (math.pi / 2, 0.0, -math.pi / 2)
        obj.location = (0.0, -dx, dy)
    else:
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
        obj.location = (dx, 0.0, dy)
    return obj
```

Create `art/lib/export.py`:

```python
"""A clean scene per model, one merged mesh, and the glTF export (spec #5 §5)."""
import bmesh
import bpy

SCENE = 'ArtBuild'


def begin():
    """An empty scene for the next model.

    Headless (`pnpm art`, a factory-fresh Blender), the default scene is used. Through the Blender
    link a scene of its own, so the open file's objects are never touched; build.py switches back.
    """
    window = bpy.context.window
    if window is None:
        scene = bpy.context.scene
    else:
        scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
        window.scene = scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    _purge()
    return scene


def _purge():
    """Drop the data the last model left behind, so names like Seat stay free."""
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def finish(scene, model_id, parts, path):
    """Merge the parts into one mesh (modifiers and transforms applied), export it to `path`, and report."""
    for part in parts:
        scene.collection.objects.link(part)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    combined = bmesh.new()
    materials = []
    for part in parts:
        evaluated = part.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        remap = []
        for material in mesh.materials:
            if material not in materials:
                materials.append(material)
            remap.append(materials.index(material))
        piece = bmesh.new()
        piece.from_mesh(mesh)
        bmesh.ops.transform(piece, matrix=evaluated.matrix_world, verts=piece.verts)
        for face in piece.faces:
            face.material_index = remap[face.material_index]
        temp = bpy.data.meshes.new(f'{model_id}-part')
        piece.to_mesh(temp)
        piece.free()
        combined.from_mesh(temp)
        bpy.data.meshes.remove(temp)
        evaluated.to_mesh_clear()
    mesh = bpy.data.meshes.new(model_id)
    combined.to_mesh(mesh)
    combined.free()
    for material in materials:
        mesh.materials.append(material)
    for part in parts:
        bpy.data.objects.remove(part, do_unlink=True)
    scene.collection.objects.link(bpy.data.objects.new(model_id, mesh))
    mesh.calc_loop_triangles()
    heights = [v.co.z for v in mesh.vertices]
    _export(path)
    return {
        'id': model_id,
        'triangles': len(mesh.loop_triangles),
        'materials': [m.name for m in materials],
        'height': max(heights) - min(heights),
        'bytes': path.stat().st_size,
    }


def _export(path):
    """glTF binary of the scene: Y up, modifiers applied, no cameras, lights or animation, no UVs."""
    operator = bpy.ops.export_scene.gltf
    known = {p.identifier for p in operator.get_rna_type().properties}
    wanted = {
        'filepath': str(path),
        'export_format': 'GLB',
        'use_active_scene': True,
        'use_selection': False,
        'export_apply': True,
        'export_yup': True,
        'export_cameras': False,
        'export_lights': False,
        'export_animations': False,
        'export_materials': 'EXPORT',
        'export_texcoords': False,
        'export_normals': True,
        'export_extras': False,
    }
    operator(**{k: v for k, v in wanted.items() if k in known})
```

- [ ] **Step 5: The build, the preview and the command.** Create `art/build.py`:

```python
"""Build the game's Blender models (spec #5 §5).

Headless:  pnpm art [ids...]   (all of art/models/*.py when no id is given)
Blender link:
    BUILD = r'<repo>/art/build.py'
    g = {'__file__': BUILD, '__name__': '__main__', 'ART_IDS': ['pawn']}
    exec(compile(open(BUILD, encoding='utf-8').read(), BUILD, 'exec'), g)
    result = g['RESULT']

Each id names a script in art/models/ whose build() returns the model's parts; the parts are
merged and exported to apps/client/public/models/<id>.glb.
"""
import importlib
import sys
import traceback
from pathlib import Path

import bpy

ART = Path(__file__).resolve().parent
OUT = ART.parent / 'apps' / 'client' / 'public' / 'models'
if str(ART) not in sys.path:
    sys.path.insert(0, str(ART))


def fresh(name):
    """Import a module, reloading it when this Blender session already has it (the link keeps Python running)."""
    module = sys.modules.get(name)
    return importlib.reload(module) if module else importlib.import_module(name)


def requested_ids():
    ids = globals().get('ART_IDS')
    if ids is None:
        ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return list(ids) or sorted(p.stem for p in (ART / 'models').glob('*.py') if not p.stem.startswith('_'))


def main():
    for name in ('lib.palette', 'lib.finish', 'lib.shapes', 'lib.export'):
        fresh(name)
    export = sys.modules['lib.export']
    OUT.mkdir(parents=True, exist_ok=True)
    window = bpy.context.window
    home = window.scene if window else None
    report = []
    try:
        for model_id in requested_ids():
            scene = export.begin()
            parts = fresh(f'models.{model_id}').build()
            report.append(export.finish(scene, model_id, parts, OUT / f'{model_id}.glb'))
    finally:
        if window and home:
            window.scene = home
    for r in report:
        print(f"{r['id']:<8} {r['triangles']:>6} triangles  {len(r['materials'])} materials  {r['height']:.2f} tall  {r['bytes'] / 1024:.0f} KB")
    return report


if __name__ == '__main__':
    try:
        RESULT = main()
    except Exception:
        traceback.print_exc()
        if bpy.app.background:
            sys.exit(1)
        raise
```

Create `art/preview.py`:

```python
"""Render built models side by side to a PNG, for a quick look while modelling (spec #5 §7).

Headless:  blender --background --factory-startup --python art/preview.py -- out.png knight pawn
Blender link: exec it like build.py, with ART_IDS and PREVIEW_PATH in its globals.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ART = Path(__file__).resolve().parent
MODELS = ART.parent / 'apps' / 'client' / 'public' / 'models'
SCENE = 'ArtPreview'
GAP = 1.4


def arguments():
    ids = globals().get('ART_IDS')
    path = globals().get('PREVIEW_PATH')
    if path is None:
        rest = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
        path, ids = rest[0], rest[1:]
    return Path(path), list(ids)


def main():
    path, ids = arguments()
    window = bpy.context.window
    home = window.scene if window else None
    scene = bpy.context.scene if window is None else (bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE))
    if window:
        window.scene = scene
    try:
        for obj in list(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        for i, model_id in enumerate(ids):
            before = set(scene.objects)
            bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{model_id}.glb'))
            for obj in set(scene.objects) - before:
                if obj.parent is None:
                    obj.location.x += (i - (len(ids) - 1) / 2) * GAP
        camera = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
        scene.collection.objects.link(camera)
        distance = max(4.0, len(ids) * GAP * 1.6)
        camera.location = (distance * 0.5, -distance, 2.0)  # a three-quarter view: faces and profiles both show
        camera.rotation_euler = (Vector((0.0, 0.0, 0.55)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = camera
        sun = bpy.data.objects.new('PreviewSun', bpy.data.lights.new('PreviewSun', 'SUN'))
        sun.data.energy = 4.0
        sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-30))
        scene.collection.objects.link(sun)
        world = bpy.data.worlds.get('PreviewWorld') or bpy.data.worlds.new('PreviewWorld')
        world.use_nodes = True
        background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
        background.inputs[0].default_value = (0.03, 0.27, 0.26, 1.0)
        background.inputs[1].default_value = 0.7
        scene.world = world
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 600
        scene.view_settings.view_transform = 'Standard'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True, scene=scene.name)
    finally:
        if window and home:
            window.scene = home


if __name__ == '__main__':
    main()
```

Create `art/build.mjs`:

```js
// pnpm art [ids…]: rebuild the Blender models headless (spec #5 §5). Needs Blender 5.2: set
// BLENDER to its executable (e.g. E:\Software\Blender\blender.exe), or have `blender` on the PATH.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./build.py', import.meta.url));
const blender = process.env.BLENDER || 'blender';
const result = spawnSync(blender, ['--background', '--factory-startup', '--python', build, '--', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`Couldn't start Blender (${blender}). Set BLENDER to Blender's executable, e.g. E:\\Software\\Blender\\blender.exe.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
```

- **Root `package.json`:** add `"art": "node art/build.mjs",` after `deploy:cloudflare`.
- **`eslint.config.js`:** add `'art/**/*.mjs'` to the `files` of the Node-scripts block (the one with `process`, `console` and `URL`).
- **`.gitignore`:** add `__pycache__/`.

- [ ] **Step 6: The pawn.** Create `art/models/pawn.py`:

```python
"""The pawn (spec #5 §4.1): the mockup's turned pawn with a ball head, all in the seat colour."""
from lib import finish, palette, shapes

PROFILE = [(0, 0), (0.36, 0), (0.37, 0.04), (0.35, 0.1), (0.27, 0.13), (0.25, 0.18), (0.18, 0.22), (0.14, 0.34), (0.115, 0.5), (0.11, 0.56), (0.2, 0.6), (0.21, 0.63), (0.12, 0.67), (0, 0.67)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    return [
        shapes.revolve('body', PROFILE, seat),
        shapes.sphere('head', 0.19, seat, location=(0.0, 0.0, 0.82), segments=32, rings=20),
    ]
```

- [ ] **Step 7: Build it through the link.** Run through `execute_blender_code`:

```python
import bpy
BUILD = r'E:\AI Project\laddorious\art\build.py'
user = bpy.context.window.scene
before = sorted(o.name for o in user.objects)
g = {'__file__': BUILD, '__name__': '__main__', 'ART_IDS': ['pawn']}
exec(compile(open(BUILD, encoding='utf-8').read(), BUILD, 'exec'), g)
result = {'built': g['RESULT'], 'scene': bpy.context.window.scene.name, 'untouched': before == sorted(o.name for o in user.objects)}
```

Expected:
- `built` is one entry: `pawn`, about 2,000–2,600 triangles, `materials: ['Seat']`, height about 1.01;
- `scene` is `'Scene'` (the user's scene is shown again);
- `untouched` is `True` (Review Focus 5).

Then headless, to prove `pnpm art` works too:

```bash
BLENDER="E:/Software/Blender/blender.exe" pnpm art pawn
```

Expected: the same report line, and exit 0.

- [ ] **Step 8: Look at it.** Run `art/preview.py` through the link with `{'ART_IDS': ['pawn'], 'PREVIEW_PATH': r'<scratchpad>\preview-pawn.png'}` (as in Step 7), then Read the PNG. Expected: a pink, glossy pawn standing upright, seen from a three-quarter angle, base on the floor, no holes or dark seams. If the shading shows a seam, a hole or a flipped face, fix it in `shapes.revolve`, rebuild, and look again.

- [ ] **Step 9: Run the tests.**

Run: `pnpm vitest run art/test`
Expected: PASS; `pawn.glb keeps its contract`.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

Then `pnpm dev`, and pick the pawn in the browser pane: the menu podium shows the Blender pawn (glossier and smoother than the stand-in), and the console has no "asset slot" warning.

- [ ] **Step 10: Write the art README.** Create `art/README.md`:

````markdown
# Laddorious art

The game's 3D models (Spec #5), built from Blender Python scripts. Each script makes one model, and the build exports it to `apps/client/public/models/<id>.glb`, which the game loads through its asset slots. The `.glb` files are committed, so the game builds without Blender.

## Building

You need Blender 5.2.

```bash
pnpm art            # every model
pnpm art knight die # some of them
```

`pnpm art` runs Blender headless. Set `BLENDER` to its executable if `blender` isn't on your PATH (on this machine, `E:\Software\Blender\blender.exe`). The build prints each model's triangles, materials, height and size.

Claude can also build through the Blender link (MCP) by running `build.py` with `ART_IDS`; see the docstring at its top. That works in a scene of its own (`ArtBuild`) and switches back, so the open file's own objects are never touched. `preview.py` renders built models side by side to a PNG for a quick look.

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
````

- [ ] **Step 11: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models package.json eslint.config.js .gitignore && git commit -m "feat(art): the Blender build, and the pawn"` (with the trailer).

### Task 5: The knight, the meeple and the dragon head

The mockup's other three pieces. Their outlines are the mockup's own (the same outlines the HUD portraits use). The knight and the dragon carry their eyes; the dragon has gold glowing eyes and cream horns.

**Files:**
- Create: `art/models/knight.py`, `art/models/meeple.py`, `art/models/dragon.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** `lib.shapes`, `lib.finish`, `lib.palette`, the build (Task 4); the contract (Task 2).
- **Produces:** `knight.glb`, `meeple.glb`, `dragon.glb`, listed for `piece.knight`, `piece.meeple`, `piece.dragon`.

- [ ] **Step 1: List them (the failing test).** In `apps/client/src/assets/slotFiles.ts`:

```ts
export const SLOT_FILES: Partial<Record<SlotName, string>> = {
  'piece.knight': 'knight',
  'piece.pawn': 'pawn',
  'piece.meeple': 'meeple',
  'piece.dragon': 'dragon',
};
```

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "piece.knight is listed in slotFiles.ts but knight.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/knight.py`:

```python
"""The knight (spec #5 §4.1): the mockup's horse head on a round base, with dark eyes and a white shine."""
from lib import finish, palette, shapes

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.26, 0), ('L', 0.22, 0), ('Q', 0.24, 0.18, 0.16, 0.3), ('Q', 0.26, 0.38, 0.4, 0.42), ('Q', 0.5, 0.46, 0.46, 0.56),
        ('Q', 0.42, 0.64, 0.3, 0.66), ('Q', 0.2, 0.72, 0.14, 0.8), ('L', 0.06, 0.98), ('L', -0.02, 0.84),
        ('Q', -0.2, 0.82, -0.28, 0.6), ('Q', -0.34, 0.36, -0.26, 0)]
DEPTH = 0.36            # the head's full thickness, side to side
HEAD_AT = (-0.08, 0.2)  # (forward, up): where the head outline sits on the base
EYE = (0.22, 0.7)       # in the head outline


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    parts = [
        shapes.revolve('base', BASE, seat),
        shapes.outline('head', HEAD, DEPTH, seat, view='side', offset=HEAD_AT),
    ]
    forward = EYE[0] + HEAD_AT[0]
    up = EYE[1] + HEAD_AT[1]
    side = DEPTH / 2 - 0.005  # half sunk into the cheek
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.042, eye, location=(s * side, -forward, up)))
        parts.append(shapes.sphere(f'shine{s}', 0.014, shine, location=(s * (side + 0.03), -(forward + 0.01), up + 0.015), segments=8, rings=6))
    return parts
```

Create `art/models/meeple.py`:

```python
"""The meeple (spec #5 §4.1): the mockup's chunky meeple, seen from the front and rounded all round."""
from lib import finish, palette, shapes

BODY = [('M', -0.36, 0), ('L', -0.1, 0), ('Q', 0, 0.24, 0.1, 0), ('L', 0.36, 0), ('Q', 0.3, 0.2, 0.2, 0.34),
        ('Q', 0.42, 0.38, 0.4, 0.5), ('Q', 0.36, 0.6, 0.16, 0.6), ('Q', 0.24, 0.74, 0.16, 0.84), ('Q', 0, 0.96, -0.16, 0.84),
        ('Q', -0.24, 0.74, -0.16, 0.6), ('Q', -0.36, 0.6, -0.4, 0.5), ('Q', -0.42, 0.38, -0.2, 0.34), ('Q', -0.3, 0.2, -0.36, 0)]
DEPTH = 0.34


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    # Lifted by the rounding, so the feet rest on the floor.
    return [shapes.outline('body', BODY, DEPTH, seat, view='front', offset=(0.0, 0.045))]
```

Create `art/models/dragon.py`:

```python
"""The dragon head (spec #5 §4.1): the mockup's spiky head on a round base, with gold glowing eyes,
dark pupils and cream horns."""
from lib import finish, palette, shapes

BASE = [(0, 0), (0.34, 0), (0.36, 0.04), (0.34, 0.1), (0.27, 0.13), (0.24, 0.18), (0.22, 0.21), (0, 0.21)]
HEAD = [('M', -0.2, 0), ('L', 0.16, 0), ('Q', 0.1, 0.22, 0.2, 0.36), ('L', 0.42, 0.42), ('L', 0.55, 0.47), ('L', 0.4, 0.52),
        ('L', 0.56, 0.58), ('Q', 0.6, 0.66, 0.48, 0.68), ('Q', 0.34, 0.7, 0.22, 0.8), ('Q', 0.12, 0.9, 0, 0.88),
        ('Q', -0.12, 0.86, -0.16, 0.76), ('L', -0.31, 0.74), ('L', -0.22, 0.63), ('L', -0.35, 0.56), ('L', -0.25, 0.45),
        ('L', -0.34, 0.36), ('L', -0.23, 0.27), ('Q', -0.28, 0.12, -0.2, 0)]
DEPTH = 0.4
HEAD_AT = (-0.08, 0.2)
EYE = (0.2, 0.75)


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    gold = finish.glow('Glow', palette.GOLD, 1.2)
    pupil = finish.glossy('Eye', palette.INK)
    horn = finish.glossy('Horn', palette.CREAM)
    parts = [
        shapes.revolve('base', BASE, seat),
        shapes.outline('head', HEAD, DEPTH, seat, view='side', offset=HEAD_AT),
    ]
    forward = EYE[0] + HEAD_AT[0]
    up = EYE[1] + HEAD_AT[1]
    side = DEPTH / 2 - 0.005
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.058, gold, location=(s * side, -forward, up)))
        parts.append(shapes.sphere(f'pupil{s}', 0.032, pupil, location=(s * (side + 0.035), -(forward + 0.01), up), scale=(0.6, 0.45, 1.0), segments=12, rings=8))
        # Horns sweep back from the top of the head and lean out a little.
        parts.append(shapes.cone(f'horn{s}', 0.055, 0.32, horn, location=(s * 0.075, -0.025, 0.985), rotation=(-0.9, s * 0.25, 0.0)))
    return parts
```

- [ ] **Step 3: Build them through the link.** Run Task 4's build snippet with `'ART_IDS': ['knight', 'meeple', 'dragon']`.

Expected:
- three entries, each 1,500–5,000 triangles;
- materials: knight `['Seat', 'Eye', 'Shine']`, meeple `['Seat']`, dragon `['Seat', 'Glow', 'Eye', 'Horn']`;
- heights: knight about 1.2, meeple about 1.0, dragon about 1.15;
- `untouched: True`.

- [ ] **Step 4: Look at them.** Run `art/preview.py` through the link with `ART_IDS: ['knight', 'pawn', 'meeple', 'dragon']`, then Read the PNG. Check that:
- each piece faces forward (−Y in Blender), toward the camera's side of the row, seen from a three-quarter angle;
- the eyes sit on the cheeks, half sunk, not floating;
- the horns sweep back from the top of the dragon's head;
- nothing has holes, inside-out faces or dark seams.

If a part sits wrong (an eye floating, a horn inside the head), adjust that script's numbers, rebuild, and look again. Ledger the change as a ruling.

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run art/test`
Expected: PASS; four `keeps its contract` lines.

Then `pnpm test`. Expected: all green.

Then in the dev server, cycle the podium through the four pieces: each shows its Blender model, and the console stays clean.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the knight, the meeple and the dragon head"` (with the trailer).

### Task 6: The rook, the top hat and the rubber duck

**Files:**
- Create: `art/models/rook.py`, `art/models/hat.py`, `art/models/duck.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:** the build and helpers (Task 4); the contract (Task 2); the new slots (Task 1).
- **Produces:** `rook.glb`, `hat.glb`, `duck.glb`, listed for `piece.rook`, `piece.hat`, `piece.duck`.

- [ ] **Step 1: List them (the failing test).** Add to `SLOT_FILES` in `apps/client/src/assets/slotFiles.ts`:

```ts
  'piece.rook': 'rook',
  'piece.hat': 'hat',
  'piece.duck': 'duck',
```

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "piece.rook is listed in slotFiles.ts but rook.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/rook.py`:

```python
"""The rook (spec #5 §4.1): a chess castle tower with four chunky battlements and a dark door."""
import math

from lib import finish, palette, shapes

TOWER = [(0, 0), (0.4, 0), (0.42, 0.05), (0.4, 0.1), (0.31, 0.14), (0.28, 0.2), (0.24, 0.6), (0.31, 0.64), (0.33, 0.68), (0.33, 0.84), (0, 0.84)]


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    door = finish.glossy('Door', palette.INK)
    parts = [shapes.revolve('tower', TOWER, seat)]
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        parts.append(shapes.rounded_box(f'merlon{i}', (0.17, 0.17, 0.16), 0.04, seat, location=(0.24 * math.cos(a), 0.24 * math.sin(a), 0.91), rotation=(0.0, 0.0, a)))
    # On the front (-Y), where the tower is about 0.27 across.
    parts.append(shapes.rounded_box('door', (0.13, 0.05, 0.2), 0.025, door, location=(0.0, -0.27, 0.3)))
    return parts
```

Create `art/models/hat.py`:

```python
"""The top hat (spec #5 §4.1): the classic board-game token, a tall hat with a dark band."""
from lib import finish, palette, shapes

HAT = [(0, 0), (0.46, 0), (0.485, 0.035), (0.46, 0.07), (0.3, 0.085), (0.275, 0.1), (0.27, 0.9), (0.255, 0.95), (0.2, 0.965), (0, 0.97)]
BAND = [(0.274, 0.12), (0.292, 0.12), (0.292, 0.27), (0.274, 0.27)]  # a ring round the crown


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    band = finish.glossy('Band', palette.INK)
    return [shapes.revolve('hat', HAT, seat, segments=56), shapes.revolve('band', BAND, band, segments=56)]
```

Create `art/models/duck.py`:

```python
"""The rubber duck (spec #5 §4.1): a round body and head in the seat colour, a tangerine beak, a
tail, and the knight's dark eyes with a white shine."""
from lib import finish, palette, shapes


def build():
    seat = finish.glossy('Seat', palette.SEAT)
    beak = finish.glossy('Beak', palette.TANGERINE)
    eye = finish.glossy('Eye', palette.INK)
    shine = finish.glow('Shine', palette.WHITE, 1.0)
    parts = [
        # The body's bottom (0.34 x 0.75 below its centre) rests on the floor.
        shapes.sphere('body', 0.34, seat, location=(0.0, 0.0, 0.255), scale=(0.9, 1.15, 0.75), segments=28, rings=18),
        shapes.sphere('head', 0.2, seat, location=(0.0, -0.12, 0.72), segments=24, rings=16),
        shapes.sphere('beak', 0.09, beak, location=(0.0, -0.33, 0.68), scale=(1.1, 1.6, 0.45), segments=16, rings=10),
        # The tail tips up and back (+Y).
        shapes.cone('tail', 0.1, 0.22, seat, location=(0.0, 0.36, 0.38), rotation=(-0.8, 0.0, 0.0)),
    ]
    for s in (1, -1):
        parts.append(shapes.sphere(f'eye{s}', 0.045, eye, location=(s * 0.11, -0.27, 0.76), segments=12, rings=8))
        parts.append(shapes.sphere(f'shine{s}', 0.015, shine, location=(s * 0.125, -0.3, 0.78), segments=8, rings=6))
    return parts
```

- [ ] **Step 3: Build them through the link** (Task 4's snippet, `'ART_IDS': ['rook', 'hat', 'duck']`).

Expected:
- three entries under 5,000 triangles;
- materials: rook `['Seat', 'Door']`, hat `['Seat', 'Band']`, duck `['Seat', 'Beak', 'Eye', 'Shine']`;
- heights: rook about 1.0, hat about 0.97, duck about 0.92;
- `untouched: True`.

- [ ] **Step 4: Look at all seven.** Run `art/preview.py` with `ART_IDS: ['knight', 'pawn', 'meeple', 'dragon', 'rook', 'hat', 'duck']` and Read the PNG. Check that:
- the three new pieces read as a castle tower, a top hat and a rubber duck;
- they sit at the same scale as the four;
- the duck's eyes and beak face forward (−Y), like the knight's;
- nothing floats or sinks.

Adjust numbers and rebuild if not; ledger each change as a ruling.

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run art/test`, then `pnpm test`
Expected: PASS; seven pieces keep their contract.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the rook, the top hat and the rubber duck"` (with the trailer).

### Task 7: The die and the crown

**Files:**
- Create: `art/models/die.py`, `art/models/crown.py`, and their built `.glb` files
- Modify: `apps/client/src/assets/slotFiles.ts`

**Interfaces:**
- **Consumes:**
  - the build (Task 4);
  - the contract's die rules (middle at the origin, one-pip face up: Task 2);
  - the die and crown slots readied in Task 3 (flash, base origin).
- **Produces:** `die.glb`, `crown.glb`, listed for `die` and `crown`.

- [ ] **Step 1: List them (the failing test).** Add to `SLOT_FILES`:

```ts
  die: 'die',
  crown: 'crown',
```

Run: `pnpm vitest run art/test/files.test.ts`
Expected: FAIL: "die is listed in slotFiles.ts but die.glb isn't built".

- [ ] **Step 2: Write the models.** Create `art/models/die.py`:

```python
"""The die (spec #5 §4.1): a rounded cream die with dark sunken pips and a pink single pip.

Faces follow the game's map (DIE_FACES, dieRotationFor): in the game's axes +Y 1, -Y 6, +X 3,
-X 4, +Z 2, -Z 5. Blender's +Z is the game's +Y and Blender's -Y the game's +Z, which gives the
table below. Its middle is the origin: the die tumbles round it.
"""
from lib import finish, palette, shapes

SIZE = 0.5
SPACING = 0.13
# value: (outward normal, across, up) in Blender axes
FACES = {
    1: ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
    6: ((0, 0, -1), (1, 0, 0), (0, -1, 0)),
    3: ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
    4: ((-1, 0, 0), (0, -1, 0), (0, 0, 1)),
    2: ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    5: ((0, 1, 0), (-1, 0, 0), (0, 0, 1)),
}
PIPS = {
    1: [(0, 0)],
    2: [(-1, -1), (1, 1)],
    3: [(-1, -1), (0, 0), (1, 1)],
    4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
    5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
    6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)],
}


def build():
    body = finish.glossy('Body', palette.CREAM)
    pip = finish.glossy('Pip', palette.INK)
    one = finish.glossy('One', palette.SEAT)
    parts = [shapes.rounded_box('die', (SIZE, SIZE, SIZE), 0.08, body)]
    for value, (normal, across, up) in FACES.items():
        for i, (a, b) in enumerate(PIPS[value]):
            centre = tuple(normal[k] * (SIZE / 2 - 0.012) + across[k] * a * SPACING + up[k] * b * SPACING for k in range(3))
            flat = tuple(1 - abs(normal[k]) * 0.7 for k in range(3))  # pressed flat into the face
            radius = 0.075 if value == 1 else 0.05
            parts.append(shapes.sphere(f'pip{value}{i}', radius, one if value == 1 else pip, location=centre, scale=flat, segments=8, rings=4))
    return parts
```

Create `art/models/crown.py`:

```python
"""The crown on the last tile (spec #5 §4.1): a flared gold band with five ball-tipped points and
pink gems, standing on its base."""
import math

from lib import finish, palette, shapes

BAND = [(0.36, 0), (0.44, 0), (0.5, 0.3), (0.42, 0.3)]  # a flared ring, its section a loop


def build():
    gold = finish.glossy('Gold', palette.GOLD)
    gem = finish.glossy('Gem', palette.SEAT)
    parts = [shapes.revolve('band', BAND, gold, segments=40)]
    for i in range(5):
        a = i * math.tau / 5
        x, y = 0.46 * math.cos(a), 0.46 * math.sin(a)
        parts.append(shapes.cone(f'point{i}', 0.1, 0.26, gold, location=(x, y, 0.28), segments=12))
        parts.append(shapes.sphere(f'ball{i}', 0.05, gold, location=(x, y, 0.56), segments=12, rings=8))
        g = a + math.pi / 5
        parts.append(shapes.sphere(f'gem{i}', 0.045, gem, location=(0.47 * math.cos(g), 0.47 * math.sin(g), 0.15), segments=12, rings=8))
    return parts
```

- [ ] **Step 3: Build them through the link** (`'ART_IDS': ['die', 'crown']`).

Expected:
- die: under 2,000 triangles, `['Body', 'Pip', 'One']`, 0.5 tall;
- crown: under 3,000 triangles, `['Gold', 'Gem']`, about 0.6 tall;
- `untouched: True`.

- [ ] **Step 4: Look at them.** Preview `['die', 'crown']` and Read it. Check that:
- the single pink pip is on top;
- the die's front (facing the camera's side) shows two pips;
- the crown stands on its base with five points.

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run art/test`, then `pnpm test`
Expected: PASS; `die.glb keeps its contract`, including the one-pip-on-top check (Review Focus 1).

Then in the dev server, play a match and watch a roll:
- the Blender die tumbles above each piece and lands on the rolled face; check one roll against the feed line;
- a forced face (Loaded Die) flashes gold;
- the crown spins on tile 100.

- [ ] **Step 6: Commit.** `git add -A art apps/client/src/assets/slotFiles.ts apps/client/public/models && git commit -m "feat(art): the die and the crown"` (with the trailer).

### Task 8: Browser checks and the review screenshots

**Files:**
- Create: `apps/client/e2e/shots.spec.ts`
- Modify:
  - `apps/client/src/app/testMode.ts` (`triangles()`), `apps/client/test/testMode.test.tsx`, `apps/client/test/App.test.tsx` (its hand-made hooks);
  - `apps/client/e2e/game.spec.ts`, `apps/client/playwright.config.ts`;
  - `package.json` (`shots`).

**Interfaces:**
- **Consumes:** all the models (Tasks 4–7); `renderStats.triangles` (already kept by the stats overlay).
- **Produces:**
  - `TestHooks.triangles(): number`;
  - the Playwright project `shots`, and `pnpm shots`, which writes PNGs to `apps/client/test-results/shots/`.

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/testMode.test.tsx`, in "speeds the match up and reports the draw calls":
- rename it "speeds the match up and reports the draw calls and triangles";
- set `renderStats.setState({ calls: 42, triangles: 61_000 });`;
- add `expect(window.__laddoriousTest!.triangles()).toBe(61_000);`.

In `apps/client/test/App.test.tsx`, add `triangles: () => 0,` to the hand-made `test={{ … }}` hooks.

In `apps/client/e2e/game.spec.ts`:
- in "plays a whole match against the bots…", start with:

```ts
  const slotWarnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('asset slot')) slotWarnings.push(m.text());
  });
```

  and end with `expect(slotWarnings).toEqual([]); // every Blender model loaded (spec #5 §6)`;
- replace the draw-call test with:

```ts
test('keeps a match within 100 draw calls and 150,000 triangles, models included (spec #2 §6.4)', async ({ page }) => {
  await startMatch(page);
  const calls: number[] = [];
  const triangles: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    calls.push(await page.evaluate(() => window.__laddoriousTest?.drawCalls() ?? -1));
    triangles.push(await page.evaluate(() => window.__laddoriousTest?.triangles() ?? -1));
  }
  expect(Math.max(...calls)).toBeGreaterThan(0);
  expect(Math.max(...calls)).toBeLessThanOrEqual(100);
  expect(Math.max(...triangles)).toBeGreaterThan(0);
  expect(Math.max(...triangles)).toBeLessThanOrEqual(150_000);
});
```

- add:

```ts
test('fits the seven-piece picker beside PLAY on a landscape phone (spec #5 §4.1)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  const picker = await page.getByRole('group', { name: 'Choose your piece' }).boundingBox();
  const play = await page.getByRole('button', { name: 'PLAY' }).boundingBox();
  expect(picker).not.toBeNull();
  expect(play).not.toBeNull();
  expect(picker!.x).toBeGreaterThanOrEqual(0);
  expect(picker!.x + picker!.width).toBeLessThanOrEqual(play!.x);
});
```

Run: `pnpm vitest run apps/client/test/testMode.test.tsx`
Expected: FAIL: `triangles` is not a function.

- [ ] **Step 2: Implement the hook.** In `apps/client/src/app/testMode.ts`:
- add `/** The triangles drawn in the last frames, for the 150k check (spec #2 §6.4). */ triangles(): number;` to `TestHooks`;
- add `triangles: () => renderStats.getState().triangles` to the hooks object.

Run: `pnpm vitest run apps/client/test/testMode.test.tsx apps/client/test/App.test.tsx`
Expected: PASS.

- [ ] **Step 3: The screenshots.** Create `apps/client/e2e/shots.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

// Screenshots for the user's review after each art step (spec #5 §7). Run with `pnpm shots`; the
// PNGs land in apps/client/test-results/shots/ (not committed).

const OUT = 'test-results/shots';
const PIECES = ['Knight', 'Pawn', 'Meeple', 'Dragon head', 'Rook', 'Top hat', 'Rubber duck'];
const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

test('the menu podium with each piece', async ({ page }) => {
  await page.goto('/');
  for (const name of PIECES) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(1200); // the podium swaps pieces with a little hop
    await page.screenshot({ path: `${OUT}/menu-${slug(name)}.png` });
  }
});

test('the menu on a landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/menu-phone.png` });
});

test('a match: the overview and a close-up', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.clock.fastForward('00:16');
  await page.getByRole('button', { name: 'Play with bots' }).click();
  await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/match-overview.png` });
  await page.getByRole('button', { name: /^Mochi,/ }).click(); // the camera watches a bot's piece
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/match-closeup.png` });
});
```

In `apps/client/playwright.config.ts`:
- make the three offline projects' `testIgnore` `/(online|shots)\.spec\.ts/`;
- add the project:

```ts
    { name: 'shots', testMatch: /shots\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
```

In the root `package.json`, add after `e2e`: `"shots": "pnpm --filter @laddorious/client exec playwright test --project shots",`.

- [ ] **Step 4: Run them.**

Run: `pnpm e2e` (about 7 minutes)
Expected: 14 passed:
- 3 projects × 4 tests: the old three, plus the picker fit;
- 2 online tests.

The whole-match test logs no slot warnings; the budget test stays within 100 draw calls and 150,000 triangles.

If the picker test fails on a phone, narrow the picker tiles in `menu.css` and run it again (ledger the size).

Run: `pnpm shots`
Expected: 3 passed, and `apps/client/test-results/shots/` holds:
- `menu-knight.png` … `menu-rubber-duck.png` (7);
- `menu-phone.png`;
- `match-overview.png`;
- `match-closeup.png`.

Read a few of them: the Blender pieces show on the podium and on the board.

- [ ] **Step 5: Commit.** `git add -A apps/client package.json && git commit -m "test(e2e): model budgets, slot warnings, the picker on phones, and review shots"` (with the trailer).

### Task 9: Docs, the gate, and the Step 1 review

**Files:**
- Modify:
  - `apps/client/README.md`: rewrite "Asset slots and `.glb` models" for `slotFiles.ts`, the art build, `prepareModel`, preloading, and the stand-ins in unit tests;
  - `README.md`: the repo map gains `art/`; the scripts gain `pnpm art` and `pnpm shots`; the intro's Spec #5 line;
  - `docs/superpowers/HANDOFF.md`: Spec #5 step 1 state, and what happens after the review.

- [ ] **Step 1: Write the docs.**
- **`apps/client/README.md`:** replace the "Asset slots and `.glb` models" section with:

````markdown
## Asset slots and Blender models

Every model sits in a named slot with a code-built stand-in (`src/assets/slots.tsx`, `src/assets/models.ts`). The Blender models (Spec #5) are built from scripts in [`art/`](../../art/README.md) into `public/models/<id>.glb`.

- **`src/assets/slotFiles.ts`** lists which slots have a model, and its id.
- **Loading:** a listed slot loads its model with drei's `useGLTF`, and the menu preloads them all. While a model loads, or if it fails, the stand-in shows and a warning is logged once.
- **`prepareModel`** readies each model's materials:
  - `Seat` takes the player's colour;
  - on Low quality, glossy plastic drops its clearcoat;
  - the die's materials can flash.
- **Unit tests** (Vitest) always use the stand-ins. The art tests (`art/test`) check every model file against its contract instead: size, origin, triangles and material names.
- **Review screenshots:** `pnpm shots` saves the menu and a match to `test-results/shots/`, for reviewing a model change.
````

- **`README.md`:**
  - in the repository map, add a row: `art/` | — | "The Blender build scripts for the game's 3D models, and their contract tests. [README](art/README.md)";
  - in the scripts block, add `pnpm art         # rebuild the Blender models (needs Blender 5.2; see art/README.md)` and `pnpm shots       # screenshots of the menu and a match, for reviewing models`;
  - in the intro, add "- **Spec #5 (in progress):** the art pass, Blender models for the pieces, the board and the world ([design](docs/superpowers/specs/2026-10-09-art-pass-design.md))." and change "The art pass (Spec #5) comes later." to remove it.
- **`docs/superpowers/HANDOFF.md`:** a Spec #5 row ("Step 1 of 3 done: pipeline, seven pieces, die, crown; awaiting the user's review"). Next step: the user reviews the Step 1 shots, then plan 2 (the board) is written from the spec and the review. Add the Step 1 self-review's deferred minors to Open items.

- [ ] **Step 2: Gate.**
  - Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e`. Expected: all green; e2e 14 passed.
  - Run `BLENDER="E:/Software/Blender/blender.exe" pnpm art` (a clean rebuild of all nine models). Expected: nine report lines, `git status` shows no changed `.glb` (the build is repeatable), and `pnpm vitest run art/test` passes.
- [ ] **Step 3: Commit.** `git commit -am "docs: the art build, and the hand-off for spec #5 step 1"` (with the trailer).
- [ ] **Step 4: The review.**
  - Run `pnpm shots`.
  - Put the PNGs on an artifact page: the seven pieces on the podium, the phone menu, the match overview and the close-up. Use the same page style as the design artifact, with the images embedded.
  - Send the user the link, and say what they're looking at.
  - **Stop.** Plan 2 (the board) starts only after the user approves or asks for changes. Changes the user asks for in Step 1 models are made before plan 2, with the same build and checks.

After Task 9 (and the user's approval):
1. Self-review the branch against this plan's Review Focus, and say it was a self-review.
2. Fast-forward merge `art/spec-5` into `main` locally, and run the suite on `main`.
3. Keep the branch for Steps 2 and 3, or start a fresh one from `main` for plan 2.
4. Update memory (`handoff`, `blender-for-3d-objects`).
