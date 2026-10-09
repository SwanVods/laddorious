import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, Fog, Object3D, Vector3, type Group, type InstancedMesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD_COLORS, PODIUM_COLORS, SEAT_COLORS, WORLD_COLORS } from '../app/theme';
import { PIECE_GEOMETRY } from '../assets/models';
import { Slot, preloadModels, type SlotName } from '../assets/slots';
import type { PieceId } from '../service/matchService';
import type { Vec3 } from './layout';
import { webglAvailable } from './MatchScene';
import { clamp01, easeOutBack } from './motion';
import { ContextLossWatch } from './Probes';
import { QUALITY, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import type { TagRegistry } from './tags';
import { skyTexture } from './textures';

// The main menu's 3D backdrop (spec #2 §7.1, per the menu mockup): your piece turning on a
// podium on a little floating island, board tiles drifting behind it, a few clouds.

export const MENU_CAMERA = { fov: 35, position: [0, 1.9, 7.8] as Vec3, target: [0, 1.25, 0] as Vec3 };
const PODIUM_X = -0.6;
const TOP_Y = 0.55;
const PIECE_SCALE = 1.25;
const SWAP_MS = 380;

/** Screen anchors the menu's DOM follows: the name plate on the podium's front, the arrows beside it. */
export type MenuAnchor = 'plate' | 'prev' | 'next';
const ANCHORS: Record<MenuAnchor, Vec3> = { plate: [PODIUM_X, 0.24, 1.47], prev: [PODIUM_X - 2.05, 1.25, 0], next: [PODIUM_X + 2.05, 1.25, 0] };

const TILE_COLORS = [...BOARD_COLORS.squares, BOARD_COLORS.mystery];
const TILES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 1.9 + 0.4;
  const r = 4.2 + (i % 4) * 1.3;
  return { x: Math.cos(a) * r + 1.2, y: -0.4 + ((i * 7) % 9) * 0.45, z: -2.2 - Math.abs(Math.sin(a)) * 4 - (i % 3), phase: i * 1.7, spin: 0.2 + (i % 5) * 0.08 };
});
/** Clouds below and behind the podium: four puffs each. */
const PUFFS = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 4 }, (_, k) => {
    const size = 0.9 + ((k * 5 + i) % 4) * 0.25;
    return { x: -9 + i * 2.6 + (k - 1.5) * 1.3, y: -3.2 + (i % 3) * 0.6 + (k % 2) * 0.3, z: -6 - (i % 2) * 3, sx: size * 1.4, s: size };
  }),
);

interface MenuContentProps {
  piece: PieceId;
  level: QualityLevel;
  reducedMotion: boolean;
  anchors?: TagRegistry;
}

