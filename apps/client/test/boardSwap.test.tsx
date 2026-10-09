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
