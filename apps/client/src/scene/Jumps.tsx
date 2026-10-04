import type { Jump } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Object3D, type InstancedMesh, type Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from 'zustand';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import type { Director } from '../director/director';
import { arcPoint, slideCurve, tileToWorld, type Vec3 } from './layout';
import { clamp01, easeOutBack } from './motion';
import { chevronTexture, swirlTexture } from './textures';

const RIBBON_WIDTH = 0.62;
/** Caps that keep a crowded board inside the draw-call and triangle budget (spec #2 §6.4). */
const MAX_JUMPS = 24;
const MAX_DOTS = 480;

/** A flat strip along points, `width` wide at height y; v runs along it in widths so chevrons tile. */
export function ribbonGeometry(points: Vector3[], width: number, y: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  let along = 0;
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    const sx = (-dz / length) * (width / 2);
    const sz = (dx / length) * (width / 2);
    if (i > 0) along += p.distanceTo(points[i - 1]!);
    positions.push(p.x + sx, y, p.z + sz, p.x - sx, y, p.z - sz);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, along / width, 1, along / width);
    if (i > 0) {
      const a = (i - 1) * 2;
      // Counter-clockwise seen from above, so the strip's front face (and its light) points up.
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** The dots of a launch pad's arc, between its foot and its top. */
export function padArc(jump: Jump): Vec3[] {
  const from = tileToWorld(jump.from);
  const to = tileToWorld(jump.to);
  const span = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const count = Math.max(5, Math.round(span / 0.45));
  return Array.from({ length: count - 1 }, (_, i) => arcPoint(from, to, (i + 1) / count, 1.2 + span * 0.12));
}

function strips(paths: Vector3[][], width: number, y: number): BufferGeometry | null {
  return paths.length === 0 ? null : mergeGeometries(paths.map((points) => ribbonGeometry(points, width, y)));
}

/** Slides (flat vacuum chutes) and launch pads (spec #2 §6.1); parts a board edit adds or removes pop in or out. */
export function Jumps({ director }: { director: Director }) {
  const shown = useStore(director.store, (s) => s.presentation?.jumps);
  const editing = useStore(director.store, (s) => (s.beat?.kind === 'boardEdit' ? s.beat.after.jumps : undefined));
  const jumps = useMemo(() => [...new Map([...(shown ?? []), ...(editing ?? [])].map((j) => [j.id, j])).values()], [shown, editing]);
  const snakes = useMemo(() => jumps.filter((j) => j.to < j.from).slice(0, MAX_JUMPS), [jumps]);
  const ladders = useMemo(() => jumps.filter((j) => j.to > j.from).slice(0, MAX_JUMPS), [jumps]);
  const paths = useMemo(() => snakes.map((j) => slideCurve(j.from, j.to).getPoints(40)), [snakes]);
  const ribbons = useMemo(() => strips(paths, RIBBON_WIDTH, 0.024), [paths]);
  const edges = useMemo(() => strips(paths, RIBBON_WIDTH + 0.16, 0.016), [paths]);
  const dots = useMemo(() => ladders.flatMap(padArc).slice(0, MAX_DOTS), [ladders]);
  const chevrons = useMemo(() => chevronTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const padChevrons = useMemo(() => chevronTexture(WORLD_COLORS.pad, WORLD_COLORS.ink), []);
  const swirl = useMemo(() => swirlTexture(BOARD_COLORS.slide, WORLD_COLORS.chevron), []);
  const vorticesRef = useRef<InstancedMesh>(null);
  const exitsRef = useRef<InstancedMesh>(null);
  const padsRef = useRef<InstancedMesh>(null);
  const targetsRef = useRef<InstancedMesh>(null);
  const dotsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);

  useEffect(
    () => () => {
      ribbons?.dispose();
      edges?.dispose();
    },
    [ribbons, edges],
  );

  useLayoutEffect(() => {
    const mesh = dotsRef.current;
    if (!mesh) return;
    dots.forEach((p, i) => {
      place.position.set(...p);
      place.rotation.set(0, 0, 0);
      place.scale.setScalar(1);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    mesh.count = dots.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dots, place]);

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
    if (padChevrons) padChevrons.offset.y -= delta * 0.6;
  });

  return (
    <group>
      {edges && (
        <mesh geometry={edges}>
          <meshStandardMaterial color={WORLD_COLORS.ink} side={DoubleSide} roughness={0.9} />
        </mesh>
      )}
      {ribbons && (
        <mesh geometry={ribbons} receiveShadow>
          <meshStandardMaterial {...(chevrons ? { map: chevrons } : { color: BOARD_COLORS.slide })} side={DoubleSide} roughness={0.8} />
        </mesh>
      )}
      <instancedMesh ref={vorticesRef} args={[undefined, undefined, MAX_JUMPS]}>
        <circleGeometry args={[0.58, 32]} />
        <meshBasicMaterial {...(swirl ? { map: swirl } : { color: BOARD_COLORS.slide })} transparent />
      </instancedMesh>
      <instancedMesh ref={exitsRef} args={[undefined, undefined, MAX_JUMPS]}>
        <ringGeometry args={[0.4, 0.56, 28]} />
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
      <instancedMesh ref={dotsRef} args={[undefined, undefined, MAX_DOTS]}>
        <icosahedronGeometry args={[0.075, 1]} />
        <meshBasicMaterial color={WORLD_COLORS.pad} />
      </instancedMesh>
    </group>
  );
}
