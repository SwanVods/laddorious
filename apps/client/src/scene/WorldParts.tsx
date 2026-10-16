import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferGeometry, Color, MeshBasicMaterial, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { WORLD_COLORS } from '../app/theme';
import type { SlotName } from '../assets/slotFiles';
import { useSlotMesh, type SlotMesh } from '../assets/slotMesh';
import { BLOB_GEOMETRY, BLOB_LIFT, blobMaterial, blobWidth } from './blobs';
import { MENU_PLATFORM, PLATFORM } from './layout';
import { worldPose, type Placement } from './world';

// Draws the world's placements (named apart from world.ts: Windows paths ignore case) (board theme spec §6): each model once, as an instanced mesh, every copy
// posed by its idle motion each frame. Nothing here casts a shadow; the platform receives the pieces'.

/** A world model that fails to load is left out (spec §6): an empty mesh, hidden. */
const nothing = (): SlotMesh => ({ geometry: new BufferGeometry(), material: new MeshBasicMaterial({ visible: false }) });

/** The platforms' stand-in: a plain cream deck, its top where the model's deck is. */
const plainDeck = (width: number, depth: number, top: number) => (): SlotMesh => ({
  geometry: new BoxGeometry(width, 0.8, depth).translate(0, top - 0.4, 0),
  material: new MeshStandardMaterial({ color: WORLD_COLORS.deck, roughness: 0.6 }),
});

const STAND_INS: Partial<Record<SlotName, () => SlotMesh>> = {
  platform: plainDeck(PLATFORM.halfWidth * 2, PLATFORM.halfDepth * 2, PLATFORM.deckTop),
  'menu.platform': plainDeck(MENU_PLATFORM.radius * 2, MENU_PLATFORM.radius * 2, MENU_PLATFORM.deckTop),
};

function writePoses(mesh: InstancedMesh, placements: readonly Placement[], t: number, reduced: boolean, at: Object3D): void {
  placements.forEach((p, i) => {
    const { position, rotation, scale } = worldPose(p, t, reduced);
    at.position.set(...position);
    at.rotation.set(...rotation);
    at.scale.set(...scale);
    at.updateMatrix();
    mesh.setMatrixAt(i, at.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function SlotInstances({ slot, placements, clearcoat, reducedMotion }: { slot: SlotName; placements: readonly Placement[]; clearcoat: boolean; reducedMotion: boolean }) {
  const mesh = useSlotMesh(slot, STAND_INS[slot] ?? nothing, { clearcoat });
  const ref = useRef<InstancedMesh>(null);
  const at = useMemo(() => new Object3D(), []);
  const moving = placements.some((p) => p.motion);
  useLayoutEffect(() => {
    const instances = ref.current;
    if (!instances) return;
    writePoses(instances, placements, 0, reducedMotion, at);
    if (!placements.some((p) => p.color)) return;
    const color = new Color();
    placements.forEach((p, i) => instances.setColorAt(i, p.color ? color.set(p.color) : color.setRGB(1, 1, 1)));
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
  }, [mesh, placements, reducedMotion, at]);
  useFrame(({ clock }) => {
    if (moving && ref.current) writePoses(ref.current, placements, clock.elapsedTime, reducedMotion, at);
  });
  const empty = !('position' in mesh.geometry.attributes);
  return <instancedMesh ref={ref} name={`world-${slot}`} args={[mesh.geometry, mesh.material, placements.length]} visible={!empty} receiveShadow frustumCulled={false} />;
}

/**
 * The soft contact shadows of the placements that have one (2026-10-16): one instanced mesh, each shadow on its
 * ground under its model, shrinking as a hovering model rises.
 */
function WorldBlobs({ placements, reducedMotion }: { placements: readonly Placement[]; reducedMotion: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const at = useMemo(() => new Object3D(), []);
  const moving = placements.some((p) => p.motion);
  const write = (t: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((p, i) => {
      const { radius, ground } = p.shadow!;
      const { position } = worldPose(p, t, reducedMotion);
      at.position.set(position[0], ground + BLOB_LIFT, position[2]);
      at.scale.setScalar(blobWidth(radius, position[1] - ground));
      at.updateMatrix();
      mesh.setMatrixAt(i, at.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(() => write(0));
  // Each shadow's strength rides in its instance colour (blobMaterial reads it as opacity).
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const strength = new Color();
    placements.forEach((p, i) => mesh.setColorAt(i, strength.setScalar(p.shadow!.strength ?? 1)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placements]);
  useFrame(({ clock }) => {
    if (moving) write(clock.elapsedTime);
  });
  return <instancedMesh ref={ref} name="world-shadows" args={[BLOB_GEOMETRY, blobMaterial(), placements.length]} frustumCulled={false} renderOrder={1} />;
}

/** Every placement, grouped by model: one instanced mesh each. */
export function WorldParts({ placements, clearcoat, reducedMotion }: { placements: readonly Placement[]; clearcoat: boolean; reducedMotion: boolean }) {
  const groups = useMemo(() => {
    const bySlot = new Map<SlotName, Placement[]>();
    for (const p of placements) bySlot.set(p.slot, [...(bySlot.get(p.slot) ?? []), p]);
    return [...bySlot];
  }, [placements]);
  const shadowed = useMemo(() => placements.filter((p) => p.shadow), [placements]);
  return (
    <>
      {groups.map(([slot, list]) => (
        <SlotInstances key={`${slot}-${list.length}`} slot={slot} placements={list} clearcoat={clearcoat} reducedMotion={reducedMotion} />
      ))}
      {shadowed.length > 0 && <WorldBlobs key={shadowed.length} placements={shadowed} reducedMotion={reducedMotion} />}
    </>
  );
}
