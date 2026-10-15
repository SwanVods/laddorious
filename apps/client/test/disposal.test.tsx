import ReactThreeTestRenderer from '@react-three/test-renderer';
import { BufferGeometry, InstancedMesh, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeCopies, type SlotMesh } from '../src/assets/slotMesh';
import { Director } from '../src/director/director';
import { SceneContent, webglAvailable } from '../src/scene/MatchScene';
import { SEATS, openingUpdate } from './support/fixtures';

// Nothing the game makes for a scene outlives it (2026-10-15: the deferred Phase 4 and Step 2 minors).

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('freeing what a scene made', () => {
  it('lets go of the WebGL context it opened only to check WebGL works', () => {
    const loseContext = vi.fn();
    const canvas = { getContext: () => ({ getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null) }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    expect(webglAvailable()).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("frees the scene's own geometries when the match closes", async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    const renderer = await ReactThreeTestRenderer.create(<SceneContent director={director} seats={SEATS} me="p0" board={board} level="high" watch={null} reducedMotion={false} />);
    const root = renderer.scene.instance as Object3D;
    const owned: BufferGeometry[] = [(root.getObjectByName('trail-arrows') as InstancedMesh).geometry, (root.getObjectByName('trail-arrow-outlines') as InstancedMesh).geometry];
    // The pieces' and dice's code-built shapes (unit tests keep the stand-ins).
    root.traverse((node) => {
      if (node instanceof Mesh && node.name === '' && node.parent?.name.startsWith('piece-')) owned.push(node.geometry as BufferGeometry);
    });
    const spies = owned.map((g) => vi.spyOn(g, 'dispose'));
    await renderer.unmount();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it("frees a model's material copies, made for a quality setting, once they're replaced, and never the model's own", () => {
    const own = new MeshStandardMaterial({ name: 'Tint' });
    const copy = new MeshStandardMaterial({ name: 'Tint' });
    const model: SlotMesh = { geometry: new BufferGeometry(), material: [own] };
    const prepared: SlotMesh = { geometry: model.geometry, material: [copy] };
    const ownFree = vi.spyOn(own, 'dispose');
    const copyFree = vi.spyOn(copy, 'dispose');
    disposeCopies(prepared, model);
    expect(copyFree).toHaveBeenCalledTimes(1);
    expect(ownFree).not.toHaveBeenCalled();
  });
});
