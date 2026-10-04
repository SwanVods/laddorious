import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { FrameRateWatch } from './quality';
import { renderStats } from './stats';

/** Samples fps, draw calls and triangles for the dev overlay every half second (spec #2 §6.4). */
export function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const sampleRef = useRef({ frames: 0, seconds: 0 });
  useFrame((_, delta) => {
    const w = sampleRef.current;
    w.frames += 1;
    w.seconds += delta;
    if (w.seconds < 0.5) return;
    renderStats.setState({ fps: Math.round(w.frames / w.seconds), calls: gl.info.render.calls, triangles: gl.info.render.triangles });
    w.frames = 0;
    w.seconds = 0;
  });
  return null;
}

/** Auto quality: steps down to Low when the frame rate sags (spec #2 §6.4). */
export function QualityWatch({ onStepDown }: { onStepDown: () => void }) {
  const watch = useMemo(() => new FrameRateWatch(), []);
  useFrame((_, delta) => {
    if (watch.add(delta * 1000)) onStepDown();
  });
  return null;
}

/** A lost WebGL context gets 3 s to come back; then the board gives way to the WebGL message (spec #2 §8). */
export function ContextLossWatch({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lost = (e: Event) => {
      e.preventDefault();
      timer = setTimeout(onLost, 3000);
    };
    const restored = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      if (timer !== null) clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, onLost]);
  return null;
}
