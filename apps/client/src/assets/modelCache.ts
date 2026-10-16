import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { createStore } from 'zustand/vanilla';

// Every .glb the game loads goes through here (2026-10-16): one download per file, retried when it fails, and
// counted, so the loading screen can show progress. On a phone on slow mobile data the first visit used to
// leave stand-ins for good: a failed download was never tried again.

/** How a model file is loaded; tests swap it. three's GLTFLoader comes in only when a model loads. */
export type GltfLoad = (url: string) => Promise<GLTF>;
const loadWithThree: GltfLoad = (url) => import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The waits before each retry: four tries in all. */
export const RETRY_DELAYS_MS = [600, 1500, 3000] as const;

export interface ModelLoading {
  /** Every file asked for, in order. */
  requested: string[];
  /** Files that have loaded or given up. */
  done: number;
  /** Files that gave up after their retries. */
  failed: string[];
  /** The first load is over: everything loaded, or the player chose to play anyway. The loading screen stays away after. */
  over: boolean;
}

const EMPTY: ModelLoading = { requested: [], done: 0, failed: [], over: false };
export const modelLoading = createStore<ModelLoading>()(() => EMPTY);

let load: GltfLoad = loadWithThree;
let wait: (ms: number) => Promise<void> = sleep;
const cache = new Map<string, Promise<GLTF>>();

async function withRetries(url: string): Promise<GLTF> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load(url);
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
      await wait(RETRY_DELAYS_MS[attempt]!);
    }
  }
}

/** A model file, loaded once and shared; a failed download is tried again before it gives up. */
export function loadGltf(url: string): Promise<GLTF> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = withRetries(url);
  cache.set(url, promise);
  modelLoading.setState((s) => ({ requested: [...s.requested, url] }));
  const settle = (failed: boolean) =>
    modelLoading.setState((s) => {
      const done = s.done + 1;
      const failures = failed ? [...s.failed, url] : s.failed;
      return { done, failed: failures, over: s.over || (done >= s.requested.length && failures.length === 0) };
    });
  promise.then(
    () => settle(false),
    () => settle(true),
  );
  return promise;
}

/** Forget every file and the progress (tests), optionally with another loader. */
export function resetModelCache(loader: GltfLoad = loadWithThree, pause: (ms: number) => Promise<void> = sleep): void {
  cache.clear();
  load = loader;
  wait = pause;
  modelLoading.setState(EMPTY, true);
}
