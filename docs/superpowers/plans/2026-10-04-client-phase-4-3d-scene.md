# Phase 4 — The 3D Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** A full bot match animated in 3D (board, pieces, slides, pads, dice, camera rules, asset slots, quality levels, dev overlay) with a minimal ROLL button, on the dev page.

**Architecture:** Every rule that can be pure TypeScript is, and is unit-tested in Node:

- the board layout (`scene/layout.ts`);
- graphics quality and the Auto step-down (`scene/quality.ts`);
- the code-built models (`assets/models.ts`);
- each piece's pose through every beat (`scene/motion.ts`);
- the camera rules (`scene/camera.ts`).

React Three Fiber components then draw that state thinly. They read the Phase 3 director's Zustand store once per frame in `useFrame`, so animation never re-renders React. Asset slots (§6.3) wrap every model so Spec #4's `.glb` files can replace the built-in models. A scene-graph test, using `@react-three/test-renderer`, holds the scene to the phone budget.

**Tech Stack:** three.js 0.186, React Three Fiber 9.8, drei 10.7 (`useGLTF`), `@react-three/test-renderer` 9.1, React 19, Zustand 5, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md`: §5.3 camera, §6 scene, assets and performance, §5.1 beats (the animations), §8 (WebGL unavailable, context lost, `.glb` failures), §9.1 (quality tests). Phase index: `docs/superpowers/plans/2026-10-04-3d-client-phases.md`.

**How this plan was run:** under the user's standing order of 2026-10-04 (memory `continue-through-phase-6`), it is executed straight after it is written and merged locally when done.

## Global Constraints

- 1 tile = 1.6 world units; 100 tiles in a serpentine 10×10 grid, drawn as one instanced draw call (§6.1, §6.3).
- Classic square colours repeat diagonally: `#ff5a5f #ffa22e #ffd83b #4fd16a #4a9dff`. Tile 100 is gold, with a spinning crown. "?" squares are `#8f4dff` with a painted "?" in the rarity colour (Common white, Rare `#6ff3ff`, Epic `#ffcc33`). One transparent overlay texture paints all numbers and glyphs. A landed-on "?" square gets a pulsing ring until the Mystery phase ends.
- Slides are flat ribbons with scrolling chevrons, dark `#2a2140` with an ink edge, with a spinning vortex at the head and an exit ring at the tail; nothing stands taller than a piece. Launch pads are a disc with chevrons, an instanced dotted arc and a target ring. A floating island with instanced bumpers, a few clouds and a gradient sky surround the board.
- Pieces: knight, pawn, meeple and dragon head from extrusions and lathes, in glossy clearcoat plastic in the seat colour, at 1.3 × base scale, each under 5k triangles, with the origin at the feet, +Z forward and Y up (§6.2, §6.3).
- Asset slots: `piece.knight`, `piece.pawn`, `piece.meeple`, `piece.dragon`, `die`, `pad`, `slide.vortex`, `crown`, `island`. Each has a code-built default and an optional `.glb` loaded with drei's `useGLTF` inside Suspense. A load failure falls back to the default and logs a warning, and a material named `Seat` takes the player colour.
- Quality (§6.4): **High** = one directional light with a 1024 shadow map, pixel density cap 2, antialiasing. **Low** = no shadows, soft blob shadows under pieces, cap 1.5, fewer clouds. **Auto** starts Low on phones (a coarse pointer and a short screen side under 500 px) and High otherwise, and steps down to Low when the frame rate averages under 45 fps for 5 s.
- Budget: at most 100 draw calls and 150k visible triangles in a match. A dev-only overlay shows fps, draw calls and triangles.
- Camera (§5.3): the whole board during the dice phase, with a gentle drift; it follows your own piece at medium distance while moves and cards resolve; it swoops only for your own moments (your collision, your slide or launch, cards that target you, your Mystery pick). Watch mode follows another piece. With reduced motion, swoops become cuts and the drift and idle wobble stop.
- §8: without WebGL, the message "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox." replaces the canvas; a lost context that doesn't restore shows the same message.
- Colours come only from tokens: `src/app/theme.ts` for the 3D world, CSS custom properties for the page.
- Touch first: the ROLL button is at least 44 px tall. Space-to-roll is a Phase 5 desktop extra.
- The user okayed making models with the Blender MCP but asked to keep the plan unchanged. Phase 4 ships the code-built defaults; `.glb` files arrive through the slots in the Spec #4 art pass.
- pnpm 11's release-age gate applies (caret ranges with old-enough floors). Lockfile changes are committed with their task.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `client/phase-4` from the repository root, inline, with no subagents; every review is a self-review. Read test counts with `grep -E "Test Files|Tests "`.

## Review Focus

1. **A phone that can't keep up.** Expected: Auto drops to Low (no shadows, density cap 1.5, fewer clouds) once the frame rate averages under 45 fps for 5 s, but never because of one long stall such as a tab switch. Pinned in Task 2.
2. **A board crowded with snakes and ladders, or a card adding more.** Expected: still within 100 draw calls and 150k triangles. All slides share one ribbon mesh and all pad parts are instanced, capped at 24 jumps and 480 dots. Pinned in Task 7: a budget test on a board with 60 long jumps, plus the real generated board on High and Low.
3. **A browser without WebGL.** Expected: the §8 message, not a blank page or a crash. Pinned in Task 7 (jsdom has no WebGL).
4. **A `.glb` that fails to load** (Spec #4 drops in a bad file). Expected: the built-in model shows and a warning is logged. Pinned in Task 4.
5. **Double-tapping ROLL.** Expected: one roll per window; the button hides once it is pressed. Pinned in Task 8.

## Interpretation notes

- **When "?" rings show.** The view can't tell when a landing happened, so a ring pulses on every "?" square with a piece on it while the settled phase is the settle or Mystery phase. Rings clear when the next dice phase starts.
- **Card moves are one leap.** A `Moved(card)` event doesn't say whether the move was absolute or relative, so every card move is a single leap arc; the spec's per-tile hops for relative moves aren't distinguishable.
- **Popping board edits.** During a board-edit beat, the slide and pad parts that the edit adds pop in, and the ones it removes shrink away. The merged slide ribbons swap when the beat ends.
- **Dice stay up until the moves.** A die stays above its piece from its roll beat until the first non-roll beat of the dice phase (the moves).
- **Antialiasing is fixed at mount.** It is set when the WebGL context is created. The dev page remounts the scene (a new `key`) when the quality setting changes; Auto's step-down changes shadows, density and clouds live.
- **The 3D part of a card resolution.** A projectile flies from the caster to a target that isn't the caster; the target hops on a hit, and its shield flares on a block. The "Hit / Blocked / Fizzled" stamp, the clash banner and the popups are HUD work for Phase 5.

---

## Before Task 1: commit the plan

- [ ] **Commit the plan, the phase index row and the handoff note**

```bash
git add docs/superpowers/plans/2026-10-04-client-phase-4-3d-scene.md docs/superpowers/plans/2026-10-04-3d-client-phases.md docs/superpowers/HANDOFF.md
git commit -m "docs: add the phase 4 plan (3D scene)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Board layout and world colours

**Files:**
- Create: `apps/client/src/scene/layout.ts`, `apps/client/test/layout.test.ts`
- Modify: `apps/client/src/app/theme.ts`, `apps/client/package.json` (three, through `pnpm add`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing from earlier phases.
- Produces:
  - `type Vec3 = [number, number, number]`.
  - `TILE_SIZE = 1.6` and `COLUMNS = 10`.
  - `tileCell(tile: number): { col: number; row: number }`.
  - `tileToWorld(tile: number, seat?: number): Vec3`: the top-face centre; tile 0 is a start spot per seat.
  - `squareColorIndex(tile: number, colours: number): number`.
  - `tilePath(from: number, to: number, bounced: boolean, size: number): number[]`.
  - `slideCurve(from: number, to: number): CatmullRomCurve3`.
  - `arcPoint(from: Vec3, to: Vec3, s: number, height: number): Vec3`.
  - `WORLD_COLORS` in `theme.ts`.

- [ ] **Step 1: Add three.js**

Run: `pnpm --filter @laddorious/client add three@^0.186.1 && pnpm --filter @laddorious/client add -D @types/three@^0.186.0`
Expected: completes without errors or peer warnings.

- [ ] **Step 2: Write the failing test**

Create `apps/client/test/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COLUMNS, TILE_SIZE, slideCurve, squareColorIndex, tileCell, tilePath, tileToWorld } from '../src/scene/layout';

function expectAt(point: number[], x: number, z: number) {
  expect(point[0]).toBeCloseTo(x);
  expect(point[1]).toBeCloseTo(0);
  expect(point[2]).toBeCloseTo(z);
}

