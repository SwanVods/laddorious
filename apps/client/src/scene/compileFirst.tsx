import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Camera, Object3D } from 'three';

// A scene's first frame compiled every shader at once: a frozen page for a moment on a phone, and for over a
// minute in CI's software WebGL (2026-10-15). The Canvas now starts with its frame loop off; this compiles
// what's in the scene, off the main thread where the browser can (KHR_parallel_shader_compile), then starts it.
// Models that load later compile when they first show, a few at a time.

/** Compile the scene's shaders, then call `run`; the result cancels a run still waiting. */
export function startWhenCompiled(gl: { compileAsync: (scene: Object3D, camera: Camera) => Promise<unknown> }, scene: Object3D, camera: Camera, run: () => void): () => void {
  let live = true;
  const start = () => {
    if (live) run();
  };
  gl.compileAsync(scene, camera).then(start, start);
  return () => {
    live = false;
  };
}

/** Put in a Canvas whose `frameloop` is "never": it starts the loop once the shaders are compiled. */
export function CompileFirst() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => startWhenCompiled(gl, scene, camera, () => setFrameloop('always')), [gl, scene, camera, setFrameloop]);
  return null;
}
