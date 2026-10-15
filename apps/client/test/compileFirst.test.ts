import { describe, expect, it, vi } from 'vitest';
import { startWhenCompiled } from '../src/scene/compileFirst';

// A match's first frame compiled every shader at once: a frozen page for a moment on a phone, and for over a
// minute in CI's software WebGL (2026-10-15). The scene now compiles first, off the main thread where the
// browser can, and only then starts drawing.

describe('startWhenCompiled', () => {
  const scene = {} as never;
  const camera = {} as never;

  it('starts the frame loop once the shaders are compiled, not before', async () => {
    let done!: () => void;
    const gl = { compileAsync: vi.fn(() => new Promise<void>((resolve) => (done = resolve))) };
    const run = vi.fn();
    startWhenCompiled(gl, scene, camera, run);
    expect(gl.compileAsync).toHaveBeenCalledWith(scene, camera);
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    done();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('starts anyway when compiling fails, and not at all once the scene has gone', async () => {
    const failing = { compileAsync: () => Promise.reject(new Error('lost context')) };
    const run = vi.fn();
    startWhenCompiled(failing, scene, camera, run);
    await new Promise((r) => setTimeout(r, 0));
    expect(run).toHaveBeenCalledTimes(1);
    const later = vi.fn();
    const stop = startWhenCompiled({ compileAsync: () => Promise.resolve() }, scene, camera, later);
    stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(later).not.toHaveBeenCalled();
  });
});