/** Everything inside the menu's canvas. */
export function MenuContent({ piece, level, reducedMotion, anchors }: MenuContentProps) {
  const profile = QUALITY[level];
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const geometry = useMemo(() => PIECE_GEOMETRY[piece](), [piece]);
  const tileGeometry = useMemo(() => new RoundedBoxGeometry(0.6, 0.14, 0.6, 2, 0.06), []);
  const turntableRef = useRef<Group>(null);
  const tilesRef = useRef<InstancedMesh>(null);
  const puffsRef = useRef<InstancedMesh>(null);
  const swapAtRef = useRef(0);
  const place = useMemo(() => new Object3D(), []);
  const point = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    const { background, fog } = scene;
    scene.background = sky ?? new Color(WORLD_COLORS.sky[1]);
    scene.fog = new Fog(WORLD_COLORS.fog, 14, 32);
    return () => {
      scene.background = background;
      scene.fog = fog;
    };
  }, [scene, sky]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  // Load every model while the menu shows, so the match never pops in (spec #5 §6).
  useEffect(() => preloadModels(), []);
  // A new piece pops in (spec #2 §6.2 bounce).
  useEffect(() => {
    swapAtRef.current = performance.now();
  }, [piece]);

  useLayoutEffect(() => {
    const tiles = tilesRef.current;
    if (tiles) {
      const color = new Color();
      TILES.forEach((_, i) => tiles.setColorAt(i, color.set(TILE_COLORS[i % TILE_COLORS.length]!)));
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    }
    const puffs = puffsRef.current;
    if (!puffs) return;
    const shown = PUFFS.slice(0, profile.clouds).flat();
    shown.forEach((p, i) => {
      place.position.set(p.x, p.y, p.z);
      place.rotation.set(0, 0, 0);
      place.scale.set(p.sx, p.s, p.s);
      place.updateMatrix();
      puffs.setMatrixAt(i, place.matrix);
    });
    puffs.count = shown.length;
    puffs.instanceMatrix.needsUpdate = true;
  }, [place, profile.clouds]);

  useFrame(({ camera, clock, size }, delta) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const turntable = turntableRef.current;
    if (turntable) {
      if (reducedMotion) turntable.rotation.y = -0.45;
      else turntable.rotation.y += delta * 0.55;
      turntable.position.y = TOP_Y + (reducedMotion ? 0 : Math.abs(Math.sin(t * 1.8)) * 0.06);
      const pop = reducedMotion ? 1 : easeOutBack(clamp01((performance.now() - swapAtRef.current) / SWAP_MS));
      turntable.scale.setScalar(PIECE_SCALE * Math.max(0.001, pop));
    }
    const tiles = tilesRef.current;
    if (tiles) {
      TILES.forEach((d, i) => {
        place.position.set(d.x, d.y + Math.sin(t * 0.8 + d.phase) * (reducedMotion ? 0 : 0.25), d.z);
        place.rotation.set(d.phase + t * d.spin, d.phase * 0.7 + t * d.spin * 0.8, 0);
        place.scale.setScalar(1);
        place.updateMatrix();
        tiles.setMatrixAt(i, place.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
    }
    camera.position.set(Math.sin(t * 0.3) * 0.25, MENU_CAMERA.position[1], MENU_CAMERA.position[2]);
    camera.lookAt(...MENU_CAMERA.target);
    camera.updateMatrixWorld();
    if (!anchors) return;
    for (const [key, at] of Object.entries(ANCHORS)) {
      const el = anchors.elements.get(key);
      if (!el) continue;
      point.set(...at).project(camera);
      el.style.transform = `translate(${(((point.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - point.y) / 2) * size.height).toFixed(1)}px)`;
    }
  });

  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.islandRock, 1.25]} />
      <directionalLight
        position={[-4, 8, 6]}
        intensity={2.4}
        castShadow={profile.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-bias={-0.0005}
      />
      <group position-x={PODIUM_X}>
        <mesh position-y={0.38} receiveShadow castShadow={profile.shadows}>
          <cylinderGeometry args={[1.35, 1.42, 0.34, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.top} roughness={0.5} />
        </mesh>
        <mesh position-y={0.2}>
          <cylinderGeometry args={[1.46, 1.46, 0.12, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.band} metalness={0.3} roughness={0.35} />
        </mesh>
        <mesh position-y={-0.02} castShadow={profile.shadows}>
          <cylinderGeometry args={[1.5, 1.15, 0.36, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.base} roughness={0.45} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-y={TOP_Y + 0.005}>
          <torusGeometry args={[1.18, 0.045, 10, 64]} />
          <meshStandardMaterial color={PODIUM_COLORS.ring} emissive={PODIUM_COLORS.ring} emissiveIntensity={0.7} />
        </mesh>
        <mesh rotation-x={Math.PI} position-y={-1.4}>
          <coneGeometry args={[1.55, 2.4, 7]} />
          <meshStandardMaterial color={PODIUM_COLORS.island} roughness={0.9} flatShading />
        </mesh>
        <mesh rotation-x={Math.PI} position={[0.9, -1.05, 0.5]}>
          <coneGeometry args={[0.7, 1.3, 6]} />
          <meshStandardMaterial color={PODIUM_COLORS.chunk} roughness={0.9} flatShading />
        </mesh>
        {!profile.shadows && (
          <mesh rotation-x={-Math.PI / 2} position-y={TOP_Y + 0.008}>
            <circleGeometry args={[0.62, 32]} />
            <meshBasicMaterial color={WORLD_COLORS.ink} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        )}
        <group ref={turntableRef} name="menu-turntable" position-y={TOP_Y}>
          <Slot
            name={`piece.${piece}` as SlotName}
            seat={SEAT_COLORS[0]}
            clearcoat={profile.clearcoat}
            shadows={profile.shadows}
            fallback={
              <mesh name="menu-piece" geometry={geometry} castShadow={profile.shadows}>
                <meshPhysicalMaterial color={SEAT_COLORS[0]} clearcoat={0.9} clearcoatRoughness={0.15} roughness={0.3} />
              </mesh>
            }
          />
        </group>
      </group>
      <instancedMesh ref={tilesRef} args={[tileGeometry, undefined, TILES.length]}>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={puffsRef} args={[undefined, undefined, PUFFS.flat().length]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color={WORLD_COLORS.cloud} roughness={1} emissive={WORLD_COLORS.cloud} emissiveIntensity={0.22} />
      </instancedMesh>
    </>
  );
}

interface MenuSceneProps {
  piece: PieceId;
  setting: QualitySetting;
  reducedMotion: boolean;
  anchors?: TagRegistry;
}

/** The menu's canvas. Without WebGL the menu still works over the plain sky gradient. Remount (`key`) to change quality. */
export function MenuScene({ piece, setting, reducedMotion, anchors }: MenuSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level] = useState<QualityLevel>(() => startLevel(setting, deviceEnv()));
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      <Canvas
        shadows={profile.shadows ? 'percentage' : false}
        dpr={[1, profile.dpr]}
        gl={{ antialias: profile.antialias }}
        camera={{ fov: MENU_CAMERA.fov, near: 0.1, far: 100, position: MENU_CAMERA.position }}
      >
        <MenuContent piece={piece} level={level} reducedMotion={reducedMotion} anchors={anchors} />
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
