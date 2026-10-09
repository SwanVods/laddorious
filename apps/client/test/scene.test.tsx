import type { Jump } from '@laddorious/core';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Color, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { Director } from '../src/director/director';
import { TILE_THICKNESS, tileToWorld } from '../src/scene/layout';
import { SceneContent } from '../src/scene/MatchScene';
import { SYMBOLS, pairStyles } from '../src/scene/pairs';
import { REVEAL_MS, createPeeks, type Peeks } from '../src/scene/paths';
import type { QualityLevel } from '../src/scene/quality';
import { ribbonGeometry } from '../src/scene/tracks';
import { createTagRegistry } from '../src/scene/tags';
import { SEATS, openingUpdate } from './support/fixtures';

// The test renderer drives React through act(); React wants to know it is running in a test.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
async function renderScene(level: QualityLevel, jumps?: Jump[], peeks?: Peeks) {
  return (await renderSceneWith(level, jumps, peeks)).root;
}

async function renderSceneWith(level: QualityLevel, jumps?: Jump[], peeks?: Peeks) {
  const director = new Director('p0', () => {});
  const opening = openingUpdate();
  director.push(jumps ? { ...opening, view: { ...opening.view, board: { ...opening.view.board, jumps } } } : opening);
  const board = director.store.getState().settled!.view.board;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneContent director={director} seats={SEATS} me="p0" board={board} level={level} watch={null} reducedMotion={false} peeks={peeks} />,
  );
  await frames(renderer, 2);
  return { renderer, root: renderer.scene.instance as Object3D, board };
}

/** Run frames inside act(), so state a frame sets (the shown paths) renders, then one more for what it drew. */
async function frames(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>, count: number) {
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(count, 1 / 60);
  });
  await renderer.advanceFrames(1, 1 / 60);
}

/** Every path mesh in the scene: pad trails and slide channels. */
const pathMeshes = (root: Object3D) => {
  const found: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && /^(trail|channel-floor|channel-walls)-/.test(node.name)) found.push(node);
  });
  return found;
};

describe('the 3D scene (spec #2 §6)', () => {
  it('lays slide ribbons face up, so the light falls on them', () => {
    const ribbon = ribbonGeometry([new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(2, 0, 1), new Vector3(2, 0, 3)], 0.6, 0.02);
    const pos = ribbon.getAttribute('position');
    const index = ribbon.index!;
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
    }
  });

  it('moves each name tag over its piece on screen (spec #2 §7.2)', async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    const tags = createTagRegistry();
    const fakes = SEATS.map((seat) => {
      const el = { style: {} as Record<string, string> };
      tags.elements.set(seat.playerId, el as unknown as HTMLElement);
      return el;
    });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneContent director={director} seats={SEATS} me="p0" board={board} level="low" watch={null} reducedMotion tags={tags} />,
      { camera: { position: [0, 20, 21] } },
    );
    await renderer.advanceFrames(2, 1 / 60);
    for (const el of fakes) {
      expect(el.style.visibility).toBe('visible');
      expect(el.style.transform).toMatch(/^translate\(-?\d+(\.\d+)?px, -?\d+(\.\d+)?px\)$/);
    }
    // The four start spots stand side by side, and so do their tags.
    expect(new Set(fakes.map((el) => el.style.transform)).size).toBe(4);
  });

  it('hides every path while no piece stands on a start tile (spec #5 A13)', async () => {
    expect(pathMeshes(await renderScene('high'))).toEqual([]);
  });

  it("shows a tapped jump's path, growing it in along its length (spec #5 A13)", async () => {
    const { jumps } = openingUpdate().view.board;
    const ladder = jumps.find((j) => j.to > j.from)!;
    const slide = jumps.find((j) => j.to < j.from)!;
    const peeks = createPeeks();
    peeks.tap(ladder.from, jumps, Date.now());
    peeks.tap(slide.to, jumps, Date.now());
    const root = await renderScene('high', undefined, peeks);
    const trail = root.getObjectByName(`trail-${ladder.id}`) as Mesh;
    for (const name of [`channel-floor-${slide.id}`, `channel-walls-${slide.id}`]) expect(root.getObjectByName(name)).toBeInstanceOf(Mesh);
    // Two frames in, the trail has only begun: part of its length shows.
    const whole = (trail.geometry as BufferGeometry).index!.count;
    expect(trail.geometry.drawRange.count).toBeGreaterThan(0);
    expect(trail.geometry.drawRange.count).toBeLessThan(whole);
    expect(REVEAL_MS).toBeGreaterThan(0);
  });

  it("peeks at a jump's path when a player taps a tile at either end", async () => {
    const { jumps } = openingUpdate().view.board;
    const ladder = jumps.find((j) => j.to > j.from)!;
    const { renderer, root } = await renderSceneWith('high');
    const tiles = renderer.scene.find((node) => node.props.name === 'tiles');
    await renderer.fireEvent(tiles, 'onClick', { instanceId: ladder.to - 1, stopPropagation: () => {} });
    await frames(renderer, 2);
    expect(root.getObjectByName(`trail-${ladder.id}`)).toBeInstanceOf(Mesh);
  });

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

  it("marks both ends of every jump with its pair's symbol, and each whirlpool's eye with a still cap (spec #5 A13)", async () => {
    const root = await renderScene('high');
    const { jumps } = openingUpdate().view.board;
    let marks = 0;
    for (const name of SYMBOLS) marks += (root.getObjectByName(`symbols-${name}`) as InstancedMesh | undefined)?.count ?? 0;
    expect(marks).toBe(2 * jumps.length);
    expect((root.getObjectByName('caps') as InstancedMesh).count).toBe(jumps.filter((j) => j.to < j.from).length);
  });

  it('paints each pad, landing ring, whirlpool and collar in its pair colour (spec #5 A13)', async () => {
    const root = await renderScene('high');
    const { jumps } = openingUpdate().view.board;
    const styles = pairStyles(jumps);
    const ladder = jumps.filter((j) => j.to > j.from)[0]!;
    const slide = jumps.filter((j) => j.to < j.from)[0]!;
    const colour = new Color();
    for (const [name, jump] of [['pads', ladder], ['targets', ladder], ['vortices', slide], ['exits', slide]] as const) {
      (root.getObjectByName(name) as InstancedMesh).getColorAt(0, colour);
      expect(colour.getHex(), name).toBe(new Color(styles.get(jump.id)!.colour).getHex());
    }
  });

  it('draws the 100 tiles in one instanced draw call', async () => {
    const tiles = (await renderScene('high')).getObjectByName('tiles');
    expect(tiles).toBeInstanceOf(InstancedMesh);
    expect((tiles as InstancedMesh).count).toBe(100);
  });

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
