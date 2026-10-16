// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetModelCache } from '../src/assets/modelCache';
import { useSlotMesh, type SlotMesh } from '../src/assets/slotMesh';

// A slot whose model file can't load: the game's case when a .glb is missing or broken.
vi.mock('../src/assets/slots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/assets/slots')>()),
  slotUrl: () => '/models/missing.glb',
}));

afterEach(() => {
  vi.restoreAllMocks();
  resetModelCache();
});

describe('an instanced slot whose model fails (spec #5 §1, never broken)', () => {
  it('keeps the stand-in and warns once, however many times the slot is used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The file can't be fetched, every retry too (2026-10-16: retries without the waits).
    resetModelCache(() => Promise.reject(new Error('404')), () => Promise.resolve());
    const stand: SlotMesh = { geometry: new BoxGeometry(), material: new MeshStandardMaterial() };
    const first = renderHook(() => useSlotMesh('pad', () => stand, { clearcoat: true }));
    const second = renderHook(() => useSlotMesh('pad', () => stand, { clearcoat: true }));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(first.result.current).toBe(stand);
    expect(second.result.current).toBe(stand);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('asset slot pad failed to load');
  });
});
