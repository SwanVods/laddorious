import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETRY_DELAYS_MS, loadGltf, modelLoading, resetModelCache } from '../src/assets/modelCache';

// One cache for every model file (2026-10-16): retries a failed download, and counts progress for the loading screen.

const gltf = (url: string) => ({ scene: { name: url } }) as never;
const noWait = () => Promise.resolve();

afterEach(() => resetModelCache());

describe('the model cache (2026-10-16)', () => {
  it('loads each file once, however often it is asked for', async () => {
    const load = vi.fn((url: string) => Promise.resolve(gltf(url)));
    resetModelCache(load, noWait);
    const [a, b] = await Promise.all([loadGltf('/models/a.glb'), loadGltf('/models/a.glb')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    expect(modelLoading.getState()).toMatchObject({ requested: ['/models/a.glb'], done: 1, failed: [] });
  });

  it('tries a failed download again', async () => {
    let tries = 0;
    resetModelCache(() => (++tries < 3 ? Promise.reject(new Error('network')) : Promise.resolve(gltf('x'))), noWait);
    await expect(loadGltf('/models/x.glb')).resolves.toBeTruthy();
    expect(tries).toBe(3);
    expect(modelLoading.getState().failed).toEqual([]);
  });

  it('gives up after its retries, and counts the file as failed', async () => {
    let tries = 0;
    resetModelCache(() => (++tries, Promise.reject(new Error('network'))), noWait);
    await expect(loadGltf('/models/y.glb')).rejects.toThrow('network');
    expect(tries).toBe(1 + RETRY_DELAYS_MS.length);
    expect(modelLoading.getState()).toMatchObject({ done: 1, failed: ['/models/y.glb'] });
  });

  it('is over once everything asked for has loaded', async () => {
    resetModelCache((url) => Promise.resolve(gltf(url)), noWait);
    expect(modelLoading.getState().over).toBe(false);
    await Promise.all([loadGltf('/models/a.glb'), loadGltf('/models/b.glb')]);
    expect(modelLoading.getState().over).toBe(true);
  });
});
