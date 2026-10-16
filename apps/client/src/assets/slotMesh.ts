import { useEffect, useMemo, useState } from 'react';
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadGltf } from './modelCache';
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
    // A shadow stand-in only fills the shadow map of a model drawn on its own; instanced, it would show (2026-10-15).
    if ((node.material as Material).name === 'Shadow') return;
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

/** Free the material copies `prepared` made of `model`'s (a quality change replaced them); the model's own stay, shared. */
export function disposeCopies(prepared: SlotMesh, model: SlotMesh): void {
  const own = new Set(Array.isArray(model.material) ? model.material : [model.material]);
  for (const material of Array.isArray(prepared.material) ? prepared.material : [prepared.material]) if (!own.has(material)) material.dispose();
}

const ready = new Map<string, SlotMesh>();
const loading = new Map<string, Promise<SlotMesh>>();
const warned = new Set<SlotName>();

/** Load a model as one mesh, once per file, through the shared model cache (2026-10-16). */
export function loadSlotMesh(url: string): Promise<SlotMesh> {
  let load = loading.get(url);
  if (!load) {
    load = loadGltf(url).then((gltf) => {
      const mesh = slotMeshFromScene(gltf.scene);
      ready.set(url, mesh);
      return mesh;
    });
    loading.set(url, load);
  }
  return load;
}

/**
 * The portal ends, drawn as 3D models on High only (Step 2, round 5). The ladder ends (the rocket and the
 * flag) are drawn on Low too, as the props on the platform's wings (board theme spec B4).
 */
const END_SLOTS: ReadonlySet<SlotName> = new Set<SlotName>(['slide.vortex', 'slide.exit']);

/** Every instanced model the game will draw at this quality: the portal ends only on High. */
export function slotsToPreload(modelEnds: boolean): SlotName[] {
  // The crown is also drawn instanced, as the prop on the platform's right wing (2026-10-15).
  return [...[...MESH_SLOTS].filter((name) => modelEnds || !END_SLOTS.has(name)), 'crown'];
}

/** Start loading every instanced model the game will draw (the menu calls this with preloadModels). */
export function preloadSlotMeshes(modelEnds = true): void {
  for (const name of slotsToPreload(modelEnds)) {
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
  const prepared = useMemo(() => (model ? prepareSlotMesh(model, { clearcoat }) : stand), [model, stand, clearcoat]);
  // The copies a quality setting made go when it changes (2026-10-15).
  useEffect(() => () => {
    if (model) disposeCopies(prepared, model);
  }, [prepared, model]);
  return prepared;
}
