import { useStore } from 'zustand';
import { renderStats } from '../scene/stats';

/** Frame rate, draw calls and triangles, for dev builds only (spec #2 §6.4). */
export function DevStats() {
  const { fps, calls, triangles } = useStore(renderStats);
  return <p className="dev-stats">{`${fps} fps · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k triangles`}</p>;
}
