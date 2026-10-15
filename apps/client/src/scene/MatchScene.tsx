import type { PlayerId, PlayerView } from '@laddorious/core';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { preloadSlotMeshes } from '../assets/slotMesh';
import { preloadModels } from '../assets/slots';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { Jumps } from './Jumps';
import { createPeeks, type Peeks } from './paths';
import { Pieces, type Roll } from './Pieces';
import { ContextLossWatch, QualityWatch, StatsProbe } from './Probes';
import { QUALITY, autoStepDown, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import { Surroundings } from './Surroundings';
import { Crown, type PieceRegistry } from './Crown';
import { setSeatPieces } from './footprint';
import { TagProjector } from './TagProjector';
import { createTagPeeks, type TagRegistry } from './tags';

export const WEBGL_MESSAGE = "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox.";

/** Can this browser draw WebGL? (spec #2 §8) */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    // The probe's context is let go at once: browsers keep only a few alive (2026-10-15).
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export interface SceneContentProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  board: PlayerView['board'];
  level: QualityLevel;
  watch: PlayerId | null;
  /** I'm peeking at the board from my card pick. */
  peeking?: boolean;
  reducedMotion: boolean;
  /** Name tags to keep over the pieces (spec #2 §7.2). */
  tags?: TagRegistry;
  /** The paths a player tapped to see (spec #5 A13); the scene keeps its own unless a test passes one. */
  peeks?: Peeks;
}

/** Everything inside the canvas: the world, the pieces and the camera (spec #2 §6). */
export function SceneContent({ director, seats, me, board, level, watch, reducedMotion, tags, peeks, peeking = false }: SceneContentProps) {
  const profile = QUALITY[level];
  const own = useMemo(createPeeks, []);
  const tagPeeks = useMemo(createTagPeeks, []);
  const pieces = useMemo((): PieceRegistry => new Map(), []);
  const rolls = useMemo(() => new Map<PlayerId, Roll>(), []);
  // A match entered without the menu (a resumed online seat) loads the models itself; after the menu it's all cached (2026-10-15).
  useEffect(() => {
    preloadModels(profile.lowModels);
    preloadSlotMeshes(profile.modelEnds);
  }, [profile.lowModels, profile.modelEnds]);
  // Pieces stand by their measured sizes, so nothing overlaps (2026-10-14).
  useLayoutEffect(() => setSeatPieces(Object.fromEntries(seats.map((s) => [s.playerId, s.piece]))), [seats]);
  const peeked = peeks ?? own;
  const tap = useCallback((tile: number) => peeked.tap(tile, director.store.getState().presentation?.jumps ?? board.jumps, Date.now()), [peeked, director, board]);
  return (
    <>
      <Surroundings shadows={profile.shadows} clouds={profile.clouds} clearcoat={profile.clearcoat} reducedMotion={reducedMotion} />
      <Board board={board} director={director} clearcoat={profile.clearcoat} onTap={tap} />
      <Jumps director={director} clearcoat={profile.clearcoat} peeks={peeked} modelEnds={profile.modelEnds} reducedMotion={reducedMotion} />
      <Pieces director={director} seats={seats} shadows={profile.shadows} clearcoat={profile.clearcoat} low={profile.lowModels} reducedMotion={reducedMotion} boardSize={board.size} tagPeeks={tagPeeks} registry={pieces} rolls={rolls} />
      <Crown director={director} pieces={pieces} shadows={profile.shadows} clearcoat={profile.clearcoat} low={profile.lowModels} reducedMotion={reducedMotion} />
      <CameraRig director={director} seats={seats} me={me} watch={watch} reducedMotion={reducedMotion} boardSize={board.size} peeking={peeking} />
      {tags && <TagProjector director={director} seats={seats} me={me} boardSize={board.size} tags={tags} peeks={tagPeeks} rolling={rolls} />}
    </>
  );
}

export interface MatchSceneProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  setting: QualitySetting;
  watch?: PlayerId | null;
  peeking?: boolean;
  reducedMotion?: boolean;
  showStats?: boolean;
  tags?: TagRegistry;
}

/**
 * The match in 3D. To change the quality setting, remount it with a new `key`:
 * antialiasing is fixed when the WebGL context is made. Auto steps down to Low live.
 */
export function MatchScene({ director, seats, me, setting, watch = null, reducedMotion = false, showStats = false, tags, peeking = false }: MatchSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level, setLevel] = useState<QualityLevel>(() => startLevel(setting, deviceEnv()));
  const board = useStore(director.store, (s) => s.settled?.view.board);
  const stepDown = useCallback(() => {
    setLevel('low');
    autoStepDown.setState({ stepped: true });
  }, []);
  // A new match starts at the setting's level again.
  useEffect(() => () => autoStepDown.setState({ stepped: false }), []);
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return <p className="webgl-message">{WEBGL_MESSAGE}</p>;
  if (!board) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      {/* 'percentage' is PCF: three 0.186 dropped the soft PCF type R3F would pick for `true`. */}
      <Canvas shadows={profile.shadows ? 'percentage' : false} dpr={[1, profile.dpr]} gl={{ antialias: profile.antialias }} camera={{ fov: 42, near: 0.5, far: 200, position: [0, 23, 26] }}>
        <SceneContent director={director} seats={seats} me={me} board={board} level={level} watch={watch} reducedMotion={reducedMotion} tags={tags} peeking={peeking} />
        {showStats && <StatsProbe />}
        {setting === 'auto' && level === 'high' && <QualityWatch onStepDown={stepDown} />}
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
