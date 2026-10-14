import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, Color, CylinderGeometry, Fog, Object3D, type Group, type InstancedMesh } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { Slot } from '../assets/slots';
import { BOARD_SCALE, COLUMNS, TILE_SIZE, type Vec3 } from './layout';

/** Half the shadow camera's box: the board and what stands on it. */
const SHADOW_REACH = 13 * BOARD_SCALE;
import { skyTexture } from './textures';

/** The island under the board: a wobbly, sand-topped rock in one draw call (vertex colours). */
export function islandGeometry(): CylinderGeometry {
  const g = new CylinderGeometry(12.5 * BOARD_SCALE, 8.5 * BOARD_SCALE, 2.4, 40, 1);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const sand = new Color(WORLD_COLORS.islandTop);
  const rock = new Color(WORLD_COLORS.islandRock);
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const wobble = 1 + 0.05 * Math.sin(angle * 5) + 0.035 * Math.cos(angle * 3);
    pos.setX(i, pos.getX(i) * wobble);
    pos.setZ(i, pos.getZ(i) * wobble);
    (pos.getY(i) > 1.1 ? sand : rock).toArray(colors, i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

const EDGE = (TILE_SIZE * COLUMNS) / 2 + 0.6;
/** Bumpers ring the board, nine to a side. */
const BUMPERS: Vec3[] = Array.from({ length: 9 }, (_, i) => -EDGE + (i + 0.5) * ((2 * EDGE) / 9)).flatMap((t): Vec3[] => [
  [t, -0.02, -EDGE],
  [t, -0.02, EDGE],
  [-EDGE, -0.02, t],
  [EDGE, -0.02, t],
]);
const CLOUDS: Vec3[] = Array.from({ length: 8 }, (_, i): Vec3 => {
  const a = (i / 8) * Math.PI * 2 + 0.4;
  const r = (20 + (i % 3) * 3) * BOARD_SCALE;
  return [Math.cos(a) * r, 5 + (i % 4), Math.sin(a) * r];
});
/** Each cloud is three puffs: [x offset, y offset, size]. */
const PUFFS: Vec3[] = [
  [-0.9, 0, 1],
  [0, 0.35, 1.3],
  [0.9, -0.05, 0.95],
];

/** Sky, fog, light, the island with its bumpers and the clouds (spec #2 §6.1); the crown is its own part (Crown.tsx). */
export function Surroundings({ shadows, clouds }: { shadows: boolean; clouds: number }) {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const island = useMemo(() => islandGeometry(), []);
  const cloudsRef = useRef<Group>(null);
  const bumpersRef = useRef<InstancedMesh>(null);
  const puffsRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const { background, fog } = scene;
    scene.background = sky ?? new Color(WORLD_COLORS.sky[1]);
    // The overview sits about 46 from the board (board theme spec §5): the fog starts beyond it.
    scene.fog = new Fog(WORLD_COLORS.fog, 70, 190);
    return () => {
      scene.background = background;
      scene.fog = fog;
    };
  }, [scene, sky]);

  useLayoutEffect(() => {
    const mesh = bumpersRef.current;
    if (!mesh) return;
    const at = new Object3D();
    const color = new Color();
    BUMPERS.forEach((spot, i) => {
      at.position.set(...spot);
      at.updateMatrix();
      mesh.setMatrixAt(i, at.matrix);
      mesh.setColorAt(i, color.set(WORLD_COLORS.bumper[i % 2]!));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useLayoutEffect(() => {
    const mesh = puffsRef.current;
    if (!mesh) return;
    const at = new Object3D();
    let n = 0;
    CLOUDS.slice(0, clouds).forEach(([x, y, z], c) => {
      for (const [dx, dy, size] of PUFFS) {
        at.position.set(x + dx, y + dy, z);
        at.scale.setScalar(size * (1 + (c % 3) * 0.15));
        at.updateMatrix();
        mesh.setMatrixAt(n, at.matrix);
        n += 1;
      }
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }, [clouds]);

  useFrame((_, delta) => {
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.01;
  });

  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.islandRock, 1.15]} />
      <directionalLight
        position={[9, 18, 11]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-SHADOW_REACH}
        shadow-camera-right={SHADOW_REACH}
        shadow-camera-top={SHADOW_REACH}
        shadow-camera-bottom={-SHADOW_REACH}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0006}
      />
      <Slot
        name="island"
        fallback={
          <mesh geometry={island} position-y={-1.42} receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.9} />
          </mesh>
        }
      />
      <instancedMesh ref={bumpersRef} args={[undefined, undefined, BUMPERS.length]}>
        <cylinderGeometry args={[0.22, 0.26, 0.4, 14]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      <group ref={cloudsRef}>
        <instancedMesh ref={puffsRef} args={[undefined, undefined, CLOUDS.length * PUFFS.length]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshLambertMaterial color={WORLD_COLORS.cloud} />
        </instancedMesh>
      </group>
    </>
  );
}
