import { createStore } from 'zustand/vanilla';

export interface RenderStats {
  fps: number;
  calls: number;
  triangles: number;
}

/** What the renderer drew last, for the dev overlay (spec #2 §6.4). */
export const renderStats = createStore<RenderStats>()(() => ({ fps: 0, calls: 0, triangles: 0 }));
