import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedMesh, Mesh, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PIECE_GEOMETRY } from '../src/assets/models';
import { MENU_CAMERA, MenuContent } from '../src/scene/MenuScene';
import type { QualityLevel } from '../src/scene/quality';
import { createTagRegistry } from '../src/scene/tags';
import type { PieceId } from '../src/service/matchService';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

async function renderMenu(piece: PieceId, level: QualityLevel = 'high', reducedMotion = false) {
  const anchors = createTagRegistry();
  const fakes = ['plate', 'prev', 'next'].map((key) => {
    const el = { style: {} as Record<string, string> };
    anchors.elements.set(key, el as unknown as HTMLElement);
    return el;
  });
  const renderer = await ReactThreeTestRenderer.create(<MenuContent piece={piece} level={level} reducedMotion={reducedMotion} anchors={anchors} />, {
    camera: { fov: MENU_CAMERA.fov, position: MENU_CAMERA.position },
  });
  await renderer.advanceFrames(3, 1 / 30);
  return { renderer, root: renderer.scene.instance as Object3D, fakes };
}

describe('the menu scene (spec #2 §7.1)', () => {
  it('stands the podium on its little platform, with clouds (board theme spec §3)', async () => {
    const { root } = await renderMenu('pawn');
    expect((root.getObjectByName('world-podium') as InstancedMesh).count).toBe(1);
    const platform = root.getObjectByName('world-menu.platform') as InstancedMesh;
    expect(platform.count).toBe(1);
    expect(platform.visible).toBe(true); // a plain deck until the model loads
    expect((root.getObjectByName('world-cloud') as InstancedMesh).count).toBe(8);
  });

  it('stands the chosen piece on the podium', async () => {
    const { root, renderer } = await renderMenu('dragon');
    const piece = root.getObjectByName('menu-piece') as Mesh;
    expect(triangles(piece.geometry)).toBe(triangles(PIECE_GEOMETRY.dragon()));
    await renderer.update(<MenuContent piece="pawn" level="high" reducedMotion={false} anchors={createTagRegistry()} />);
    expect(triangles((root.getObjectByName('menu-piece') as Mesh).geometry)).toBe(triangles(PIECE_GEOMETRY.pawn()));
  });

  it('turns the piece on a turntable, and more slowly with reduced motion (2026-10-15)', async () => {
    const turning = await renderMenu('knight');
    const before = turning.root.getObjectByName('menu-turntable')!.rotation.y;
    await turning.renderer.advanceFrames(5, 1 / 30);
    const full = turning.root.getObjectByName('menu-turntable')!.rotation.y - before;
    const calm = await renderMenu('knight', 'high', true);
    const from = calm.root.getObjectByName('menu-turntable')!.rotation.y;
    await calm.renderer.advanceFrames(5, 1 / 30);
    const slow = calm.root.getObjectByName('menu-turntable')!.rotation.y - from;
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(full / 2);
  });

  it('places the name plate on the podium and the arrows beside it', async () => {
    const { fakes } = await renderMenu('knight');
    const xs = fakes.map((el) => Number(/translate\((-?[\d.]+)px/.exec(el.style.transform ?? '')?.[1]));
    expect(xs.every(Number.isFinite)).toBe(true);
    const [plate, prev, next] = xs as [number, number, number];
    expect(prev).toBeLessThan(plate);
    expect(next).toBeGreaterThan(plate);
  });

  it.each(['high', 'low'] as const)('stays inside the phone budget on %s', async (level) => {
    const { root } = await renderMenu('meeple', level);
    let calls = 0;
    let tris = 0;
    root.traverseVisible((node) => {
      if (!(node instanceof Mesh)) return;
      const copies = node instanceof InstancedMesh ? node.count : 1;
      const passes = level === 'high' && node.castShadow ? 2 : 1;
      calls += passes;
      tris += triangles(node.geometry as BufferGeometry) * copies * passes;
    });
    expect(calls).toBeLessThanOrEqual(100);
    expect(tris).toBeLessThanOrEqual(150_000);
  });
});
