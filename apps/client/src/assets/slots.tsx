import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { loadGltf } from './modelCache';
import { MESH_SLOTS, SLOT_FILES, modelUrl, slotFile, type SlotName } from './slotFiles';

export type { SlotName } from './slotFiles';

/**
 * Blender models load in the game. Unit tests (Vitest's "test" mode) keep the code-built models:
 * jsdom can't load .glb files, and the art tests check the files themselves (spec #5 §7).
 */
const MODELS_ON = import.meta.env.MODE !== 'test';

/** A slot's model URL (its lighter model on Low quality, spec #5 A14), or null where the slot keeps its code-built model. */
export function slotUrl(name: SlotName, low = false): string | null {
  const file = slotFile(name, low);
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
  /** Load the slot's lighter model where it has one (Low quality, spec #5 A14). */
  low?: boolean;
}

const WHITE = new Color(1, 1, 1);

/**
 * Ready one material for the game (spec #5 §3.2, §6): Seat takes the seat colour, Tint turns white so
 * instance colours show, Low quality drops the clearcoat, and `emissive` readies it to flash. A changed
 * material is a copy, so shared ones stay as they were.
 */
export function prepareMaterial(material: Material, { seat, clearcoat = true, emissive }: ModelOptions): Material {
  if (!(material instanceof MeshStandardMaterial)) return material;
  const tint = seat !== undefined && material.name === 'Seat';
  const white = material.name === 'Tint' && !material.color.equals(WHITE);
  const uncoat = !clearcoat && material instanceof MeshPhysicalMaterial && material.clearcoat > 0;
  if (!tint && !white && !uncoat && emissive === undefined) return material;
  const copy = material.clone();
  if (tint) copy.color.set(seat);
  if (white) copy.color.copy(WHITE);
  if (uncoat) (copy as MeshPhysicalMaterial).clearcoat = 0;
  if (emissive !== undefined) {
    copy.emissive.set(emissive);
    copy.emissiveIntensity = 0;
  }
  return copy;
}

/** Draws nothing on screen: a Shadow mesh only fills the shadow map (and is hidden outside the shadow pass, shadowOnly.ts). */
const UNSEEN = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

const isShadow = (node: Mesh) => !Array.isArray(node.material) && (node.material as Material).name === 'Shadow';

/**
 * Ready a loaded model's materials and shadows. A model may carry a small Shadow mesh (spec #5 §6):
 * then it casts the shadow in place of the detailed parts, at a tenth of the triangles.
 */
export function prepareModel(root: Object3D, options: ModelOptions): void {
  const shadows = options.shadows ?? false;
  let stand = false;
  root.traverse((node) => {
    if (node instanceof Mesh && isShadow(node)) stand = true;
  });
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (isShadow(node)) {
      node.material = UNSEEN;
      node.castShadow = shadows;
      // Hidden from the main pass; with shadows on, shown for the shadow pass alone (2026-10-15).
      node.visible = false;
      node.userData.standIn = shadows;
      return;
    }
    node.castShadow = shadows && !stand;
    node.material = Array.isArray(node.material) ? node.material.map((m) => prepareMaterial(m, options)) : prepareMaterial(node.material, options);
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

// The model loader comes in only when a slot has a URL: it stays out of the main bundle and out of tests.
const GltfModel = lazy(() => import('./GltfModel'));

/** An asset slot: its Blender model when it has one, its code-built default otherwise or on failure. */
export function Slot({ name, fallback, low = false, ...options }: { name: SlotName; fallback: ReactNode } & ModelOptions) {
  const url = slotUrl(name, low);
  if (!url) return fallback;
  return (
    <SlotBoundary name={name} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} {...options} />
      </Suspense>
    </SlotBoundary>
  );
}

/** Start loading every whole model the game uses at this quality (the menu calls this), so a match never pops from stand-in to model. */
export function preloadModels(low = false): void {
  const names = (Object.keys(SLOT_FILES) as SlotName[]).filter((name) => !MESH_SLOTS.has(name));
  const urls = names.map((name) => slotUrl(name, low)).filter((url): url is string => url !== null);
  // A failure shows the stand-in and warns when a scene uses the slot; the loading screen counts it.
  for (const url of urls) void loadGltf(url).catch(() => undefined);
}
