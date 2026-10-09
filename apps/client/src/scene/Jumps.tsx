import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, Object3D, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from 'zustand';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import type { Director } from '../director/director';
import { LANE, slideCurve, tileToWorld } from './layout';
import { clamp01, easeOutBack } from './motion';
import { chevronTexture, swirlTexture } from './textures';
import { CHANNEL, channelGeometry, trailGeometry, trailPath } from './tracks';

/** A cap that keeps a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;

/** Slides and launch pads (spec #2 §6.1, spec #5 §4.2): each slide a raised channel, each pad an arched trail to its landing; parts a board edit adds or removes pop in or out. */
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
    const stamp = (mesh: InstancedMesh | null, list: Jump[], tile: (j: Jump) => number, spin: (j: Jump) => number) => {
      if (!mesh) return;
      list.forEach((j, i) => {
        const [x, , z] = tileToWorld(tile(j));
        place.position.set(x, 0.03, z);
        place.rotation.set(-Math.PI / 2, 0, spin(j));
        place.scale.setScalar(pop(j.id));
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    // Pads turn their chevrons towards the ladder's top.
    const towardsTop = (j: Jump) => {
      const [fx, , fz] = tileToWorld(j.from);
      const [tx, , tz] = tileToWorld(j.to);
      return Math.atan2(-(tx - fx), -(tz - fz));
    };
    stamp(vorticesRef.current, snakes, (j) => j.from, () => clock.elapsedTime * 2.5);
    stamp(exitsRef.current, snakes, (j) => j.to, () => 0);
    stamp(padsRef.current, ladders, (j) => j.from, towardsTop);
    stamp(targetsRef.current, ladders, (j) => j.to, () => 0);
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
      <instancedMesh ref={vorticesRef} args={[undefined, undefined, MAX_JUMPS]}>
        <circleGeometry args={[LANE.vortexRadius, 32]} />
        <meshBasicMaterial {...(swirl ? { map: swirl } : { color: BOARD_COLORS.slide })} transparent />
      </instancedMesh>
      <instancedMesh ref={exitsRef} args={[undefined, undefined, MAX_JUMPS]}>
        <ringGeometry args={[LANE.exitInner, LANE.exitOuter, 28]} />
        <meshBasicMaterial color={WORLD_COLORS.chevron} />
      </instancedMesh>
      <instancedMesh ref={padsRef} args={[undefined, undefined, MAX_JUMPS]}>
        <circleGeometry args={[0.6, 28]} />
        <meshStandardMaterial {...(padChevrons ? { map: padChevrons } : { color: WORLD_COLORS.pad })} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={targetsRef} args={[undefined, undefined, MAX_JUMPS]}>
        <ringGeometry args={[0.42, 0.6, 28]} />
        <meshBasicMaterial color={WORLD_COLORS.pad} />
      </instancedMesh>
    </group>
  );
}
