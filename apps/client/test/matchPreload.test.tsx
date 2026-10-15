import ReactThreeTestRenderer from '@react-three/test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Director } from '../src/director/director';
import { SceneContent } from '../src/scene/MatchScene';
import { SEATS, openingUpdate } from './support/fixtures';

// A match entered without the menu (a resumed online seat) loads the models itself (2026-10-15).
const { loaded } = vi.hoisted(() => ({ loaded: { models: [] as boolean[], meshes: [] as boolean[] } }));
vi.mock('../src/assets/slots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/assets/slots')>()),
  preloadModels: (low: boolean) => loaded.models.push(low),
}));
vi.mock('../src/assets/slotMesh', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/assets/slotMesh')>()),
  preloadSlotMeshes: (modelEnds: boolean) => loaded.meshes.push(modelEnds),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('a match loads its models itself', () => {
  it('starts loading every model for its quality as it opens, as the menu does', async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    await ReactThreeTestRenderer.create(<SceneContent director={director} seats={SEATS} me="p0" board={board} level="low" watch={null} reducedMotion={false} />);
    expect(loaded.models).toEqual([true]); // Low: the lighter pieces
    expect(loaded.meshes).toEqual([false]); // Low: no 3D portal ends
  });
});
