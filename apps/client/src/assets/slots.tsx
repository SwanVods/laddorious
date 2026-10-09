import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { SLOT_FILES, modelUrl, type SlotName } from './slotFiles';

export type { SlotName } from './slotFiles';

/**
 * Blender models load in the game. Unit tests (Vitest's "test" mode) keep the code-built models:
 * jsdom can't load .glb files, and the art tests check the files themselves (spec #5 §7).
 */
const MODELS_ON = import.meta.env.MODE !== 'test';

/** A slot's model URL, or null where the slot keeps its code-built model. */
export function slotUrl(name: SlotName): string | null {
  const file = SLOT_FILES[name];
  return MODELS_ON && file ? modelUrl(file) : null;
}

/** How a loaded model is readied for the game (spec #5 §6). */
export interface ModelOptions {
  /** Materials named Seat take this colour (spec #2 §6.3). */
  seat?: string;
  /** False on Low quality: glossy plastic drops its clearcoat (spec #5 §3.1). */
  clearcoat?: boolean;
  /** Every lit material gets this emissive colour at intensity 0, so the game can flash it (the die). */
  emissive?: string;
  /** Meshes cast shadows (High quality). */
  shadows?: boolean;
}

/** Ready a loaded model's materials and shadows. Changed materials are copies, so shared ones stay as they were. */
export function prepareModel(root: Object3D, { seat, clearcoat = true, emissive, shadows = false }: ModelOptions): void {
  const prepare = (material: Material): Material => {
    if (!(material instanceof MeshStandardMaterial)) return material;
    const tint = seat !== undefined && material.name === 'Seat';
    const uncoat = !clearcoat && material instanceof MeshPhysicalMaterial && material.clearcoat > 0;
    if (!tint && !uncoat && emissive === undefined) return material;
    const copy = material.clone();
    if (tint) copy.color.set(seat);
    if (uncoat) (copy as MeshPhysicalMaterial).clearcoat = 0;
    if (emissive !== undefined) {
      copy.emissive.set(emissive);
      copy.emissiveIntensity = 0;
    }
    return copy;
  };
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = shadows;
    node.material = Array.isArray(node.material) ? node.material.map(prepare) : prepare(node.material);
  });
}

/** Light every lit material in a model by this much (the die's forced-face flash). */
export function setEmissive(root: Object3D, intensity: number): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof MeshStandardMaterial) material.emissiveIntensity = intensity;
    }
  });
}

interface BoundaryProps {
  name: SlotName;
  fallback: ReactNode;
  children: ReactNode;
}

/** A model that fails to load shows the slot's built-in default and warns once (spec #2 §6.3, §8). */
export class SlotBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn(`asset slot ${this.props.name} failed to load; using the built-in model`, error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// drei's loader comes in only when a slot has a URL: it stays out of the main bundle and out of tests.
const GltfModel = lazy(() => import('./GltfModel'));

/** An asset slot: its Blender model when it has one, its code-built default otherwise or on failure. */
export function Slot({ name, fallback, ...options }: { name: SlotName; fallback: ReactNode } & ModelOptions) {
  const url = slotUrl(name);
  if (!url) return fallback;
  return (
    <SlotBoundary name={name} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} {...options} />
      </Suspense>
    </SlotBoundary>
  );
}

/** Start loading every model the game uses (the menu calls this), so a match never pops from stand-in to model. */
export function preloadModels(): void {
  const urls = (Object.keys(SLOT_FILES) as SlotName[]).map(slotUrl).filter((url): url is string => url !== null);
  if (urls.length > 0) void import('./GltfModel').then((m) => m.preload(urls));
}
