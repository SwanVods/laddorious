import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from 'zustand';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import { exitGeometry, padGeometry, targetGeometry, vortexGeometry } from '../assets/models';
import { useSlotMesh, type SlotMesh } from '../assets/slotMesh';
import type { Director } from '../director/director';
import { slideCurve, tileToWorld } from './layout';
import { clamp01, easeOutBack } from './motion';
import { chevronTexture, swirlTexture } from './textures';
import { CHANNEL, channelGeometry, padHeading, trailGeometry, trailPath } from './tracks';

/** A cap that keeps a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;

/** A model's material named Glow, which the game may pulse (spec #5 §3.2). */
function glowOf(mesh: SlotMesh): MeshStandardMaterial | undefined {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.find((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial && m.name === 'Glow');
}

/**
 * Slides and launch pads (spec #2 §6.1, spec #5 §4.2): each slide a raised channel from its vortex to
 * its exit collar, each pad an arched trail to its landing target. Parts a board edit adds or removes
 * pop in or out.
 */
export function Jumps({ director, clearcoat }: { director: Director; clearcoat: boolean }) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const channels = useMemo(() => {
    if (snakes.length === 0) return null;
    const each = snakes.map((j) => channelGeometry(slideCurve(j.from, j.to).getPoints(CHANNEL.samples)));
    return { floor: mergeGeometries(each.map((c) => c.floor)), walls: mergeGeometries(each.map((c) => c.walls)) };
  }, [snakes]);
  const trails = useMemo(() => (ladders.length === 0 ? null : mergeGeometries(ladders.map((j) => trailGeometry(trailPath(j))))), [ladders]);
  const chevrons = useMemo(() => chevronTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const lights = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.cloud), []);
  const padChevrons = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.ink), []);
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vortex = useSlotMesh(
    'slide.vortex',
    () => ({ geometry: vortexGeometry(), material: new MeshBasicMaterial(swirl ? { map: swirl, transparent: true } : { color: BOARD_COLORS.slide }) }),
    { clearcoat },
  );
  const exit = useSlotMesh('slide.exit', () => ({ geometry: exitGeometry(), material: new MeshBasicMaterial({ color: WORLD_COLORS.chevron }) }), { clearcoat });
  const pad = useSlotMesh(
    'pad',
    () => ({ geometry: padGeometry(), material: new MeshStandardMaterial(padChevrons ? { map: padChevrons, roughness: 0.5 } : { color: WORLD_COLORS.pad, roughness: 0.5 }) }),
    { clearcoat },
  );
  const target = useSlotMesh('pad.target', () => ({ geometry: targetGeometry(), material: new MeshBasicMaterial({ color: WORLD_COLORS.pad }) }), { clearcoat });
  const targetGlow = useMemo(() => glowOf(target), [target]);
  const vorticesRef = useRef<InstancedMesh>(null);
  const exitsRef = useRef<InstancedMesh>(null);
  const padsRef = useRef<InstancedMesh>(null);
  const targetsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);

  useEffect(
    () => () => {
      channels?.floor.dispose();
      channels?.walls.dispose();
      trails?.dispose();
    },
    [channels, trails],
  );

  useFrame(({ clock }, delta) => {
    const { beat, presentation } = director.store.getState();
    const t = beat ? clamp01((Date.now() - beat.startedAt) / beat.durationMs) : 1;
    const pop = (id: string) => {
      if (beat?.kind !== 'boardEdit' || !presentation) return 1;
      const before = presentation.jumps.some((j) => j.id === id);
      const after = beat.after.jumps.some((j) => j.id === id);
      if (before && !after) return 1 - t;
      return !before && after ? Math.max(0, easeOutBack(t)) : 1;
    };
    // Every part stands on its tile's top and turns only about Y.
    const stamp = (mesh: InstancedMesh | null, list: Jump[], tile: (j: Jump) => number, turn: (j: Jump) => number) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        const [x, , z] = tileToWorld(tile(j));
        place.position.set(x, 0, z);
        place.rotation.set(0, turn(j), 0);
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    stamp(vorticesRef.current, snakes, (j) => j.from, () => clock.elapsedTime * 2.5);
    stamp(exitsRef.current, snakes, (j) => j.to, () => 0);
    stamp(padsRef.current, ladders, (j) => j.from, padHeading);
    stamp(targetsRef.current, ladders, (j) => j.to, () => 0);
    // The landing stars breathe (spec #5 §4.2).
    if (targetGlow) {
      const base = (targetGlow.userData.glow ??= targetGlow.emissiveIntensity) as number;
      targetGlow.emissiveIntensity = base * (0.65 + 0.35 * Math.sin(clock.elapsedTime * 3));
    }
    if (chevrons) chevrons.offset.y -= delta * 0.8;
    if (lights) lights.offset.y -= delta * 0.9; // the trail's lights travel toward the landing
    if (padChevrons) padChevrons.offset.y -= delta * 0.6;
  });

  return (
    <group>
      {channels && (
        <>
          <mesh geometry={channels.walls} name="slide-walls">
            <meshStandardMaterial color={WORLD_COLORS.cloud} roughness={0.45} />
          </mesh>
          <mesh geometry={channels.floor} name="slide-floors" receiveShadow>
            <meshStandardMaterial {...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide })} side={DoubleSide} roughness={0.8} />
          </mesh>
        </>
      )}
      {trails && (
        <mesh geometry={trails} name="pad-trails">
          <meshPhysicalMaterial
            {...(lights ? { map: lights, emissiveMap: lights } : { color: WORLD_COLORS.pad })}
            emissive={WORLD_COLORS.cloud}
            emissiveIntensity={0.45}
            roughness={0.3}
            clearcoat={clearcoat ? 0.9 : 0}
            clearcoatRoughness={0.15}
            transparent
            opacity={0.85}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
      <instancedMesh ref={vorticesRef} name="vortices" args={[vortex.geometry, vortex.material, MAX_JUMPS]} />
      <instancedMesh ref={exitsRef} name="exits" args={[exit.geometry, exit.material, MAX_JUMPS]} />
      <instancedMesh ref={padsRef} name="pads" args={[pad.geometry, pad.material, MAX_JUMPS]} />
      <instancedMesh ref={targetsRef} name="targets" args={[target.geometry, target.material, MAX_JUMPS]} />
    </group>
  );
}