describe('board layout (spec #2 §6.1)', () => {
  it('lays the tiles on a serpentine 10×10 grid, 1.6 units apart, tile 1 at the front left', () => {
    expectAt(tileToWorld(1), -7.2, 7.2);
    expectAt(tileToWorld(10), 7.2, 7.2);
    expectAt(tileToWorld(11), 7.2, 5.6);
    expectAt(tileToWorld(100), -7.2, -7.2);
    expect(TILE_SIZE * COLUMNS).toBeCloseTo(16);
  });

  it('puts one start spot per seat in front of the board', () => {
    const spots = [0, 1, 2, 3].map((seat) => tileToWorld(0, seat));
    expect(new Set(spots.map((s) => s[0])).size).toBe(4);
    for (const spot of spots) expect(spot[2]).toBeGreaterThan(tileToWorld(1)[2] + TILE_SIZE / 2);
  });

  it('repeats the square colours along diagonals', () => {
    expect(tileCell(1)).toEqual({ col: 0, row: 0 });
    expect(tileCell(20)).toEqual({ col: 0, row: 1 });
    expect(squareColorIndex(2, 5)).toBe(squareColorIndex(20, 5));
    expect(squareColorIndex(1, 5)).not.toBe(squareColorIndex(2, 5));
  });

  it('walks a move tile by tile, up to the last tile and back on a bounce', () => {
    expect(tilePath(3, 6, false, 100)).toEqual([3, 4, 5, 6]);
    expect(tilePath(9, 6, false, 100)).toEqual([9, 8, 7, 6]);
    expect(tilePath(97, 98, true, 100)).toEqual([97, 98, 99, 100, 99, 98]);
  });

  it('lays a slide from its head to its tail', () => {
    const curve = slideCurve(47, 26);
    const head = curve.getPoint(0);
    const tail = curve.getPoint(1);
    expectAt([head.x, head.y, head.z], tileToWorld(47)[0], tileToWorld(47)[2]);
    expectAt([tail.x, tail.y, tail.z], tileToWorld(26)[0], tileToWorld(26)[2]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/layout.test.ts`
Expected: FAIL with `Cannot find module '../src/scene/layout'`.

- [ ] **Step 4: Implement the layout and add the world colours**

Create `apps/client/src/scene/layout.ts`:

```ts
import { CatmullRomCurve3, Vector3 } from 'three';

export type Vec3 = [number, number, number];

/** World units per tile (spec #2 §6.1, §6.3). */
export const TILE_SIZE = 1.6;
export const COLUMNS = 10;
const HALF = (COLUMNS - 1) / 2;

/** A tile's grid cell: tile 1 at the front left, rows alternating direction. */
export function tileCell(tile: number): { col: number; row: number } {
  const row = Math.floor((tile - 1) / COLUMNS);
  const along = (tile - 1) % COLUMNS;
  return { col: row % 2 === 0 ? along : COLUMNS - 1 - along, row };
}

/** Centre of a tile's top face; row 0 is nearest the camera (+Z). Tile 0 is a start spot in front of the board, one per seat. */
export function tileToWorld(tile: number, seat = 0): Vec3 {
  if (tile <= 0) return [(seat - 1.5) * TILE_SIZE * 0.8, 0, (HALF + 1.4) * TILE_SIZE];
  const { col, row } = tileCell(tile);
  return [(col - HALF) * TILE_SIZE, 0, (HALF - row) * TILE_SIZE];
}

/** Which classic colour a square takes: they repeat along diagonals (spec #2 §6.1). */
export function squareColorIndex(tile: number, colours: number): number {
  const { col, row } = tileCell(tile);
  return (col + row) % colours;
}

/** The tiles a move passes through, both ends included; a bounce runs up to the last tile and back. */
export function tilePath(from: number, to: number, bounced: boolean, size: number): number[] {
  const path = [from];
  const walk = (target: number) => {
    let at = path[path.length - 1]!;
    while (at !== target) {
      at += Math.sign(target - at);
      path.push(at);
    }
  };
  if (bounced) walk(size);
  walk(to);
  return path;
}

/** The flat curve a slide lies along, head to tail, with a gentle S so it reads as a chute. */
export function slideCurve(from: number, to: number): CatmullRomCurve3 {
  const head = new Vector3(...tileToWorld(from));
  const tail = new Vector3(...tileToWorld(to));
  const along = tail.clone().sub(head);
  const side = new Vector3(-along.z, 0, along.x).normalize().multiplyScalar(Math.min(1.2, along.length() * 0.12));
  return new CatmullRomCurve3([head, head.clone().lerp(tail, 1 / 3).add(side), head.clone().lerp(tail, 2 / 3).sub(side), tail]);
}

/** A point on an arc through the air: a parabola from one spot to another. */
export function arcPoint(from: Vec3, to: Vec3, s: number, height: number): Vec3 {
  return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s + height * 4 * s * (1 - s), from[2] + (to[2] - from[2]) * s];
}
```

Append to `apps/client/src/app/theme.ts`:

```ts

/** The 3D world around the board (spec #2 §6.1, §7.4): all values come from the Tangerine Dusk palette. */
export const WORLD_COLORS = {
  sky: ['#0b4a5a', '#2f8f8a', '#ffc184'],
  fog: '#ffc79a',
  islandTop: '#ffb070',
  islandRock: '#0f5d63',
  bumper: ['#ff5470', '#5ff0c5'],
  cloud: '#fff7ec',
  ink: '#0f2e36',
  crown: '#ffcc33',
  pad: '#5ff0c5',
  chevron: '#ff5470',
  die: '#fff7ec',
  pip: '#0f2e36',
  orb: '#5ff0c5',
  shield: '#6ff3ff',
  ring: '#ffcc33',
} as const;
```

- [ ] **Step 5: Run the test again**

Run: `pnpm vitest run apps/client/test/layout.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  34 passed (34)` and `Tests  253 passed (253)`.

- [ ] **Step 7: Commit**

```bash
git add apps/client pnpm-lock.yaml
git commit -m "feat(client): lay out the 3D board and add the world colours

Tiles 1.6 units apart on a serpentine 10×10 grid with start spots in
front, diagonal colour stripes, tile paths with bounces, slide curves
and launch arcs (spec #2 §6.1).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Graphics quality and the render stats

**Files:**
- Create: `apps/client/src/scene/quality.ts`, `apps/client/src/scene/stats.ts`, `apps/client/test/quality.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type QualitySetting = 'auto' | 'low' | 'high'` and `type QualityLevel = 'low' | 'high'`.
  - `interface QualityProfile { shadows: boolean; dpr: number; antialias: boolean; clouds: number }` and `QUALITY: Record<QualityLevel, QualityProfile>`.
  - `autoStartLevel(env: { coarsePointer: boolean; shortSide: number }): QualityLevel` and `startLevel(setting: QualitySetting, env): QualityLevel`.
  - `class FrameRateWatch { constructor(windowMs?: number, minFps?: number); add(deltaMs: number): boolean }`.
  - `renderStats: StoreApi<{ fps: number; calls: number; triangles: number }>`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FrameRateWatch, QUALITY, autoStartLevel } from '../src/scene/quality';

/** Feed `seconds` of frames at a steady rate; count how often the watch says to step down. */
function feed(watch: FrameRateWatch, fps: number, seconds: number): number {
  let fired = 0;
  for (let i = 0; i < Math.round(fps * seconds); i++) if (watch.add(1000 / fps)) fired += 1;
  return fired;
}

describe('graphics quality (spec #2 §6.4)', () => {
  it('starts Auto on Low only for phones: a coarse pointer and a short side under 500 px', () => {
    expect(autoStartLevel({ coarsePointer: true, shortSide: 390 })).toBe('low');
    expect(autoStartLevel({ coarsePointer: true, shortSide: 820 })).toBe('high');
    expect(autoStartLevel({ coarsePointer: false, shortSide: 390 })).toBe('high');
    expect(QUALITY.high).toMatchObject({ shadows: true, dpr: 2, antialias: true });
    expect(QUALITY.low).toMatchObject({ shadows: false, dpr: 1.5 });
    expect(QUALITY.low.clouds).toBeLessThan(QUALITY.high.clouds);
  });

  it('keeps High while the frame rate holds at 45 fps or more', () => {
    expect(feed(new FrameRateWatch(), 60, 20)).toBe(0);
    expect(feed(new FrameRateWatch(), 46, 20)).toBe(0);
  });

  it('steps down once, when the average stays under 45 fps for 5 s', () => {
    const watch = new FrameRateWatch();
    expect(feed(watch, 30, 4.9)).toBe(0);
    expect(feed(watch, 30, 1)).toBe(1);
    expect(feed(watch, 30, 10)).toBe(0);
  });

  it('ignores a single long stall such as a tab switch', () => {
    const watch = new FrameRateWatch();
    feed(watch, 60, 3);
    expect(watch.add(4000)).toBe(false);
    expect(feed(watch, 60, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/quality.test.ts`
Expected: FAIL with `Cannot find module '../src/scene/quality'`.

- [ ] **Step 3: Implement quality and the stats store**

Create `apps/client/src/scene/quality.ts`:

```ts
export type QualitySetting = 'auto' | 'low' | 'high';
export type QualityLevel = 'low' | 'high';

export interface QualityProfile {
  shadows: boolean;
  /** Pixel density cap. */
  dpr: number;
  antialias: boolean;
  clouds: number;
}

/** Spec #2 §6.4. */
export const QUALITY: Record<QualityLevel, QualityProfile> = {
  high: { shadows: true, dpr: 2, antialias: true, clouds: 8 },
  low: { shadows: false, dpr: 1.5, antialias: false, clouds: 4 },
};

/** Auto starts Low on phones (a coarse pointer and a short screen side under 500 px) and High elsewhere. */
export function autoStartLevel(env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return env.coarsePointer && env.shortSide < 500 ? 'low' : 'high';
}

export function startLevel(setting: QualitySetting, env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return setting === 'auto' ? autoStartLevel(env) : setting;
}

/** Auto's step-down (spec #2 §6.4): true, once, when the frame rate has averaged under `minFps` for `windowMs`. */
export class FrameRateWatch {
  private readonly frames: number[] = [];
  private total = 0;
  private fired = false;

  constructor(
    private readonly windowMs = 5000,
    private readonly minFps = 45,
  ) {}

  /** Feed one frame's length in ms. Stalls over 250 ms (a hidden tab, a long pause) don't count. */
  add(deltaMs: number): boolean {
    if (this.fired || deltaMs > 250) return false;
    this.frames.push(deltaMs);
    this.total += deltaMs;
    while (this.frames.length > 1 && this.total - this.frames[0]! >= this.windowMs) this.total -= this.frames.shift()!;
    if (this.total < this.windowMs) return false;
    if (this.frames.length / (this.total / 1000) >= this.minFps) return false;
    this.fired = true;
    return true;
  }
}
```

Create `apps/client/src/scene/stats.ts`:

```ts
import { createStore } from 'zustand/vanilla';

export interface RenderStats {
  fps: number;
  calls: number;
  triangles: number;
}

/** What the renderer drew last, for the dev overlay (spec #2 §6.4). */
export const renderStats = createStore<RenderStats>()(() => ({ fps: 0, calls: 0, triangles: 0 }));
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/quality.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  35 passed (35)` and `Tests  257 passed (257)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the graphics quality levels and Auto's step-down

High, Low and Auto per spec #2 §6.4: Auto starts Low on phones and
drops to Low when the frame rate averages under 45 fps for 5 s,
ignoring single stalls. A small store carries the render stats.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Code-built models

**Files:**
- Create: `apps/client/src/assets/models.ts`, `apps/client/test/models.test.ts`

**Interfaces:**
- Consumes: `PieceId` and `PIECES` (Phase 2); `Vec3` (Task 1).
- Produces:
  - `PIECE_GEOMETRY: Record<PieceId, () => BufferGeometry>`.
  - `DIE_FACES = [3, 4, 1, 6, 2, 5]` (the face values in BoxGeometry's face order +X, −X, +Y, −Y, +Z, −Z) and `DIE_SIZE = 0.5`.
  - `dieGeometry(): BufferGeometry`, non-indexed, each face's UVs in its cell of a 3×2 atlas.
  - `dieRotationFor(face: number): Vec3`, the rotation that turns that face up.
  - `crownGeometry(): BufferGeometry`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/models.test.ts`:

```ts
import { Euler, Vector3, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { DIE_FACES, PIECE_GEOMETRY, crownGeometry, dieGeometry, dieRotationFor } from '../src/assets/models';
import { PIECES } from '../src/service/matchService';

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('code-built models (spec #2 §6.2, §6.3)', () => {
  it.each(PIECES)('builds the %s under 5k triangles, standing on its origin, about one unit tall', (piece) => {
    const g = PIECE_GEOMETRY[piece]();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(triangles(g)).toBeLessThan(5000);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeGreaterThan(0.9);
    expect(box.max.y).toBeLessThan(1.2);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThan(1.05);
  });

  it('maps each die face into its own cell of the pip atlas', () => {
    const g = dieGeometry();
    const uv = g.getAttribute('uv');
    expect(g.groups).toHaveLength(6);
    g.groups.forEach((group, face) => {
      const cell = DIE_FACES[face]! - 1;
      const col = cell % 3;
      const row = Math.floor(cell / 3);
      for (let i = group.start; i < group.start + group.count; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(col / 3 - 1e-6);
        expect(uv.getX(i)).toBeLessThanOrEqual((col + 1) / 3 + 1e-6);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(row / 2 - 1e-6);
        expect(uv.getY(i)).toBeLessThanOrEqual((row + 1) / 2 + 1e-6);
      }
    });
  });

  it('turns the rolled face up', () => {
    const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
    DIE_FACES.forEach((face, i) => {
      const up = normals[i]!.clone().applyEuler(new Euler(...dieRotationFor(face)));
      expect([up.x, up.y, up.z].map((v) => Math.round(v) + 0)).toEqual([0, 1, 0]);
    });
  });

  it('gives the crown five raised points', () => {
    const pos = crownGeometry().getAttribute('position');
    // Keyed in hundredths: the seam repeats the first vertex up to a float error.
    const points = new Set<string>();
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.4) points.add(`${Math.round(pos.getX(i) * 100)},${Math.round(pos.getZ(i) * 100)}`);
    expect(points.size).toBe(5);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/models.test.ts`
Expected: FAIL with `Cannot find module '../src/assets/models'`.

- [ ] **Step 3: Build the models**

Create `apps/client/src/assets/models.ts`:

```ts
import { CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceId } from '../service/matchService';
import type { Vec3 } from '../scene/layout';

// Code-built defaults for the asset slots (spec #2 §6.2, §6.3): about one unit tall,
// origin at the feet, +Z forward, Y up. The scene scales pieces by 1.3.

const SEGMENTS = 28;

function lathe(points: Array<[number, number]>): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), SEGMENTS);
}

/** Merge parts into one geometry, so a piece is a single draw call. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)));
}

/** The round plinth the knight, pawn and dragon stand on. */
function plinth(): BufferGeometry {
  return lathe([[0, 0], [0.42, 0], [0.44, 0.04], [0.42, 0.1], [0.34, 0.14], [0, 0.14]]);
}

/** Extrude a side profile drawn facing +X, centre it, and turn it to face +Z. */
function profile(shape: Shape, depth: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

function pawnGeometry(): BufferGeometry {
  return lathe([
    [0, 0], [0.42, 0], [0.44, 0.04], [0.42, 0.1], [0.32, 0.16], [0.2, 0.24], [0.16, 0.42], [0.13, 0.56], [0.24, 0.6],
    [0.24, 0.65], [0.13, 0.68], [0.17, 0.73], [0.21, 0.79], [0.22, 0.86], [0.2, 0.93], [0.14, 0.99], [0.07, 1.02], [0, 1.03],
  ]);
}

function knightGeometry(): BufferGeometry {
  const head = new Shape();
  head.moveTo(-0.22, 0.1);
  head.lineTo(0.2, 0.1);
  head.quadraticCurveTo(0.26, 0.38, 0.14, 0.52);
  head.lineTo(0.34, 0.64);
  head.quadraticCurveTo(0.44, 0.74, 0.34, 0.84);
  head.lineTo(0.06, 0.95);
  head.lineTo(0.02, 1.06);
  head.lineTo(-0.07, 0.94);
  head.quadraticCurveTo(-0.32, 0.78, -0.26, 0.44);
  head.quadraticCurveTo(-0.24, 0.26, -0.22, 0.1);
  return merge([plinth(), profile(head, 0.26)]);
}

function meepleGeometry(): BufferGeometry {
  const body = new Shape();
  body.moveTo(-0.42, 0);
  body.lineTo(-0.1, 0);
  body.lineTo(0, 0.2);
  body.lineTo(0.1, 0);
  body.lineTo(0.42, 0);
  body.quadraticCurveTo(0.3, 0.3, 0.2, 0.46);
  body.quadraticCurveTo(0.42, 0.46, 0.46, 0.56);
  body.quadraticCurveTo(0.46, 0.66, 0.34, 0.68);
  body.lineTo(0.14, 0.7);
  body.absarc(0, 0.84, 0.17, -0.784, Math.PI + 0.784, false);
  body.lineTo(-0.34, 0.68);
  body.quadraticCurveTo(-0.46, 0.66, -0.46, 0.56);
  body.quadraticCurveTo(-0.42, 0.46, -0.2, 0.46);
  body.quadraticCurveTo(-0.3, 0.3, -0.42, 0);
  const g = new ExtrudeGeometry(body, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
  // The bevel grows the outline below y = 0; stand it back on the origin.
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, -0.15);
  return g;
}

function dragonGeometry(): BufferGeometry {
  const head = new Shape();
  head.moveTo(-0.2, 0.1);
  head.lineTo(0.18, 0.1);
  head.quadraticCurveTo(0.22, 0.34, 0.12, 0.48);
  head.lineTo(0.4, 0.54);
  head.lineTo(0.43, 0.6);
  head.lineTo(0.2, 0.63);
  head.lineTo(0.45, 0.7);
  head.quadraticCurveTo(0.42, 0.83, 0.16, 0.85);
  head.lineTo(0.09, 1.05);
  head.lineTo(0.01, 0.87);
  head.lineTo(-0.15, 1.1);
  head.lineTo(-0.12, 0.85);
  head.quadraticCurveTo(-0.32, 0.7, -0.24, 0.44);
  head.lineTo(-0.31, 0.37);
  head.lineTo(-0.22, 0.31);
  head.quadraticCurveTo(-0.2, 0.2, -0.2, 0.1);
  return merge([plinth(), profile(head, 0.28)]);
}

export const PIECE_GEOMETRY: Record<PieceId, () => BufferGeometry> = {
  knight: knightGeometry,
  pawn: pawnGeometry,
  meeple: meepleGeometry,
  dragon: dragonGeometry,
};

/** Die faces in BoxGeometry's face order (+X, −X, +Y, −Y, +Z, −Z); opposite faces sum to 7. */
export const DIE_FACES = [3, 4, 1, 6, 2, 5] as const;
export const DIE_SIZE = 0.5;

/** A rounded die whose faces each map into their cell (n − 1) of a 3×2 pip atlas, row 0 at the bottom. */
export function dieGeometry(): BufferGeometry {
  const rounded = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, 0.08);
  const g = rounded.index ? rounded.toNonIndexed() : rounded;
  const uv = g.getAttribute('uv');
  g.groups.forEach((group, face) => {
    const cell = DIE_FACES[face]! - 1;
    const col = cell % 3;
    const row = Math.floor(cell / 3);
    for (let i = group.start; i < group.start + group.count; i++) uv.setXY(i, (col + uv.getX(i)) / 3, (row + uv.getY(i)) / 2);
  });
  uv.needsUpdate = true;
  return g;
}

/** The die rotation that turns a face up (+Y). */
export function dieRotationFor(face: number): Vec3 {
  switch (face) {
    case 6:
      return [Math.PI, 0, 0];
    case 2:
      return [-Math.PI / 2, 0, 0];
    case 5:
      return [Math.PI / 2, 0, 0];
    case 3:
      return [0, 0, Math.PI / 2];
    case 4:
      return [0, 0, -Math.PI / 2];
    default:
      return [0, 0, 0];
  }
}

/** A gold band whose top edge rises into five points (for tile 100, spec #2 §6.1). */
export function crownGeometry(): BufferGeometry {
  const radial = 10;
  const g = new CylinderGeometry(0.5, 0.4, 0.42, radial, 1, true);
  const pos = g.getAttribute('position');
  // The first row of vertices is the top ring; every other one becomes a point (the seam vertex repeats the first).
  for (let x = 0; x <= radial; x += 2) pos.setY(x, pos.getY(x) + 0.26);
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/models.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  36 passed (36)` and `Tests  264 passed (264)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): build the pieces, die and crown in code

Knight, pawn, meeple and dragon head from lathes and extrusions, each
one draw call under 5k triangles with its origin at the feet; a rounded
die mapped onto a pip atlas, and the crown (spec #2 §6.2, §6.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Asset slots

**Files:**
- Create: `apps/client/src/assets/slots.tsx`, `apps/client/test/slots.test.tsx`
- Modify: `apps/client/package.json` (React Three Fiber and drei, through `pnpm add`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type SlotName = 'piece.knight' | 'piece.pawn' | 'piece.meeple' | 'piece.dragon' | 'die' | 'pad' | 'slide.vortex' | 'crown' | 'island'`.
  - `SLOT_URLS: Partial<Record<SlotName, string>>`, empty for now.
  - `tintSeat(root: Object3D, color: string): void`.
  - `class SlotBoundary` (props `name`, `fallback`, `children`).
  - `function Slot({ name, fallback, color }: { name: SlotName; fallback: ReactNode; color?: string })`.

- [ ] **Step 1: Add React Three Fiber and drei**

Run: `pnpm --filter @laddorious/client add @react-three/fiber@^9.8.1 @react-three/drei@^10.7.9`
Expected: completes without errors or peer warnings.

- [ ] **Step 2: Write the failing test**

Create `apps/client/test/slots.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotBoundary, tintSeat } from '../src/assets/slots';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error('404 knight.glb');
}

describe('asset slots (spec #2 §6.3)', () => {
  it('gives materials named Seat the seat colour, leaving shared materials and other parts alone', () => {
    const seat = new MeshStandardMaterial({ name: 'Seat', color: '#ffffff' });
    const trim = new MeshStandardMaterial({ name: 'Trim', color: '#000000' });
    const body = new Mesh(new BoxGeometry(), seat);
    const hat = new Mesh(new BoxGeometry(), [seat, trim]);
    const root = new Group();
    root.add(body, hat);
    tintSeat(root, '#ff5470');
    expect((body.material as MeshStandardMaterial).color.getHexString()).toBe('ff5470');
    const [tinted, untouched] = hat.material as MeshStandardMaterial[];
    expect(tinted!.color.getHexString()).toBe('ff5470');
    expect(untouched).toBe(trim);
    expect(seat.color.getHexString()).toBe('ffffff');
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

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/slots.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/assets/slots"`.

- [ ] **Step 4: Implement the slots**

Create `apps/client/src/assets/slots.tsx`:

```tsx
import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { Mesh, type Material, type MeshStandardMaterial, type Object3D } from 'three';

export type SlotName = 'piece.knight' | 'piece.pawn' | 'piece.meeple' | 'piece.dragon' | 'die' | 'pad' | 'slide.vortex' | 'crown' | 'island';

/**
 * Optional .glb overrides per slot (spec #2 §6.3); the Spec #4 art pass fills these in.
 * Contract: 1 tile = 1.6 units, origin at the feet, +Z forward, Y up, pieces under 5k
 * triangles, PBR materials, and a material named `Seat` takes the player's colour.
 */
export const SLOT_URLS: Partial<Record<SlotName, string>> = {};

/** Give every material named `Seat` the seat colour. Tinted materials are copies, so shared ones stay as they were. */
export function tintSeat(root: Object3D, color: string): void {
  const tint = (material: Material): Material => {
    if (material.name !== 'Seat' || !('color' in material)) return material;
    const copy = material.clone() as MeshStandardMaterial;
    copy.color.set(color);
    return copy;
  };
  root.traverse((node) => {
    if (node instanceof Mesh) node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
  });
}

interface BoundaryProps {
  name: SlotName;
  fallback: ReactNode;
  children: ReactNode;
}

/** A model that fails to load shows the slot's built-in default and warns once (spec #2 §6.3, §8). */
export class SlotBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn(`asset slot ${this.props.name} failed to load; using the built-in model`, error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GltfModel({ url, color }: { url: string; color?: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    if (color) tintSeat(copy, color);
    return copy;
  }, [scene, color]);
  return <primitive object={model} />;
}

/** An asset slot: its .glb override when one is set, its code-built default otherwise or on failure. */
export function Slot({ name, fallback, color }: { name: SlotName; fallback: ReactNode; color?: string }) {
  const url = SLOT_URLS[name];
  if (!url) return fallback;
  return (
    <SlotBoundary name={name} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} color={color} />
      </Suspense>
    </SlotBoundary>
  );
}
```

- [ ] **Step 5: Run the test again**

Run: `pnpm vitest run apps/client/test/slots.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  37 passed (37)` and `Tests  266 passed (266)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client pnpm-lock.yaml
git commit -m "feat(client): add asset slots with .glb overrides and Seat tinting

Every model sits in a named slot: the code-built default, or a .glb
loaded with drei's useGLTF in Suspense that falls back to the default
with a warning if it fails (spec #2 §6.3). Seat materials take the
player colour on copies.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Piece motion

**Files:**
- Create: `apps/client/src/scene/motion.ts`, `apps/client/test/motion.test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `tileToWorld`, `tilePath`, `slideCurve`, `arcPoint` and `Vec3`;
  - from Phase 3: `stackOn` and `PresentationState`, `BEAT_MS` and `buildTimeline` (tests), `PlayingBeat` and `DirectorState`.
- Produces:
  - `interface Pose { position: Vec3; rotation: Vec3; scale: Vec3; orb: boolean }`.
  - `STACK_HEIGHT = 1.05` and `FACE_OFF_GAP = 0.85`.
  - `restPose(state: PresentationState, player: PlayerId, seat: number): Pose`.
  - `beatPose(beat: PlayingBeat, from: PresentationState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose`.
  - `poseAt(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose | null`.
  - `projectileAt(beat: PlayingBeat, from: PresentationState, seatOf: (player: PlayerId) => number, nowMs: number): Vec3 | null`.
  - `withIdle(pose: Pose, nowMs: number, phase: number): Pose`.
  - the easing helpers `clamp01`, `easeOut`, `easeInOut` and `easeOutBack`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/motion.test.ts`:

```ts
import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { tileToWorld } from '../src/scene/layout';
import { FACE_OFF_GAP, STACK_HEIGHT, beatPose, projectileAt, restPose } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

function at(positions: Record<PlayerId, number> = {}): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, ...positions } };
}

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice', bounced = false): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced, visibility: 'public' };
}

/** The one beat these events make, started at time 0. */
function beat(events: GameEvent[], from: PresentationState): PlayingBeat {
  const [only] = buildTimeline(events, from, 'p0', SIZE);
  return { ...only!, startedAt: 0 };
}

function expectNear(actual: number[], expected: number[]) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 5));
}

describe('rest poses', () => {
  it('lines the pieces up on the start row, one spot per seat', () => {
    const poses = [0, 1, 2, 3].map((seat) => restPose(at(), `p${seat}`, seat));
    expect(new Set(poses.map((p) => p.position[0])).size).toBe(4);
  });

  it('stands a later arrival on top of the stack', () => {
    const state = { ...at({ p0: 5, p1: 5 }), arrivals: ['p1', 'p0', 'p2', 'p3'] };
    expect(restPose(state, 'p0', 0).position[1] - restPose(state, 'p1', 1).position[1]).toBeCloseTo(STACK_HEIGHT);
  });

  it('stands face-off opponents side by side, facing each other', () => {
    const state = { ...at({ p0: 6, p1: 6 }), faceOffs: [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }] };
    const left = restPose(state, 'p0', 0);
    const right = restPose(state, 'p1', 1);
    expect(right.position[0] - left.position[0]).toBeCloseTo(FACE_OFF_GAP);
    expect(left.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(right.rotation[1]).toBeCloseTo(-Math.PI / 2);
  });
});

describe('beat poses (spec #2 §5.1)', () => {
  it('hops tile by tile on a dice move', () => {
    const from = at({ p0: 2 });
    const b = beat([moved('p0', 2, 5)], from);
    expectNear(beatPose(b, from, 'p0', 0, 0, SIZE).position, tileToWorld(2));
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile, SIZE).position, tileToWorld(3));
    expect(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 1.5, SIZE).position[1]).toBeGreaterThan(0.3);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(5));
  });

  it('walks a bounce up to the last tile and back', () => {
    const from = at({ p0: 97 });
    const b = beat([moved('p0', 97, 98, 'dice', true)], from);
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 3, SIZE).position, tileToWorld(100));
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(98));
  });

  it('rides a slide as an orb and pops out at the tail', () => {
    const from = at({ p0: 47 });
    const b = beat([moved('p0', 47, 26, 'snake')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).orb).toBe(true);
    const end = beatPose(b, from, 'p0', 0, b.durationMs, SIZE);
    expect(end.orb).toBe(false);
    expectNear(end.position, tileToWorld(26));
    expectNear(end.scale, [1, 1, 1]);
  });

  it('arcs a launch above both ends and lands on the ladder top', () => {
    const from = at({ p0: 4 });
    const b = beat([moved('p0', 4, 14, 'ladder')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).position[1]).toBeGreaterThan(1);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(14));
  });

  it('eases a piece the beat does not move from its old spot to its new one', () => {
    const from = { ...at({ p0: 6, p1: 6 }), arrivals: ['p0', 'p1', 'p2', 'p3'] };
    const b = beat([{ type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' }], from);
    expectNear(beatPose(b, from, 'p1', 1, 0, SIZE).position, restPose(from, 'p1', 1).position);
    expectNear(beatPose(b, from, 'p1', 1, b.durationMs, SIZE).position, restPose(b.after, 'p1', 1).position);
  });

  it("throws a card's projectile from the caster to its target, never at the caster itself", () => {
    const from = at({ p0: 10, p1: 20 });
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    const b = beat([card], from);
    const seatOf = (id: PlayerId) => Number(id.slice(1));
    const start = projectileAt(b, from, seatOf, 0)!;
    expect(start[0]).toBeCloseTo(tileToWorld(20)[0]);
    expect(start[2]).toBeCloseTo(tileToWorld(20)[2]);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.25)![1]).toBeGreaterThan(1.5);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.6)).toBeNull();
    expect(projectileAt({ ...b, events: [{ ...card, target: 'p1' }] }, from, seatOf, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/motion.test.ts`
Expected: FAIL with `Cannot find module '../src/scene/motion'`.

- [ ] **Step 3: Implement the motion**

Create `apps/client/src/scene/motion.ts`:

```ts
import type { GameEvent, PlayerId } from '@laddorious/core';
import { BEAT_MS } from '../director/beats';
import type { DirectorState, PlayingBeat } from '../director/director';
import { stackOn, type PresentationState } from '../director/presentation';
import { arcPoint, slideCurve, tilePath, tileToWorld, type Vec3 } from './layout';

/** Where a piece is and how it is turned and squashed. `orb` swaps the piece for a glowing orb (inside a slide). */
export interface Pose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  orb: boolean;
}

/** How far a stacked piece rises, and how far apart face-off opponents stand (world units). */
export const STACK_HEIGHT = 1.05;
export const FACE_OFF_GAP = 0.85;
const HOP_HEIGHT = 0.55;
const STEP_HEIGHT = 0.15;

type MovedEvent = Extract<GameEvent, { type: 'Moved' }>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const still = (position: Vec3, rotation: Vec3 = [0, 0, 0]): Pose => ({ position, rotation, scale: [1, 1, 1], orb: false });

/** Where a piece stands between beats: on its tile, on top of earlier arrivals, or side by side facing its opponents in a face-off. */
export function restPose(state: PresentationState, player: PlayerId, seat: number): Pose {
  const tile = state.positions[player] ?? 0;
  const at = tileToWorld(tile, seat);
  if (tile === 0) return still(at);
  const faceOff = state.faceOffs.find((f) => f.tile === tile && f.players.includes(player));
  if (faceOff) {
    const offset = (faceOff.players.indexOf(player) - (faceOff.players.length - 1) / 2) * FACE_OFF_GAP;
    return still([at[0] + offset, at[1], at[2]], [0, offset < 0 ? Math.PI / 2 : -Math.PI / 2, 0]);
  }
  const level = Math.max(0, stackOn(state, tile).indexOf(player));
  return still([at[0], at[1] + level * STACK_HEIGHT, at[2]]);
}

/**
 * A piece's pose `nowMs` into a beat (spec #2 §5.1). Pieces the beat moves hop, slide,
 * launch, fly back or leap; others ease from their old spot to their new one.
 */
export function beatPose(beat: PlayingBeat, from: PresentationState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose {
  const elapsed = Math.max(0, nowMs - beat.startedAt);
  const t = beat.durationMs > 0 ? clamp01(elapsed / beat.durationMs) : 1;
  const start = restPose(from, player, seat);
  const end = restPose(beat.after, player, seat);
  const move = beat.events.find((e): e is MovedEvent => e.type === 'Moved' && e.player === player);
  if (move) {
    switch (beat.kind) {
      case 'move':
        return hops(move, start, end, elapsed, BEAT_MS.hopPerTile, HOP_HEIGHT, boardSize, true);
      case 'stepBack':
        return hops(move, start, end, elapsed, BEAT_MS.stepBackPerTile, STEP_HEIGHT, boardSize, false);
      case 'slide':
        return slide(move, end, t);
      case 'launch':
        return flight(start, end, t, 1.6 + reach(start, end) * 0.22, -1);
      case 'knockback':
        return flight(start, end, t, 1.3, 1);
      case 'cardMove':
        return flight(start, end, t, 0.9 + reach(start, end) * 0.08, 0);
    }
  }
  if (beat.kind === 'victory' && beat.events.some((e) => e.type === 'MatchWon' && e.winner === player)) {
    return { ...end, position: [end.position[0], end.position[1] + Math.abs(Math.sin(t * Math.PI * 3)) * 0.9, end.position[2]], rotation: [0, t * Math.PI * 4, 0] };
  }
  if (beat.kind === 'cardResolved' && beat.events.some((e) => e.type === 'CardResolved' && e.target === player && e.result === 'hit')) {
    return { ...start, position: [start.position[0], start.position[1] + Math.sin(t * Math.PI) * 0.35, start.position[2]] };
  }
  const k = easeInOut(t);
  return { ...end, position: lerp3(start.position, end.position, k), rotation: lerp3(start.rotation, end.rotation, k) };
}

/** Tile-by-tile hops: each tile takes `perTile` ms, then dice moves land with a squash. */
function hops(move: MovedEvent, start: Pose, end: Pose, elapsed: number, perTile: number, height: number, boardSize: number, squash: boolean): Pose {
  const path = tilePath(move.from, move.to, move.bounced, boardSize);
  const legs = path.length - 1;
  const leg = Math.floor(elapsed / perTile);
  if (legs <= 0 || leg >= legs) {
    const since = elapsed - legs * perTile;
    const s = squash && since < BEAT_MS.landing ? 1 - 0.18 * Math.sin((since / BEAT_MS.landing) * Math.PI) : 1;
    return { ...end, scale: [2 - s, s, 2 - s] };
  }
  const f = (elapsed - leg * perTile) / perTile;
  const a = leg === 0 ? start.position : tileToWorld(path[leg]!);
  const b = leg + 1 === legs ? end.position : tileToWorld(path[leg + 1]!);
  const stretch = 1 + 0.12 * Math.sin(f * Math.PI);
  const across = 1 / Math.sqrt(stretch);
  return {
    position: [lerp(a[0], b[0], f), lerp(a[1], b[1], f) + height * 4 * f * (1 - f), lerp(a[2], b[2], f)],
    rotation: end.rotation,
    scale: [across, stretch, across],
    orb: false,
  };
}

/** The vacuum: sucked into the head, an orb rides the chute, the piece pops out at the tail. */
function slide(move: MovedEvent, end: Pose, t: number): Pose {
  const curve = slideCurve(move.from, move.to);
  if (t < 0.2) {
    const k = t / 0.2;
    const head = curve.getPoint(0);
    const s = 1 - 0.9 * k;
    return { position: [head.x, head.y, head.z], rotation: [0, k * Math.PI * 4, 0], scale: [s, s, s], orb: false };
  }
  if (t < 0.85) {
    const p = curve.getPoint((t - 0.2) / 0.65);
    return { position: [p.x, p.y + 0.25, p.z], rotation: [0, 0, 0], scale: [1, 1, 1], orb: true };
  }
  const s = 0.1 + 0.9 * easeOutBack((t - 0.85) / 0.15);
  return { ...end, scale: [s, s, s] };
}

/** One arc through the air: launch pads somersault forward (flip −1), knockbacks backflip (+1), card leaps don't flip. */
function flight(start: Pose, end: Pose, t: number, height: number, flip: number): Pose {
  const k = easeInOut(t);
  return { position: arcPoint(start.position, end.position, k, height), rotation: [flip * Math.PI * 2 * k, end.rotation[1], 0], scale: [1, 1, 1], orb: false };
}

const reach = (a: Pose, b: Pose) => Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);

/** A card's projectile (spec #2 §5.1): it arcs from the caster to its target over the first half of the beat. */
export function projectileAt(beat: PlayingBeat, from: PresentationState, seatOf: (player: PlayerId) => number, nowMs: number): Vec3 | null {
  if (beat.kind !== 'cardResolved') return null;
  const card = beat.events.find((e) => e.type === 'CardResolved');
  if (card?.type !== 'CardResolved' || card.target === null || card.target === card.caster) return null;
  const t = clamp01((nowMs - beat.startedAt) / (beat.durationMs / 2));
  if (t >= 1) return null;
  const a = restPose(from, card.caster, seatOf(card.caster)).position;
  const b = restPose(from, card.target, seatOf(card.target)).position;
  return arcPoint([a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], easeInOut(t), 1.5);
}

/** A piece's pose right now, from the director's state. */
export function poseAt(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose | null {
  if (!state.presentation) return null;
  return state.beat ? beatPose(state.beat, state.presentation, player, seat, nowMs, boardSize) : restPose(state.presentation, player, seat);
}

/** Idle bob and sway (spec #2 §6.2); the scene leaves it off with reduced motion. */
export function withIdle(pose: Pose, nowMs: number, phase: number): Pose {
  return {
    ...pose,
    position: [pose.position[0], pose.position[1] + 0.035 * (1 + Math.sin(nowMs / 520 + phase)), pose.position[2]],
    rotation: [pose.rotation[0], pose.rotation[1], pose.rotation[2] + 0.045 * Math.sin(nowMs / 830 + phase)],
  };
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/motion.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  38 passed (38)` and `Tests  275 passed (275)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): pose the pieces through every beat

Rest poses with stacks and face-offs, then per beat: tile-by-tile hops
with squash and stretch, the vacuum slide with its orb, launch-pad
somersaults, knockback backflips, card leaps and projectiles, and the
victory dance (spec #2 §5.1, §6.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Camera rules

**Files:**
- Create: `apps/client/src/scene/camera.ts`, `apps/client/test/camera.test.ts`

**Interfaces:**
- Consumes: `Beat` (Phase 3); `Vec3` (Task 1).
- Produces:
  - `type ShotMode = 'overview' | 'follow' | 'swoop'`.
  - `interface Shot { mode: ShotMode; position: Vec3; target: Vec3; cut: boolean }`.
  - `interface ShotInput { beat: Beat | null; window: WindowKind | null; myPick: boolean; me: PlayerId; watch: PlayerId | null; piece: (player: PlayerId) => Vec3; reducedMotion: boolean; nowMs: number }`.
  - `cameraShot(input: ShotInput): Shot`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/camera.test.ts`:

```ts
import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { cameraShot, type ShotInput } from '../src/scene/camera';
import type { Vec3 } from '../src/scene/layout';
import { openingUpdate } from './support/fixtures';

const SPOTS: Record<PlayerId, Vec3> = { p0: [1, 0, 1], p1: [5, 0, -3], p2: [-4, 0, 2], p3: [0, 0, -6] };
const after = presentationFromView(openingUpdate().view);
const beatOf = (kind: Beat['kind'], events: GameEvent[]): Beat => ({ kind, durationMs: 1000, events, after });
const moved = (player: PlayerId, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from: 1, to: 9, cause, bounced: false, visibility: 'public' });

function shot(over: Partial<ShotInput> = {}) {
  return cameraShot({ beat: null, window: 'dice', myPick: false, me: 'p0', watch: null, piece: (id) => SPOTS[id]!, reducedMotion: false, nowMs: 0, ...over });
}

describe('camera rules (spec #2 §5.3)', () => {
  it('shows the whole board while everyone rolls', () => {
    expect(shot()).toMatchObject({ mode: 'overview', target: [0, 0, 0] });
  });

  it('drifts gently over the overview, and holds still with reduced motion', () => {
    expect(shot({ nowMs: 4000 }).position).not.toEqual(shot({ nowMs: 0 }).position);
    expect(shot({ nowMs: 4000, reducedMotion: true }).position).toEqual(shot({ nowMs: 0, reducedMotion: true }).position);
  });

  it('follows my piece while another piece moves', () => {
    expect(shot({ beat: beatOf('move', [moved('p1')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it('follows my piece through a face-off window I am not in', () => {
    expect(shot({ window: 'challenge' })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it("swoops in for my own slide or launch, but not for anyone else's", () => {
    expect(shot({ beat: beatOf('slide', [moved('p0', 'snake')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('launch', [moved('p0', 'ladder')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('slide', [moved('p2', 'snake')]) }).mode).toBe('follow');
  });

  it('swoops in for a face-off I am in', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p3'], kind: 'rps', theme: null, visibility: 'public' };
    expect(shot({ beat: beatOf('faceOff', [started]) }).mode).toBe('swoop');
  });

  it('swoops in for a card aimed at me', () => {
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    expect(shot({ beat: beatOf('cardResolved', [card]) }).mode).toBe('swoop');
  });

  it('swoops in for my Mystery pick', () => {
    expect(shot({ window: 'mystery', myPick: true }).mode).toBe('swoop');
  });

  it('follows the watched piece instead of mine', () => {
    expect(shot({ watch: 'p2', beat: beatOf('slide', [moved('p0', 'snake')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
  });

  it('cuts instead of swooping with reduced motion', () => {
    expect(shot({ window: 'mystery', myPick: true, reducedMotion: true })).toMatchObject({ mode: 'swoop', cut: true });
  });

  it('swoops onto my win, and follows anyone else who wins', () => {
    const won = (winner: PlayerId): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(shot({ beat: beatOf('victory', [won('p0')]) })).toMatchObject({ mode: 'swoop', target: SPOTS.p0 });
    expect(shot({ beat: beatOf('victory', [won('p3')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p3 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/camera.test.ts`
Expected: FAIL with `Cannot find module '../src/scene/camera'`.

- [ ] **Step 3: Implement the rules**

Create `apps/client/src/scene/camera.ts`:

```ts
import type { PlayerId, WindowKind } from '@laddorious/core';
import type { Beat } from '../director/beats';
import type { Vec3 } from './layout';

export type ShotMode = 'overview' | 'follow' | 'swoop';

export interface Shot {
  mode: ShotMode;
  position: Vec3;
  target: Vec3;
  /** Jump straight there instead of easing (reduced motion). */
  cut: boolean;
}

export interface ShotInput {
  /** The beat on stage. */
  beat: Beat | null;
  /** The settled window, or null before the first update. */
  window: WindowKind | null;
  /** My own Mystery pick is open. */
  myPick: boolean;
  me: PlayerId;
  /** Watch mode: follow this piece instead of mine (spec #2 §5.3). */
  watch: PlayerId | null;
  /** A piece's world position right now. */
  piece: (player: PlayerId) => Vec3;
  reducedMotion: boolean;
  nowMs: number;
}

const FOLLOW: Vec3 = [0, 7.5, 8.5];
const SWOOP: Vec3 = [0, 3.4, 4.6];
const OVERVIEW_RADIUS = 21;
const OVERVIEW_HEIGHT = 20;

const offset = (at: Vec3, by: Vec3): Vec3 => [at[0] + by[0], at[1] + by[1], at[2] + by[2]];
const follow = (at: Vec3): Shot => ({ mode: 'follow', position: offset(at, FOLLOW), target: at, cut: false });

/** The camera rules of spec #2 §5.3. */
export function cameraShot(input: ShotInput): Shot {
  const { beat, me } = input;
  const won = beat?.kind === 'victory' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type === 'MatchWon') return won.winner === me ? swoop(input.piece(me), input) : follow(input.piece(won.winner));
  if (input.watch) return follow(input.piece(input.watch));
  const mine = input.piece(me);
  if (isMyMoment(input)) return swoop(mine, input);
  const busy = beat !== null && beat.kind !== 'roll' && beat.kind !== 'info';
  if (busy || input.window === 'challenge' || input.window === 'mystery') return follow(mine);
  // Everyone rolls: the whole board, drifting gently.
  const angle = input.reducedMotion ? 0 : Math.sin(input.nowMs / 9000) * 0.12;
  return { mode: 'overview', position: [Math.sin(angle) * OVERVIEW_RADIUS, OVERVIEW_HEIGHT, Math.cos(angle) * OVERVIEW_RADIUS], target: [0, 0, 0], cut: false };
}

function swoop(at: Vec3, input: ShotInput): Shot {
  return { mode: 'swoop', position: offset(at, SWOOP), target: at, cut: input.reducedMotion };
}

/** Swoops are only for your own moments: your collision, your slide or launch, a card aimed at you, your Mystery pick. */
function isMyMoment({ beat, me, myPick, window }: ShotInput): boolean {
  if (myPick && window === 'mystery') return true;
  return (
    beat?.events.some(
      (e) =>
        (e.type === 'ChallengeStarted' && e.players.includes(me)) ||
        (e.type === 'Moved' && e.player === me && (e.cause === 'snake' || e.cause === 'ladder')) ||
        (e.type === 'CardResolved' && e.target === me),
    ) ?? false
  );
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/camera.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  39 passed (39)` and `Tests  286 passed (286)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the camera rules

Overview with a gentle drift while everyone rolls, follow my piece
while moves and cards resolve, swoop only for my own moments, follow a
watched piece, and cut instead of swooping with reduced motion (spec #2
§5.3).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The 3D scene

**Files:**
- Create:
  - `apps/client/src/scene/textures.ts`, `apps/client/src/scene/Board.tsx`, `apps/client/src/scene/Jumps.tsx`, `apps/client/src/scene/Surroundings.tsx`, `apps/client/src/scene/Pieces.tsx`, `apps/client/src/scene/CameraRig.tsx`, `apps/client/src/scene/Probes.tsx`, `apps/client/src/scene/MatchScene.tsx`;
  - tests: `apps/client/test/scene.test.tsx`, `apps/client/test/matchScene.test.tsx`.
- Modify: `apps/client/package.json` (test renderer, through `pnpm add`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: everything from Tasks 1–6; `Director` (Phase 3); `SeatInfo` (Phase 2).
- Produces:
  - `WEBGL_MESSAGE` and `webglAvailable(): boolean`.
  - `interface SceneContentProps { director; seats; me; board: PlayerView['board']; level: QualityLevel; watch: PlayerId | null; reducedMotion: boolean }` and `function SceneContent(props)`, the canvas contents.
  - `interface MatchSceneProps { director; seats; me; setting: QualitySetting; watch?; reducedMotion?; showStats? }` and `function MatchScene(props)`.

- [ ] **Step 1: Add the test renderer**

Run: `pnpm --filter @laddorious/client add -D @react-three/test-renderer@^9.1.1`
Expected: completes without errors or peer warnings.

- [ ] **Step 2: Write the failing tests**

Create `apps/client/test/scene.test.tsx`:

```tsx
import type { Jump } from '@laddorious/core';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedMesh, Mesh, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { Director } from '../src/director/director';
import { SceneContent } from '../src/scene/MatchScene';
import type { QualityLevel } from '../src/scene/quality';
import { SEATS, openingUpdate } from './support/fixtures';

/** Draw calls and triangles the scene asks for: shadow casters draw twice when shadows are on. */
function budget(root: Object3D, shadows: boolean): { calls: number; triangles: number } {
  let calls = 0;
  let triangles = 0;
  root.traverseVisible((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry as BufferGeometry;
    const each = (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    const copies = node instanceof InstancedMesh ? node.count : 1;
    const passes = shadows && node.castShadow ? 2 : 1;
    calls += passes;
    triangles += each * copies * passes;
  });
  return { calls, triangles };
}

/** Render the opening of a match, on the fixture board or with these jumps instead. */
async function renderScene(level: QualityLevel, jumps?: Jump[]) {
  const director = new Director('p0', () => {});
  const opening = openingUpdate();
  director.push(jumps ? { ...opening, view: { ...opening.view, board: { ...opening.view.board, jumps } } } : opening);
  const board = director.store.getState().settled!.view.board;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneContent director={director} seats={SEATS} me="p0" board={board} level={level} watch={null} reducedMotion={false} />,
  );
  await renderer.advanceFrames(2, 1 / 60);
  return renderer.scene.instance as Object3D;
}

describe('the 3D scene (spec #2 §6)', () => {
  it('draws the 100 tiles in one instanced draw call', async () => {
    const tiles = (await renderScene('high')).getObjectByName('tiles');
    expect(tiles).toBeInstanceOf(InstancedMesh);
    expect((tiles as InstancedMesh).count).toBe(100);
  });

  it.each(['high', 'low'] as const)('stays inside the phone budget on %s: at most 100 draw calls and 150k triangles', async (level) => {
    const { calls, triangles } = budget(await renderScene(level), level === 'high');
    expect(calls).toBeLessThanOrEqual(100);
    expect(triangles).toBeLessThanOrEqual(150_000);
  });

  it('stays inside the budget on a board crowded with 60 long slides and pads', async () => {
    const jumps = Array.from({ length: 30 }, (_, i): Jump[] => [
      { id: `s${i}`, from: 99 - i, to: 2 + i },
      { id: `l${i}`, from: 3 + i, to: 97 - i },
    ]).flat();
    const { calls, triangles } = budget(await renderScene('high', jumps), true);
    expect(calls).toBeLessThanOrEqual(100);
    expect(triangles).toBeLessThanOrEqual(150_000);
  });
});
```

Create `apps/client/test/matchScene.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Director } from '../src/director/director';
import { MatchScene, WEBGL_MESSAGE } from '../src/scene/MatchScene';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows a message instead of the board when the browser has no WebGL (spec #2 §8)', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const director = new Director('p0', () => {});
  director.push(openingUpdate());
  render(<MatchScene director={director} seats={SEATS} me="p0" setting="auto" />);
  expect(screen.getByText(WEBGL_MESSAGE)).toBeTruthy();
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/scene.test.tsx apps/client/test/matchScene.test.tsx`
Expected: FAIL with `Cannot find module '../src/scene/MatchScene'` (or `Failed to resolve import`).

- [ ] **Step 4: Paint the textures**

Create `apps/client/src/scene/textures.ts`:

```ts
import type { Rarity } from '@laddorious/core';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { COLUMNS, TILE_SIZE, tileToWorld } from './layout';

/** Paint a canvas texture, or return null where there is no DOM (tests) or no 2D context. */
function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const BOARD_PX = 1024;

/** All tile numbers and "?" glyphs in one transparent texture over the board (spec #2 §6.1). */
export function boardOverlayTexture(size: number, mystery: Record<number, Rarity>, glyph: Record<Rarity, string>, ink: string): CanvasTexture | null {
  const span = TILE_SIZE * COLUMNS;
  const cell = BOARD_PX / COLUMNS;
  return paint(BOARD_PX, BOARD_PX, (ctx) => {
    ctx.textBaseline = 'middle';
    for (let tile = 1; tile <= size; tile++) {
      const [x, , z] = tileToWorld(tile);
      const px = (x / span + 0.5) * BOARD_PX;
      const py = (z / span + 0.5) * BOARD_PX;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.round(cell * 0.24)}px system-ui, sans-serif`;
      ctx.fillText(String(tile), px - cell * 0.42, py - cell * 0.32);
      ctx.globalAlpha = 1;
      const rarity = mystery[tile];
      if (rarity) {
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(cell * 0.62)}px system-ui, sans-serif`;
        ctx.lineWidth = cell * 0.06;
        ctx.strokeStyle = ink;
        ctx.strokeText('?', px, py + cell * 0.04);
        ctx.fillStyle = glyph[rarity];
        ctx.fillText('?', px, py + cell * 0.04);
      }
    }
  });
}

/** A chevron stripe that tiles; scrolling its offset moves the chevrons along a slide or pad. */
export function chevronTexture(base: string, stripe: string): CanvasTexture | null {
  const texture = paint(64, 64, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(14, 44);
    ctx.lineTo(32, 22);
    ctx.lineTo(50, 44);
    ctx.stroke();
  });
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
  }
  return texture;
}

/** A three-armed spiral for the vortex at a slide's head. */
export function swirlTexture(base: string, arm: string): CanvasTexture | null {
  return paint(128, 128, (ctx) => {
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = arm;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2.2 + (k * Math.PI * 2) / 3;
        const r = 6 + (i / 40) * 54;
        if (i === 0) ctx.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        else ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
  });
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

/** The 3×2 pip atlas the die faces map into: face n in cell n − 1, row 0 at the bottom. */
export function dieAtlasTexture(face: string, pip: string): CanvasTexture | null {
  return paint(384, 256, (ctx) => {
    for (let n = 1; n <= 6; n++) {
      const cell = n - 1;
      const x0 = (cell % 3) * 128;
      const y0 = (1 - Math.floor(cell / 3)) * 128;
      ctx.fillStyle = face;
      ctx.fillRect(x0, y0, 128, 128);
      ctx.fillStyle = pip;
      for (const [u, v] of PIPS[n]!) {
        ctx.beginPath();
        ctx.arc(x0 + u * 128, y0 + v * 128, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** The sky behind everything: teal at the top melting into apricot at the horizon (spec #2 §7.4). */
export function skyTexture(stops: readonly string[]): CanvasTexture | null {
  return paint(2, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  });
}
```

- [ ] **Step 5: Build the board**

Create `apps/client/src/scene/Board.tsx`:

```tsx
import type { PlayerView } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import type { Director } from '../director/director';
import { COLUMNS, TILE_SIZE, squareColorIndex, tileToWorld } from './layout';
import { boardOverlayTexture } from './textures';

type PublicBoard = PlayerView['board'];

/** Tiles are this thick; their top faces sit at y = 0. */
export const TILE_THICKNESS = 0.22;
const MAX_RINGS = 4;

export function tileColor(tile: number, board: PublicBoard): string {
  if (tile === board.size) return BOARD_COLORS.goal;
  if (board.mystery[tile]) return BOARD_COLORS.mystery;
  return BOARD_COLORS.squares[squareColorIndex(tile, BOARD_COLORS.squares.length)]!;
}

/** The tiles as one instanced draw call, one overlay for every number and glyph, and rings on landed "?" squares (spec #2 §6.1). */
export function Board({ board, director }: { board: PublicBoard; director: Director }) {
  const tiles = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const overlay = useMemo(() => boardOverlayTexture(board.size, board.mystery, BOARD_COLORS.rarity, WORLD_COLORS.ink), [board]);

  useLayoutEffect(() => {
    const mesh = tiles.current;
    if (!mesh) return;
    const at = new Object3D();
    const color = new Color();
    for (let tile = 1; tile <= board.size; tile++) {
      const [x, , z] = tileToWorld(tile);
      at.position.set(x, -TILE_THICKNESS / 2, z);
      at.updateMatrix();
      mesh.setMatrixAt(tile - 1, at.matrix);
      mesh.setColorAt(tile - 1, color.set(tileColor(tile, board)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [board]);

  // A ring pulses on each "?" square with a piece on it, from the landing until the Mystery phase ends.
  useFrame(({ clock }) => {
    const mesh = rings.current;
    if (!mesh) return;
    const { presentation, settled } = director.store.getState();
    const phase = settled?.view.phase.kind;
    const live =
      presentation && (phase === 'settle' || phase === 'mysterySelect')
        ? [...new Set(Object.values(presentation.positions))].filter((tile) => board.mystery[tile])
        : [];
    const pulse = 1 + 0.08 * Math.sin(clock.elapsedTime * 6);
    for (let i = 0; i < MAX_RINGS; i++) {
      const tile = live[i];
      if (tile === undefined) {
        place.scale.setScalar(0);
      } else {
        const [x, , z] = tileToWorld(tile);
        place.position.set(x, 0.014, z);
        place.rotation.set(-Math.PI / 2, 0, 0);
        place.scale.setScalar(pulse);
      }
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={tiles} name="tiles" args={[undefined, undefined, board.size]} receiveShadow>
        <boxGeometry args={[TILE_SIZE * 0.95, TILE_THICKNESS, TILE_SIZE * 0.95]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {overlay && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
          <planeGeometry args={[TILE_SIZE * COLUMNS, TILE_SIZE * COLUMNS]} />
          <meshBasicMaterial map={overlay} transparent depthWrite={false} />
        </mesh>
      )}
      <instancedMesh ref={rings} args={[undefined, undefined, MAX_RINGS]}>
        <ringGeometry args={[0.6, 0.74, 32]} />
        <meshBasicMaterial color={WORLD_COLORS.ring} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  );
}
```

- [ ] **Step 6: Build the slides and pads**

Create `apps/client/src/scene/Jumps.tsx`:

```tsx
import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Object3D, type InstancedMesh, type Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from 'zustand';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import type { Director } from '../director/director';
import { arcPoint, slideCurve, tileToWorld, type Vec3 } from './layout';
import { clamp01, easeOutBack } from './motion';
import { chevronTexture, swirlTexture } from './textures';

const RIBBON_WIDTH = 0.62;
/** Caps that keep a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;
const MAX_DOTS = 480;

/** A flat strip along points, `width` wide at height y; v runs along it in widths so chevrons tile. */
export function ribbonGeometry(points: Vector3[], width: number, y: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  let along = 0;
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    const sx = (-dz / length) * (width / 2);
    const sz = (dx / length) * (width / 2);
    if (i > 0) along += p.distanceTo(points[i - 1]!);
    positions.push(p.x + sx, y, p.z + sz, p.x - sx, y, p.z - sz);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, along / width, 1, along / width);
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** The dots of a launch pad's arc, between its foot and its top. */
export function padArc(jump: Jump): Vec3[] {
  const from = tileToWorld(jump.from);
  const to = tileToWorld(jump.to);
  const span = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const count = Math.max(5, Math.round(span / 0.45));
  return Array.from({ length: count - 1 }, (_, i) => arcPoint(from, to, (i + 1) / count, 1.2 + span * 0.12));
}

function strips(paths: Vector3[][], width: number, y: number): BufferGeometry | null {
  return paths.length === 0 ? null : mergeGeometries(paths.map((points) => ribbonGeometry(points, width, y)));
}

/** Slides (flat vacuum chutes) and launch pads (spec #2 §6.1); parts a board edit adds or removes pop in or out. */
export function Jumps({ director }: { director: Director }) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const paths = useMemo(() => snakes.map((j) => slideCurve(j.from, j.to).getPoints(40)), [snakes]);
  const ribbons = useMemo(() => strips(paths, RIBBON_WIDTH, 0.024), [paths]);
  const edges = useMemo(() => strips(paths, RIBBON_WIDTH + 0.16, 0.016), [paths]);
  const dots = useMemo(() => ladders.flatMap(padArc).slice(0, MAX_DOTS), [ladders]);
  const chevrons = useMemo(() => chevronTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const padChevrons = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.ink), []);
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vortices = useRef<InstancedMesh>(null);
  const exits = useRef<InstancedMesh>(null);
  const pads = useRef<InstancedMesh>(null);
  const targets = useRef<InstancedMesh>(null);
  const dotMesh = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);

  useEffect(
    () => () => {
      ribbons?.dispose();
      edges?.dispose();
    },
    [ribbons, edges],
  );

  useLayoutEffect(() => {
    const mesh = dotMesh.current;
    if (!mesh) return;
    dots.forEach((p, i) => {
      place.position.set(...p);
      place.rotation.set(0, 0, 0);
      place.scale.setScalar(1);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    mesh.count = dots.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dots, place]);

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
    const stamp = (mesh: InstancedMesh | null, list: Jump[], tile: (j: Jump) => number, spin: (j: Jump) => number) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        const [x, , z] = tileToWorld(tile(j));
        place.position.set(x, 0.03, z);
        place.rotation.set(-Math.PI / 2, 0, spin(j));
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    // Pads turn their chevrons towards the ladder's top.
    const towardsTop = (j: Jump) => {
      const [fx, , fz] = tileToWorld(j.from);
      const [tx, , tz] = tileToWorld(j.to);
      return Math.atan2(-(tx - fx), -(tz - fz));
    };
    stamp(vortices.current, snakes, (j) => j.from, () => clock.elapsedTime * 2.5);
    stamp(exits.current, snakes, (j) => j.to, () => 0);
    stamp(pads.current, ladders, (j) => j.from, towardsTop);
    stamp(targets.current, ladders, (j) => j.to, () => 0);
    if (chevrons) chevrons.offset.y -= delta * 0.8;
    if (padChevrons) padChevrons.offset.y -= delta * 0.6;
  });

  return (
    <group>
      {edges && (
        <mesh geometry={edges}>
          <meshStandardMaterial color={WORLD_COLORS.ink} side={DoubleSide} roughness={0.9} />
        </mesh>
      )}
      {ribbons && (
        <mesh geometry={ribbons} receiveShadow>
          <meshStandardMaterial {...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide })} side={DoubleSide} roughness={0.8} />
        </mesh>
      )}
      <instancedMesh ref={vortices} args={[undefined, undefined, MAX_JUMPS]}>
        <circleGeometry args={[0.58, 32]} />
        <meshBasicMaterial {...(swirl ? { map: swirl } : { color: BOARD_COLORS.slide })} transparent />
      </instancedMesh>
      <instancedMesh ref={exits} args={[undefined, undefined, MAX_JUMPS]}>
        <ringGeometry args={[0.4, 0.56, 28]} />
        <meshBasicMaterial color={WORLD_COLORS.chevron} />
      </instancedMesh>
      <instancedMesh ref={pads} args={[undefined, undefined, MAX_JUMPS]}>
        <circleGeometry args={[0.6, 28]} />
        <meshStandardMaterial {...(padChevrons ? { map: padChevrons } : { color: WORLD_COLORS.pad })} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={targets} args={[undefined, undefined, MAX_JUMPS]}>
        <ringGeometry args={[0.42, 0.6, 28]} />
        <meshBasicMaterial color={WORLD_COLORS.pad} />
      </instancedMesh>
      <instancedMesh ref={dotMesh} args={[undefined, undefined, MAX_DOTS]}>
        <icosahedronGeometry args={[0.075, 1]} />
        <meshBasicMaterial color={WORLD_COLORS.pad} />
      </instancedMesh>
    </group>
  );
}
```

- [ ] **Step 7: Build the surroundings**

Create `apps/client/src/scene/Surroundings.tsx`:

```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color, CylinderGeometry, DoubleSide, Fog, Object3D, type Group, type InstancedMesh } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { crownGeometry } from '../assets/models';
import { Slot } from '../assets/slots';
import { COLUMNS, TILE_SIZE, tileToWorld, type Vec3 } from './layout';
import { skyTexture } from './textures';

/** The island under the board: a wobbly, sand-topped rock in one draw call (vertex colours). */
export function islandGeometry(): CylinderGeometry {
  const g = new CylinderGeometry(12.5, 8.5, 2.4, 40, 1);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const sand = new Color(WORLD_COLORS.islandTop);
  const rock = new Color(WORLD_COLORS.islandRock);
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const wobble = 1 + 0.05 * Math.sin(angle * 5) + 0.035 * Math.cos(angle * 3);
    pos.setX(i, pos.getX(i) * wobble);
    pos.setZ(i, pos.getZ(i) * wobble);
    (pos.getY(i) > 1.1 ? sand : rock).toArray(colors, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

const EDGE = (TILE_SIZE * COLUMNS) / 2 + 0.6;
/** Bumpers ring the board, nine to a side. */
const BUMPERS: Vec3[] = Array.from({ length: 9 }, (_, i) => -EDGE + (i + 0.5) * ((2 * EDGE) / 9)).flatMap((t): Vec3[] => [
  [t, -0.02, -EDGE],
  [t, -0.02, EDGE],
  [-EDGE, -0.02, t],
  [EDGE, -0.02, t],
]);
const CLOUDS: Vec3[] = Array.from({ length: 8 }, (_, i): Vec3 => {
  const a = (i / 8) * Math.PI * 2 + 0.4;
  const r = 20 + (i % 3) * 3;
  return [Math.cos(a) * r, 5 + (i % 4), Math.sin(a) * r];
});
/** Each cloud is three puffs: [x offset, y offset, size]. */
const PUFFS: Vec3[] = [
  [-0.9, 0, 1],
  [0, 0.35, 1.3],
  [0.9, -0.05, 0.95],
];

/** Sky, fog, light, the island with its bumpers, the clouds and the crown on tile 100 (spec #2 §6.1). */
export function Surroundings({ shadows, clouds }: { shadows: boolean; clouds: number }) {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const island = useMemo(() => islandGeometry(), []);
  const crown = useMemo(() => crownGeometry(), []);
  const crownRef = useRef<Group>(null);
  const cloudGroup = useRef<Group>(null);
  const bumpers = useRef<InstancedMesh>(null);
  const puffs = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const { background, fog } = scene;
    scene.background = sky ?? new Color(WORLD_COLORS.sky[1]);
    scene.fog = new Fog(WORLD_COLORS.fog, 36, 95);
    return () => {
      scene.background = background;
      scene.fog = fog;
    };
  }, [scene, sky]);

  useLayoutEffect(() => {
    const mesh = bumpers.current;
    if (!mesh) return;
    const at = new Object3D();
    const color = new Color();
    BUMPERS.forEach((spot, i) => {
      at.position.set(...spot);
      at.updateMatrix();
      mesh.setMatrixAt(i, at.matrix);
      mesh.setColorAt(i, color.set(WORLD_COLORS.bumper[i % 2]!));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useLayoutEffect(() => {
    const mesh = puffs.current;
    if (!mesh) return;
    const at = new Object3D();
    let n = 0;
    CLOUDS.slice(0, clouds).forEach(([x, y, z], c) => {
      for (const [dx, dy, size] of PUFFS) {
        at.position.set(x + dx, y + dy, z);
        at.scale.setScalar(size * (1 + (c % 3) * 0.15));
        at.updateMatrix();
        mesh.setMatrixAt(n, at.matrix);
        n += 1;
      }
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }, [clouds]);

  useFrame((_, delta) => {
    if (crownRef.current) crownRef.current.rotation.y += delta * 0.9;
    if (cloudGroup.current) cloudGroup.current.rotation.y += delta * 0.01;
  });

  const goal = tileToWorld(100);
  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.islandRock, 1.15]} />
      <directionalLight
        position={[9, 18, 11]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
      />
      <Slot
        name="island"
        fallback={
          <mesh geometry={island} position-y={-1.42} receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.9} />
          </mesh>
        }
      />
      <instancedMesh ref={bumpers} args={[undefined, undefined, BUMPERS.length]}>
        <cylinderGeometry args={[0.22, 0.26, 0.4, 14]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <group ref={cloudGroup}>
        <instancedMesh ref={puffs} args={[undefined, undefined, CLOUDS.length * PUFFS.length]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshLambertMaterial color={WORLD_COLORS.cloud} />
        </instancedMesh>
      </group>
      <group ref={crownRef} position={[goal[0], 0.22, goal[2]]}>
        <Slot
          name="crown"
          fallback={
            <mesh geometry={crown} castShadow={shadows}>
              <meshStandardMaterial color={WORLD_COLORS.crown} metalness={0.55} roughness={0.28} side={DoubleSide} />
            </mesh>
          }
        />
      </group>
    </>
  );
}
```

- [ ] **Step 8: Build the pieces, dice and shields**

Create `apps/client/src/scene/Pieces.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { PIECE_GEOMETRY, dieGeometry, dieRotationFor } from '../assets/models';
import { Slot, type SlotName } from '../assets/slots';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { clamp01, easeOut, poseAt, projectileAt, withIdle, type Pose } from './motion';
import { dieAtlasTexture } from './textures';

/** Pieces render at 1.3 × their base size (spec #2 §6.2). */
export const PIECE_SCALE = 1.3;
const DIE_LIFT = 2.2;
const SHIELD_HOOKS = new Set(['beforeSnake', 'beforeAttack']);

interface Roll {
  face: number;
  forced: boolean;
  startedAt: number;
  durationMs: number;
}

interface PiecesProps {
  director: Director;
  seats: SeatInfo[];
  shadows: boolean;
  reducedMotion: boolean;
  boardSize: number;
}

/** Every seat's piece, its die and its shield bubble, and card projectiles (spec #2 §5.1, §6.2). */
export function Pieces({ director, seats, shadows, reducedMotion, boardSize }: PiecesProps) {
  const seatOf = useMemo(() => {
    const index = new Map(seats.map((s, i) => [s.playerId, i]));
    return (player: PlayerId) => index.get(player) ?? 0;
  }, [seats]);
  // A die shows from its roll beat until the pieces start moving.
  const rolls = useRef(new Map<PlayerId, Roll>());
  useEffect(
    () =>
      director.store.subscribe((s, prev) => {
        if (!s.beat || s.beat === prev.beat) return;
        if (s.beat.kind !== 'roll') {
          rolls.current.clear();
          return;
        }
        for (const e of s.beat.events) {
          if (e.type === 'DieRolled') rolls.current.set(e.player, { face: e.face, forced: e.forced, startedAt: s.beat.startedAt, durationMs: s.beat.durationMs });
        }
      }),
    [director],
  );
  return (
    <>
      {seats.map((seat, i) => (
        <Actor key={seat.playerId} director={director} seat={seat} index={i} shadows={shadows} reducedMotion={reducedMotion} boardSize={boardSize} rolls={rolls} />
      ))}
      <Projectile director={director} seatOf={seatOf} />
    </>
  );
}

/** One orb that carries each card from its caster to its target. */
function Projectile({ director, seatOf }: { director: Director; seatOf: (player: PlayerId) => number }) {
  const orb = useRef<Mesh>(null);
  useFrame(() => {
    const { beat, presentation } = director.store.getState();
    const at = beat && presentation ? projectileAt(beat, presentation, seatOf, Date.now()) : null;
    if (!orb.current) return;
    orb.current.visible = at !== null;
    if (at) orb.current.position.set(...at);
  });
  return (
    <mesh ref={orb} visible={false}>
      <icosahedronGeometry args={[0.22, 1]} />
      <meshBasicMaterial color={WORLD_COLORS.chevron} />
    </mesh>
  );
}

function place(target: Group | Mesh, pose: Pose) {
  target.position.set(...pose.position);
  target.rotation.set(...pose.rotation);
  target.scale.set(...pose.scale);
}

interface ActorProps extends Omit<PiecesProps, 'seats'> {
  seat: SeatInfo;
  index: number;
  rolls: RefObject<Map<PlayerId, Roll>>;
}

function Actor({ director, seat, index, shadows, reducedMotion, boardSize, rolls }: ActorProps) {
  const body = useRef<Group>(null);
  const model = useRef<Group>(null);
  const orb = useRef<Mesh>(null);
  const blob = useRef<Mesh>(null);
  const die = useRef<Mesh>(null);
  const shield = useRef<Mesh>(null);
  const geometry = useMemo(() => PIECE_GEOMETRY[seat.piece](), [seat.piece]);
  const dieShape = useMemo(() => dieGeometry(), []);
  const atlas = useMemo(() => dieAtlasTexture(WORLD_COLORS.die, WORLD_COLORS.pip), []);
  const slot = `piece.${seat.piece}` as SlotName;

  useFrame(() => {
    const state = director.store.getState();
    const now = Date.now();
    const pose = poseAt(state, seat.playerId, index, now, boardSize);
    if (!pose || !body.current || !model.current || !orb.current || !die.current || !shield.current) return;
    const acting = state.beat?.events.some((e) => (e.type === 'Moved' && e.player === seat.playerId) || (e.type === 'MatchWon' && e.winner === seat.playerId)) ?? false;
    place(body.current, reducedMotion || acting ? pose : withIdle(pose, now, index * 1.7));
    model.current.visible = !pose.orb;
    orb.current.visible = pose.orb;
    if (blob.current) {
      const s = Math.max(0.35, 1 - pose.position[1] * 0.25);
      blob.current.position.set(pose.position[0], 0.012, pose.position[2]);
      blob.current.scale.set(s, s, s);
    }
    // The die tumbles above the piece and settles on the rolled face; forced faces flash (spec #2 §5.1).
    const roll = rolls.current.get(seat.playerId);
    die.current.visible = roll !== undefined;
    if (roll) {
      const spin = 1 - easeOut(clamp01((now - roll.startedAt) / roll.durationMs));
      const [rx, ry, rz] = dieRotationFor(roll.face);
      die.current.position.set(pose.position[0], pose.position[1] + DIE_LIFT + spin * 0.8, pose.position[2]);
      die.current.rotation.set(rx + spin * Math.PI * 6, ry + spin * Math.PI * 4, rz + spin * Math.PI * 5);
      (die.current.material as MeshStandardMaterial).emissiveIntensity = roll.forced ? 0.35 + 0.35 * Math.sin(now / 90) : 0;
    }
    // The shield bubble shows while a shield effect is up and flares when it blocks.
    const shielded = state.presentation?.effects.some((e) => e.owner === seat.playerId && SHIELD_HOOKS.has(e.params.hook)) ?? false;
    const blocking =
      state.beat?.events.some((e) => (e.type === 'SnakeBlocked' && e.player === seat.playerId) || (e.type === 'CardResolved' && e.target === seat.playerId && e.result === 'blocked')) ?? false;
    shield.current.visible = shielded || blocking;
    shield.current.position.set(pose.position[0], pose.position[1] + 0.7, pose.position[2]);
    (shield.current.material as MeshBasicMaterial).opacity = blocking ? 0.45 + 0.3 * Math.sin(now / 60) : 0.22;
  });

  return (
    <>
      <group ref={body}>
        <group ref={model} scale={PIECE_SCALE}>
          <Slot
            name={slot}
            color={seat.color}
            fallback={
              <mesh geometry={geometry} castShadow={shadows}>
                <meshPhysicalMaterial color={seat.color} clearcoat={1} clearcoatRoughness={0.12} roughness={0.32} />
              </mesh>
            }
          />
        </group>
        <mesh ref={orb} visible={false}>
          <sphereGeometry args={[0.3, 16, 12]} />
          <meshBasicMaterial color={WORLD_COLORS.orb} />
        </mesh>
      </group>
      {!shadows && (
        <mesh ref={blob} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.55, 20]} />
          <meshBasicMaterial color={WORLD_COLORS.ink} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={die} geometry={dieShape} visible={false} castShadow={shadows}>
        <meshStandardMaterial {...(atlas ? { map: atlas } : { color: WORLD_COLORS.die })} emissive={WORLD_COLORS.crown} emissiveIntensity={0} roughness={0.4} />
      </mesh>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[0.95, 24, 16]} />
        <meshBasicMaterial color={WORLD_COLORS.shield} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  );
}
```

- [ ] **Step 9: Build the camera rig, the probes and the scene**

Create `apps/client/src/scene/CameraRig.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { cameraShot } from './camera';
import type { Vec3 } from './layout';
import { poseAt } from './motion';

interface CameraRigProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  watch: PlayerId | null;
  reducedMotion: boolean;
  boardSize: number;
}

/** Moves the camera by the rules of spec #2 §5.3, easing between shots unless a shot is a cut. */
export function CameraRig({ director, seats, me, watch, reducedMotion, boardSize }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3(0, 0, 0));
  const aim = useMemo(() => ({ position: new Vector3(), target: new Vector3() }), []);
  const seatOf = useMemo(() => new Map(seats.map((s, i) => [s.playerId, i])), [seats]);

  useFrame((_, delta) => {
    const state = director.store.getState();
    const now = Date.now();
    const offer = state.settled?.view.myOffer;
    const shot = cameraShot({
      beat: state.beat,
      window: state.settled?.view.awaiting.window ?? null,
      myPick: !!offer && offer.picked === null,
      me,
      watch,
      reducedMotion,
      nowMs: now,
      piece: (id): Vec3 => poseAt(state, id, seatOf.get(id) ?? 0, now, boardSize)?.position ?? [0, 0, 0],
    });
    const k = shot.cut ? 1 : 1 - Math.exp(-delta * (shot.mode === 'swoop' ? 2.8 : 1.8));
    camera.position.lerp(aim.position.set(...shot.position), k);
    look.current.lerp(aim.target.set(...shot.target), k);
    camera.lookAt(look.current);
  });
  return null;
}
```

Create `apps/client/src/scene/Probes.tsx`:

```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { FrameRateWatch } from './quality';
import { renderStats } from './stats';

/** Samples fps, draw calls and triangles for the dev overlay every half second (spec #2 §6.4). */
export function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const sample = useRef({ frames: 0, seconds: 0 });
  useFrame((_, delta) => {
    const w = sample.current;
    w.frames += 1;
    w.seconds += delta;
    if (w.seconds < 0.5) return;
    renderStats.setState({ fps: Math.round(w.frames / w.seconds), calls: gl.info.render.calls, triangles: gl.info.render.triangles });
    w.frames = 0;
    w.seconds = 0;
  });
  return null;
}

/** Auto quality: steps down to Low when the frame rate sags (spec #2 §6.4). */
export function QualityWatch({ onStepDown }: { onStepDown: () => void }) {
  const watch = useMemo(() => new FrameRateWatch(), []);
  useFrame((_, delta) => {
    if (watch.add(delta * 1000)) onStepDown();
  });
  return null;
}

/** A lost WebGL context gets 3 s to come back; then the board gives way to the WebGL message (spec #2 §8). */
export function ContextLossWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lost = (e: Event) => {
      e.preventDefault();
      timer = setTimeout(onLost, 3000);
    };
    const restored = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      if (timer !== null) clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, onLost]);
  return null;
}
```

Create `apps/client/src/scene/MatchScene.tsx`:

```tsx
import type { PlayerId, PlayerView } from '@laddorious/core';
import { Canvas } from '@react-three/fiber';
import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { Jumps } from './Jumps';
import { Pieces } from './Pieces';
import { ContextLossWatch, QualityWatch, StatsProbe } from './Probes';
import { QUALITY, startLevel, type QualityLevel, type QualitySetting } from './quality';
import { Surroundings } from './Surroundings';

export const WEBGL_MESSAGE = "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox.";

/** Can this browser draw WebGL? (spec #2 §8) */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function device() {
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const shortSide = typeof screen === 'undefined' ? 1000 : Math.min(screen.width, screen.height);
  return { coarsePointer, shortSide };
}

export interface SceneContentProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  board: PlayerView['board'];
  level: QualityLevel;
  watch: PlayerId | null;
  reducedMotion: boolean;
}

/** Everything inside the canvas: the world, the pieces and the camera (spec #2 §6). */
export function SceneContent({ director, seats, me, board, level, watch, reducedMotion }: SceneContentProps) {
  const profile = QUALITY[level];
  return (
    <>
      <Surroundings shadows={profile.shadows} clouds={profile.clouds} />
      <Board board={board} director={director} />
      <Jumps director={director} />
      <Pieces director={director} seats={seats} shadows={profile.shadows} reducedMotion={reducedMotion} boardSize={board.size} />
      <CameraRig director={director} seats={seats} me={me} watch={watch} reducedMotion={reducedMotion} boardSize={board.size} />
    </>
  );
}

export interface MatchSceneProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  setting: QualitySetting;
  watch?: PlayerId | null;
  reducedMotion?: boolean;
  showStats?: boolean;
}

/**
 * The match in 3D. To change the quality setting, remount it with a new `key`:
 * antialiasing is fixed when the WebGL context is made. Auto steps down to Low live.
 */
export function MatchScene({ director, seats, me, setting, watch = null, reducedMotion = false, showStats = false }: MatchSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level, setLevel] = useState<QualityLevel>(() => startLevel(setting, device()));
  const board = useStore(director.store, (s) => s.settled?.view.board);
  const stepDown = useCallback(() => setLevel('low'), []);
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return <p className="webgl-message">{WEBGL_MESSAGE}</p>;
  if (!board) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      <Canvas shadows={profile.shadows} dpr={[1, profile.dpr]} gl={{ antialias: profile.antialias }} camera={{ fov: 42, near: 0.5, far: 200, position: [0, 20, 21] }}>
        <SceneContent director={director} seats={seats} me={me} board={board} level={level} watch={watch} reducedMotion={reducedMotion} />
        {showStats && <StatsProbe />}
        {setting === 'auto' && level === 'high' && <QualityWatch onStepDown={stepDown} />}
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 10: Run the tests again**

Run: `pnpm vitest run apps/client/test/scene.test.tsx apps/client/test/matchScene.test.tsx`
Expected: PASS, 2 files, 5 tests.

- [ ] **Step 11: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  41 passed (41)` and `Tests  291 passed (291)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 12: Commit**

```bash
git add apps/client pnpm-lock.yaml
git commit -m "feat(client): build the 3D scene

Instanced board with one overlay texture and landing rings; flat slides
with scrolling chevrons, vortices and exit rings; launch pads with
dotted arcs; island, bumpers, clouds, sky and crown; pieces animated
through every beat with dice and shields; the camera rig, quality
levels, render stats and WebGL fallbacks (spec #2 §5.3, §6, §8). A
scene-graph test keeps it inside 100 draw calls and 150k triangles.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The dev page in 3D, with a ROLL button

**Files:**
- Modify: `apps/client/src/app/DevMatchPage.tsx` (replaced whole), `apps/client/test/DevMatchPage.test.tsx` (replaced whole), `apps/client/src/app/dev.css`, `README.md`
- Delete: `apps/client/src/app/DevBoard.tsx`

**Interfaces:**
- Consumes: `MatchScene` (Task 7); `QualitySetting` (Task 2); `renderStats` (Task 2); the Phase 3 page.
- Produces: the dev page shows the 3D scene, a ROLL button (one roll per dice window), a quality picker (Auto, Low, High) and, in dev builds, the stats overlay.

- [ ] **Step 1: Write the failing tests**

Replace `apps/client/test/DevMatchPage.test.tsx` with:

```tsx
// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevMatchPage, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/DevMatchPage';
import { BEAT_MS } from '../src/director/beats';
import type { Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';

// jsdom has no WebGL: stand the 3D scene in with a labelled box that shows its quality setting.
vi.mock('../src/scene/MatchScene', async () => {
  const { createElement } = await import('react');
  return { MatchScene: ({ setting }: { setting: string }) => createElement('div', { role: 'img', 'aria-label': `3D board, ${setting}` }) };
});

/** Matchmaking the test drives by hand. */
class ScriptedMatchmaking implements Matchmaking {
  private listener: ((s: MatchmakingState) => void) | null = null;
  cancel = vi.fn();
  playWithBots = vi.fn();

  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }

  emit(s: MatchmakingState): void {
    act(() => this.listener?.(s));
  }
}

/** A session the test drives by hand. */
class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private failed: ((e: { message: string }) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {};
  }

  onRejected(): () => void {
    return () => {};
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    this.failed = cb;
    return () => {};
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  fail(message: string): void {
    act(() => this.failed?.({ message }));
  }
}

function startSearch() {
  const matchmaking = new ScriptedMatchmaking();
  const findMatch = vi.fn(() => matchmaking);
  render(<DevMatchPage service={{ findMatch }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Find match' }));
  return { matchmaking, findMatch };
}

function startMatch() {
  const { matchmaking } = startSearch();
  const session = new ScriptedSession();
  matchmaking.emit({ kind: 'found', session });
  return session;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DevMatchPage', () => {
  it('searches with the dev profile and offers Play with bots only after 15 s', () => {
    const { matchmaking, findMatch } = startSearch();
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'You', piece: 'knight' });
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS - 250, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByText('Finding players… 14 s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('plays each update as beats, then reports playback done and counts the window down', () => {
    const session = startMatch();
    const opening = openingUpdate();
    session.update(opening);
    expect(session.playbackDone).toHaveBeenCalledWith(1);
    expect(screen.getByText('Round 1 · dice window · waiting for You, Mochi, Pip, Juno · waiting for playback')).toBeTruthy();

    const roll: GameEvent = { type: 'DieRolled', player: 'p1', natural: 5, face: 5, forced: false, auto: false, visibility: 'public' };
    session.update({ ...opening, events: [roll], timer: { windowId: 1, endsAt: 12_000 } });
    expect(screen.getByText(/DieRolled player=Mochi natural=5/)).toBeTruthy();
    expect(screen.getByText('▶ roll · 0.9 s')).toBeTruthy();
    act(() => vi.advanceTimersByTime(BEAT_MS.roll));
    expect(screen.queryByText('▶ roll · 0.9 s')).toBeNull();
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 12 s$/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 7 s$/)).toBeTruthy();
    expect(session.playbackDone).toHaveBeenCalledTimes(1);
  });

  it('shows the 3D board and offers ROLL once in my dice window', () => {
    const session = startMatch();
    session.update(openingUpdate());
    expect(screen.getByRole('img', { name: '3D board, auto' })).toBeTruthy();
    const roll = screen.getByRole('button', { name: 'ROLL' });
    fireEvent.click(roll);
    fireEvent.click(roll);
    expect(session.send).toHaveBeenCalledTimes(1);
    expect(session.send).toHaveBeenCalledWith({ type: 'roll' });
    expect(screen.queryByRole('button', { name: 'ROLL' })).toBeNull();
  });

  it('switches the graphics quality', () => {
    const session = startMatch();
    session.update(openingUpdate());
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: 'low' } });
    expect(screen.getByRole('img', { name: '3D board, low' })).toBeTruthy();
  });

  it('shows the final rankings once the victory beat has played', () => {
    const session = startMatch();
    const { view } = openingUpdate();
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.queryByText('1. Pip — tile 100')).toBeNull();
    act(() => vi.advanceTimersByTime(BEAT_MS.victory));
    expect(screen.getByText('Round 21 · match over')).toBeTruthy();
    expect(screen.getByText('1. Pip — tile 100')).toBeTruthy();
    expect(screen.getByText('4. Mochi — tile 41')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ROLL' })).toBeNull();
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('pauses the match while the page is hidden', () => {
    const session = startMatch();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('logs a failed match, and Leave ends the session and returns to the start', () => {
    const session = startMatch();
    session.fail('board corrupted');
    expect(screen.getByText(/FAILED board corrupted/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Find match' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and watch the new ones fail**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: FAIL in "shows the 3D board and offers ROLL once in my dice window" and "switches the graphics quality". The page still shows the flat board and has no ROLL button or quality picker.

- [ ] **Step 3: Put the 3D scene on the page**

Replace `apps/client/src/app/DevMatchPage.tsx` with:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Director } from '../director/director';
import { MatchScene } from '../scene/MatchScene';
import type { QualitySetting } from '../scene/quality';
import { renderStats } from '../scene/stats';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, MatchUpdate, Profile, SeatInfo } from '../service/matchService';
import { formatEvent } from './devLog';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;

const PROFILE: Profile = { nickname: 'You', piece: 'knight' };
const LOG_TAIL = 40;

/**
 * The dev page: matchmaking, then a bot match played in 3D with a minimal ROLL button,
 * the event log, the window timer and the final rankings. Phase 5 replaces it with the real screens.
 */
export function DevMatchPage({ service }: { service: MatchService }) {
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [mm, setMm] = useState<MatchmakingState | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [quality, setQuality] = useState<QualitySetting>('auto');
  const [log, setLog] = useState<string[]>([]);
  const session = mm?.kind === 'found' ? mm.session : null;

  // A hidden page pauses the local match (C14).
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  function findMatch() {
    setLog([]);
    const next = service.findMatch(PROFILE);
    setMatchmaking(next);
    next.onState((s) => {
      setMm(s);
      if (s.kind === 'found') watch(s.session);
    });
  }

  function watch(match: MatchSession) {
    const names = new Map(match.seats.map((seat) => [seat.playerId, seat.nickname]));
    const append = (lines: string[]) => setLog((prev) => [...prev, ...lines]);
    // The director plays each update as beats, then reports playback done (spec #2 §5.2).
    const played = new Director(match.me, (windowId) => match.playbackDone(windowId));
    setDirector(played);
    match.onUpdate((u) => {
      append(u.events.map((e) => formatEvent(e, names)));
      played.push(u);
    });
    match.onRejected((e) => append([`REJECTED ${e.code}: ${e.message}`]));
    match.onFailed((e) => append([`FAILED ${e.message}`]));
  }

  function leave() {
    director?.dispose();
    session?.leave();
    setDirector(null);
    setMatchmaking(null);
    setMm(null);
  }

  return (
    <main className="dev">
      <h1>LADDORIOUS · dev match</h1>
      {(mm === null || mm.kind === 'cancelled') && (
        <button type="button" className="primary" onClick={findMatch}>
          Find match
        </button>
      )}
      {(mm?.kind === 'searching' || mm?.kind === 'filling') && (
        <section className="plate">
          <p>{mm.kind === 'searching' ? `Finding players… ${Math.floor(mm.elapsedMs / 1000)} s` : 'Bots are taking the open seats…'}</p>
          <Seats seats={mm.seats} />
          {mm.kind === 'searching' && (
            <div className="row">
              <button type="button" onClick={() => matchmaking?.cancel()}>
                Cancel
              </button>
              {mm.elapsedMs >= PLAY_WITH_BOTS_AFTER_MS && (
                <button type="button" className="accent" onClick={() => matchmaking?.playWithBots()}>
                  Play with bots
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {session && director && (
        <section className="plate">
          <Seats seats={session.seats} />
          <MatchStatus director={director} seats={session.seats} />
          <div className="row">
            <RollButton director={director} session={session} />
            <label className="quality">
              Quality
              <select value={quality} onChange={(e) => setQuality(e.target.value as QualitySetting)}>
                <option value="auto">Auto</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>
            <button type="button" onClick={leave}>
              Leave
            </button>
          </div>
          {import.meta.env.DEV && <DevStats />}
        </section>
      )}
      {session && director && <MatchScene key={quality} director={director} seats={session.seats} me={session.me} setting={quality} showStats={import.meta.env.DEV} />}
      {log.length > 0 && <pre className="log">{log.slice(-LOG_TAIL).join('\n')}</pre>}
    </main>
  );
}

/** A minimal ROLL button: shown in my dice window, pressed once per window. */
function RollButton({ director, session }: { director: Director; session: MatchSession }) {
  const settled = useStore(director.store, (s) => s.settled);
  const [rolledIn, setRolledIn] = useState(-1);
  const aw = settled?.view.awaiting;
  if (!aw || aw.window !== 'dice' || !aw.players.includes(session.me) || rolledIn === aw.windowId) return null;
  return (
    <button
      type="button"
      className="primary roll"
      onClick={() => {
        session.send({ type: 'roll' });
        setRolledIn(aw.windowId);
      }}
    >
      ROLL
    </button>
  );
}

/** Frame rate, draw calls and triangles (dev builds only, spec #2 §6.4). */
function DevStats() {
  const { fps, calls, triangles } = useStore(renderStats);
  return <p className="dev-stats">{`${fps} fps · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k triangles`}</p>;
}

/** The settled match (round, window, who is awaited, the countdown), the beat on stage, and the rankings at the end. */
function MatchStatus({ director, seats }: { director: Director; seats: SeatInfo[] }) {
  const settled = useStore(director.store, (s) => s.settled);
  const beat = useStore(director.store, (s) => s.beat);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const phase = settled?.view.phase;
  return (
    <>
      {settled && <p className="status">{statusLine(settled, seats, now)}</p>}
      {beat && <p className="beat">{`▶ ${beat.kind} · ${(beat.durationMs / 1000).toFixed(1)} s`}</p>}
      {phase?.kind === 'finished' && (
        <ol className="rankings">
          {phase.rankings.map((r) => (
            <li key={r.player}>{`${r.rank}. ${nickname(seats, r.player)} — tile ${r.position}`}</li>
          ))}
        </ol>
      )}
    </>
  );
}

function Seats({ seats }: { seats: Array<SeatInfo | null> }) {
  return (
    <ul className="seats">
      {seats.map((seat, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a seat's position is its identity
        <li key={i} className={seat ? undefined : 'open'} style={seat ? { borderColor: seat.color } : undefined}>
          {seat ? `${seat.nickname} · ${seat.piece}${seat.bot ? ' · bot' : ''}` : 'open seat'}
        </li>
      ))}
    </ul>
  );
}

function statusLine(u: MatchUpdate, seats: SeatInfo[], now: number): string {
  const { round, awaiting: aw } = u.view;
  if (aw.window === 'none') return `Round ${round} · match over`;
  const who = aw.players.map((id) => nickname(seats, id)).join(', ');
  // Capped at the window's length: the 250 ms tick can lag behind a countdown that just started.
  const left = u.timer ? Math.min(Math.ceil((u.timer.endsAt - now) / 1000), Math.ceil(aw.durationMs / 1000)) : null;
  const time = left === null ? 'waiting for playback' : `${Math.max(0, left)} s`;
  return `Round ${round} · ${aw.window} window · waiting for ${who} · ${time}`;
}

function nickname(seats: SeatInfo[], id: PlayerId): string {
  return seats.find((s) => s.playerId === id)?.nickname ?? id;
}
```

Delete the flat board: `git rm apps/client/src/app/DevBoard.tsx`.

In `apps/client/src/app/dev.css`, delete the six `.board` rules (`.board`, `.board .tile-number`, `.board .tile-mystery`, `.board .snake`, `.board .ladder` and `.board .piece`) and append:

```css
.scene-frame {
  height: min(72vh, 620px);
  margin: 12px 0;
  border-radius: 14px;
  overflow: hidden;
  background: var(--plate);
}

.webgl-message {
  margin: 12px 0;
  padding: 24px 16px;
  border-radius: 14px;
  background: var(--plate);
  font-weight: 700;
}

.roll {
  min-width: 140px;
  font-size: 1.2em;
}

.quality {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quality select {
  min-height: 44px;
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
}

.dev-stats {
  color: var(--muted-on-plate);
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Watch a match in 3D**

`README.md`, in the package table, replace the `apps/client` row with:

```markdown
| `apps/client` | `@laddorious/client` | The web client (Vite, React, React Three Fiber). For now a dev page that plays a bot match in 3D, through the local match service and the Web Worker host. |
```

Start the `client` preview entry and open http://localhost:5173. Find match, wait 15 s, then Play with bots. Expected:

- the 3D board appears on its island in the teal-to-apricot sky, with stripes of classic colours, purple "?" squares, a gold tile 100 with its spinning crown, dark slides with chevrons, vortices and exit rings, and mint pads with dotted arcs;
- the four pieces wait on the start line; dice tumble above the rolling pieces; pieces hop tile by tile, ride slides as an orb, somersault up pads and stand side by side for face-offs;
- the camera shows the whole board during the dice phase and follows my piece while moves resolve;
- ROLL appears in my dice window and rolls my die; it hides after one press;
- the stats line shows the frame rate and at most 100 draw calls; switching Quality to Low drops the shadows (blob shadows show instead) and High brings them back;
- the console shows no errors and no "presentation drifted" warning.

Let the match run to the rankings.

- [ ] **Step 6: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  41 passed (41)` and `Tests  292 passed (292)`.

Run: `pnpm build 2>&1 | grep -E "built|error"`
Expected: `✓ built` (a chunk-size warning for three.js is expected).

- [ ] **Step 7: Commit**

```bash
git add apps/client README.md
git commit -m "feat(client): play the dev match in 3D with a ROLL button

The dev page now shows the 3D scene instead of the flat board, with a
minimal ROLL button (once per dice window), a quality picker and, in
dev builds, the fps, draw-call and triangle overlay.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Phase gate and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Local only: the project memory `handoff.md` and `MEMORY.md`

- [ ] **Step 1: Run the whole gate from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E "Test Files|Tests "
pnpm build 2>&1 | grep -E "built|error"
git status --short
```

Expected: no errors; `Test Files  41 passed (41)` and `Tests  292 passed (292)`; `✓ built`; only `.claude/` untracked.

- [ ] **Step 2: Update the handoff note**

In `docs/superpowers/HANDOFF.md`:

1. Replace the title line with `# Handoff — 3D client, after Phase 4`.
2. In the `**Written:**` line, replace "at the end of Phases 2 and 3." with "at the end of Phases 2, 3 and 4."
3. Replace the `**Keep it current:**` line with: `**Keep it current:** when Phase 5 starts, update the "Where things stand" and "Next step" sections or delete this file.`
4. Replace the Phase 4 row of the "Where things stand" table with the line below, where `HASHES` stands for this phase's commits from `git log --oneline main..client/phase-4`, oldest first, each in backticks and comma-separated:

   ```markdown
   | **Phase 4** (the 3D scene): **done on `client/phase-4`**, merged locally at the end of the phase | `docs/superpowers/plans/2026-10-04-client-phase-4-3d-scene.md`; commits HASHES |
   ```

5. Replace the paragraph that starts "After Phase 3 the full suite" with:

   ```markdown
   After Phase 4 the full suite is 41 test files, 292 tests, all passing. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean (Vite warns about the three.js chunk size). There is no git remote.
   ```

6. Replace everything from the `## Next step: Phase 4` heading down to (not including) `## How this user works (follow these)` with:

   ```markdown
   ## Next step: Phase 5

   **Phase 5: HUD and screens.** Spec sections: §7 (screens, HUD, input, palette and type), §8 (error handling).

   **It ends with:** the whole game per the spec, in Tangerine Dusk, on desktop and landscape phones: menu, matchmaking, match HUD and popups, end screen, settings, rotate screen, error screen and leave dialog.

   How to run it: per the user's standing order (memory `continue-through-phase-6`), branch `client/phase-5` from `main`, write the plan with `superpowers:writing-plans`, execute it inline (TDD, commit per task), self-review, merge locally, then go on to Phase 6.

   What Phase 4 left for Phase 5:

   - `src/scene/MatchScene.tsx` is the 3D board. It takes `watch` (watch mode) and `reducedMotion` (settings) props that the HUD should feed, and a `setting` that needs a remount (`key`) to change.
   - The dev page (`src/app/DevMatchPage.tsx`) is the harness to replace: its ROLL button, status line and log are stand-ins for the HUD.
   - The menu podium and its colours (§7.4 Podium tokens) still need adding to `src/app/theme.ts` (`WORLD_COLORS`).
   - The dev overlay reads `src/scene/stats.ts`; e2e (Phase 6) can read the same store for the draw-call check.
   - Fonts (Lilita One, Fredoka) are not loaded yet; the board overlay paints numbers in the system font and may want a repaint once fonts load.
   - Asset slots (`src/assets/slots.tsx`, `SLOT_URLS`) are empty: Spec #4's `.glb` models, possibly made with the Blender MCP, go there.
   ```

7. In "Repository facts", add this bullet after the `**Director:**` bullet:

   ```markdown
   - **Scene:** `src/scene/` holds the 3D scene. Rules are pure and unit-tested (`layout.ts`, `quality.ts`, `motion.ts`, `camera.ts`); the components read the director's store once per frame. `test/scene.test.tsx` renders the scene graph with `@react-three/test-renderer` and fails above 100 draw calls or 150k triangles, so run it after adding anything to the scene.
   ```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: hand off after phase 4

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Update the project memory**

In `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\memory\handoff.md`, replace the paragraph that starts "State after Phase 3" with the text below. In `MEMORY.md`, change "(3D client Phase 4)" to "(3D client Phase 5)".

```markdown
State after Phase 4 (2026-10-04): Phases 1-4 are done and merged to `main` locally. The next step is Phase 5 (HUD and screens). Per the user's standing order (memory continue-through-phase-6): plan it, execute inline, merge locally, continue.
```

After Task 9: self-review the whole branch against §5.3, §6, §8 and this plan's Review Focus (say that it was a self-review), merge `client/phase-4` into `main` locally (fast-forward), confirm the suite on `main`, delete the branch, and start Phase 5.
