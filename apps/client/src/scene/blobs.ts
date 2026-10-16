import { MeshBasicMaterial, PlaneGeometry } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { blobTexture } from './textures';

// Soft contact shadows (the user, 2026-10-16): a blurred dark oval under each thing that stands on the board
// without a shadow of its own, so it sits instead of floating. Each set is one instanced mesh: a draw call, two
// triangles a copy, on every quality level.

/** One unit square lying flat; an instance's scale is its shadow's width. */
export const BLOB_GEOMETRY = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Just above the surface it lies on, so it never flickers into it. */
export const BLOB_LIFT = 0.02;

let material: MeshBasicMaterial | undefined;

/** The shared shadow material: the soft texture, or a faint flat disc's worth of ink where there's no canvas. */
export function blobMaterial(): MeshBasicMaterial {
  if (material) return material;
  const map = blobTexture(WORLD_COLORS.ink);
  material = new MeshBasicMaterial({
    map,
    color: map ? 0xffffff : WORLD_COLORS.ink,
    opacity: map ? 1 : 0.25,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  return material;
}

/** A shadow's width for something `radius` across, `lift` above its ground: the higher it floats, the smaller. */
export function blobWidth(radius: number, lift: number): number {
  return 2 * radius * Math.min(1, Math.max(0.5, 1 - 0.35 * lift));
}
