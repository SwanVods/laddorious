import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Director } from '../src/director/director';
import { Board } from '../src/scene/Board';
import { boardOverlayTexture } from '../src/scene/textures';
import { openingUpdate } from './support/fixtures';

// Count the overlay textures the board makes, and whether each is freed.
const { made } = vi.hoisted(() => ({ made: [] as Texture[] }));
vi.mock('../src/scene/textures', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/scene/textures')>();
  const { Texture: RealTexture } = await import('three');
  return {
    ...real,
    boardOverlayTexture: vi.fn(() => {
      const texture = new RealTexture();
      vi.spyOn(texture, 'dispose');
      made.push(texture);
      return texture;
    }),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('the board overlay (spec #2 §6.1, §6.4 budget)', () => {
  it('paints the numbers and "?" glyphs once, not on every update, and frees the texture it replaces', async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    const renderer = await ReactThreeTestRenderer.create(<Board board={board} director={director} />);

    // Every update from the worker is a fresh copy of the same board.
    await renderer.update(<Board board={structuredClone(board)} director={director} />);
    await renderer.update(<Board board={structuredClone(board)} director={director} />);
    expect(boardOverlayTexture).toHaveBeenCalledTimes(1);

    // Unmounting frees the GPU texture (three.js only frees it on dispose()).
    await renderer.unmount();
    expect(made).toHaveLength(1);
    expect(made[0]!.dispose).toHaveBeenCalled();
  });
});
