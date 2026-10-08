import type { Jump } from '@laddorious/core';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedMesh, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { Director } from '../src/director/director';
import { ribbonGeometry } from '../src/scene/Jumps';
import { SceneContent } from '../src/scene/MatchScene';
import type { QualityLevel } from '../src/scene/quality';
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
      const el = { style: {} as Record<string, string>, querySelector: () => null };
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
