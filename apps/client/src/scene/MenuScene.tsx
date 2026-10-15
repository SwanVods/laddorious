import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, Fog, MeshStandardMaterial, Object3D, Vector3, type Group, type InstancedMesh } from 'three';
import { BOARD_COLORS, SEAT_COLORS, WORLD_COLORS } from '../app/theme';
import { standInsInShadowsOnly } from '../assets/shadowOnly';
import { PIECE_GEOMETRY, tileGeometry } from '../assets/models';
import { preloadSlotMeshes, useSlotMesh } from '../assets/slotMesh';
import { Slot, preloadModels, type SlotName } from '../assets/slots';
import type { PieceId } from '../service/matchService';
import { TILE_ACROSS, TILE_THICKNESS, type Vec3 } from './layout';
import { webglAvailable } from './MatchScene';
import { menuWorld } from './world';
import { WorldParts } from './WorldParts';
import { GENTLE, clamp01, easeOut, easeOutBack } from './motion';
import { ContextLossWatch } from './Probes';
import { QUALITY, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import type { TagRegistry } from './tags';
import { skyTexture } from './textures';

// The main menu's 3D backdrop (spec #2 §7.1, per the menu mockup): your piece turning on a
// podium on a little inflatable platform (board theme spec §3), board tiles drifting behind it, a few clouds.

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
/** The floating tiles are the board's tile, shrunk to 0.6 across and 0.14 thick (spec #5 §4.2). */
const MENU_TILE = { across: 0.6 / TILE_ACROSS, up: 0.14 / TILE_THICKNESS } as const;
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
  useEffect(() => () => sky?.dispose(), [sky]);
  const geometry = useMemo(() => PIECE_GEOMETRY[piece](), [piece]);
  const tile = useSlotMesh('tile', () => ({ geometry: tileGeometry(), material: new MeshStandardMaterial({ roughness: 0.45 }) }), { clearcoat: profile.clearcoat });
  const turntableRef = useRef<Group>(null);
  const world = useMemo(() => menuWorld(profile.clouds, PODIUM_X), [profile.clouds]);
  const tilesRef = useRef<InstancedMesh>(null);
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
  useEffect(() => {
    preloadModels(profile.lowModels);
    preloadSlotMeshes(profile.modelEnds);
  }, [profile.lowModels, profile.modelEnds]);
  // A new piece pops in (spec #2 §6.2 bounce).
  useEffect(() => {
    swapAtRef.current = performance.now();
  }, [piece]);

  useLayoutEffect(() => {
    const tiles = tilesRef.current;
    if (!tiles) return;
    const color = new Color();
    TILES.forEach((_, i) => tiles.setColorAt(i, color.set(TILE_COLORS[i % TILE_COLORS.length]!)));
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  }, [tile]);

  useFrame(({ camera, clock, size }, delta) => {
    // Reduced motion keeps it all moving, slower and smaller (2026-10-15: reduce, not remove).
    const k = reducedMotion ? GENTLE : 1;
    const t = clock.elapsedTime * k;
    const turntable = turntableRef.current;
    if (turntable) {
      turntable.rotation.y += delta * 0.55 * k;
      turntable.position.y = TOP_Y + k * Math.abs(Math.sin(t * 1.8)) * 0.06;
      const grow = clamp01((performance.now() - swapAtRef.current) / SWAP_MS);
      const pop = reducedMotion ? easeOut(grow) : easeOutBack(grow);
      turntable.scale.setScalar(PIECE_SCALE * Math.max(0.001, pop));
    }
    const tiles = tilesRef.current;
    if (tiles) {
      TILES.forEach((d, i) => {
        place.position.set(d.x, d.y + Math.sin(t * 0.8 + d.phase) * 0.25 * k, d.z);
        place.rotation.set(d.phase + t * d.spin, d.phase * 0.7 + t * d.spin * 0.8, 0);
        place.scale.set(MENU_TILE.across, MENU_TILE.up, MENU_TILE.across);
        place.translateY((-TILE_THICKNESS / 2) * MENU_TILE.up); // turn about the tile's middle, not its base
        place.updateMatrix();
        tiles.setMatrixAt(i, place.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
    }
    camera.position.set(Math.sin(t * 0.3) * 0.25 * k, MENU_CAMERA.position[1], MENU_CAMERA.position[2]);
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
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.groundLight, 1.25]} />
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
      <WorldParts placements={world} clearcoat={profile.clearcoat} reducedMotion={reducedMotion} />
      <group position-x={PODIUM_X}>
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
            low={profile.lowModels}
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
      <instancedMesh ref={tilesRef} args={[tile.geometry, tile.material, TILES.length]} />
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
        onCreated={({ gl }) => void standInsInShadowsOnly(gl)}
      >
        <MenuContent piece={piece} level={level} reducedMotion={reducedMotion} anchors={anchors} />
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
