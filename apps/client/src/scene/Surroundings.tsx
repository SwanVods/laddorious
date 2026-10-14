import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { Color, Fog } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { BOARD_SCALE } from './layout';
import { skyTexture } from './textures';
import { WorldParts } from './WorldParts';
import { matchWorld } from './world';

/** Half the shadow camera's box: the board and what stands on it. */
const SHADOW_REACH = 13 * BOARD_SCALE;

/** Sky, fog, light, and the Sky Course round the board (board theme spec); the crown is its own part (Crown.tsx). */
export function Surroundings({ shadows, clouds, clearcoat, reducedMotion }: { shadows: boolean; clouds: number; clearcoat: boolean; reducedMotion: boolean }) {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const world = useMemo(() => matchWorld(clouds), [clouds]);

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

  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.groundLight, 1.15]} />
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
      <WorldParts placements={world} clearcoat={clearcoat} reducedMotion={reducedMotion} />
    </>
  );
}
