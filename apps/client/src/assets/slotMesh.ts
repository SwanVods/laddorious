import { useEffect, useMemo, useState } from 'react';
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MESH_SLOTS, type SlotName } from './slotFiles';
import { prepareMaterial, slotUrl } from './slots';

// Parts drawn many times (tiles, pads, vortices…) stay instanced (spec #5 §6): a slot's .glb becomes
// one geometry with a group per material, so every copy draws once per material.

export interface SlotMesh {
  geometry: BufferGeometry;
  /** One material per geometry group. */
  material: Material | Material[];
}

/** A whole model as one geometry, a group per material, with its transforms baked in. */
export function slotMeshFromScene(root: Object3D): SlotMesh {
  root.updateMatrixWorld(true);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (Array.isArray(node.material)) throw new Error('a model mesh has several materials');
    geometries.push((node.geometry as BufferGeometry).clone().applyMatrix4(node.matrixWorld));
    materials.push(node.material as Material);
  });
  if (geometries.length === 0) throw new Error('the model has no mesh');
  const geometry = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, true);
  if (!geometry) throw new Error("the model's meshes don't share their attributes");
  return { geometry, material: materials.length === 1 ? materials[0]! : materials };
}

/** Ready a slot mesh's materials (Tint white, no clearcoat on Low); the geometry is shared. */
export function prepareSlotMesh(mesh: SlotMesh, { clearcoat }: { clearcoat: boolean }): SlotMesh {
  const material = Array.isArray(mesh.material) ? mesh.material.map((m) => prepareMaterial(m, { clearcoat })) : prepareMaterial(mesh.material, { clearcoat });
  return { geometry: mesh.geometry, material };
}

const ready = new Map<string, SlotMesh>();
const loading = new Map<string, Promise<SlotMesh>>();
const warned = new Set<SlotName>();

/** Load a model as one mesh, once per file. three's GLTFLoader comes in only when a model loads. */
export function loadSlotMesh(url: string): Promise<SlotMesh> {
  let load = loading.get(url);
  if (!load) {
    load = import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .then((gltf) => {
        const mesh = slotMeshFromScene(gltf.scene);
        ready.set(url, mesh);
        return mesh;
      });
    loading.set(url, load);
  }
  return load;
}

/** The ladder and portal ends, drawn as 3D models on High only (Step 2, round 5). */
const END_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>(['pad', 'pad.target', 'slide.vortex', 'slide.exit']);

/** Start loading every instanced model the game will draw (the menu calls this with preloadModels): the ends only on High. */
export function preloadSlotMeshes(modelEnds = true): void {
  for (const name of MESH_SLOTS) {
    if (!modelEnds && END_SLOTS.has(name)) continue;
    const url = slotUrl(name);
    // A failure warns when a scene uses the slot.
    if (url) void loadSlotMesh(url).catch(() => undefined);
  }
}

/**
 * A slot's mesh for instancing (spec #5 §6). It's the code-built stand-in until the model loads (at
 * once when the menu preloaded it), in unit tests, and when the model fails, which warns once like Slot.
 * It never suspends: callers rebuild their instanced mesh when the value changes.
 */
export function useSlotMesh(name: SlotName, fallback: () => SlotMesh, { clearcoat }: { clearcoat: boolean }): SlotMesh {
  const url = slotUrl(name);
  const [stand] = useState(fallback);
  const [model, setModel] = useState<SlotMesh | null>(() => (url ? (ready.get(url) ?? null) : null));
  useEffect(() => {
    if (!url || model) return;
    let live = true;
    loadSlotMesh(url).then(
      (mesh) => {
        if (live) setModel(mesh);
      },
      (error: unknown) => {
        if (warned.has(name)) return;
        warned.add(name);
        console.warn(`asset slot ${name} failed to load; using the built-in model`, error);
      },
    );
    return () => {
      live = false;
    };
  }, [name, url, model]);
  // The stand-in is this component's own; the model's geometry is shared and stays.
  useEffect(
    () => () => {
      stand.geometry.dispose();
      for (const material of Array.isArray(stand.material) ? stand.material : [stand.material]) material.dispose();
    },
    [stand],
  );
  return useMemo(() => (model ? prepareSlotMesh(model, { clearcoat }) : stand), [model, stand, clearcoat]);
}
