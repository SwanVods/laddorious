import type { PlayerId, PlayerView } from '@laddorious/core';
import { Canvas } from '@react-three/fiber';
import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { Jumps } from './Jumps';
import { Pieces } from './Pieces';
import { ContextLossWatch, QualityWatch, StatsProbe } from './Probes';
import { QUALITY, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import { Surroundings } from './Surroundings';
import { TagProjector } from './TagProjector';
import type { TagRegistry } from './tags';

export const WEBGL_MESSAGE = "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox.";

/** Can this browser draw WebGL? (spec #2 §8) */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
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
  reducedMotion: boolean;
  /** Name tags to keep over the pieces (spec #2 §7.2). */
  tags?: TagRegistry;
}

/** Everything inside the canvas: the world, the pieces and the camera (spec #2 §6). */
export function SceneContent({ director, seats, me, board, level, watch, reducedMotion, tags }: SceneContentProps) {
  const profile = QUALITY[level];
  return (
    <>
      <Surroundings shadows={profile.shadows} clouds={profile.clouds} />
      <Board board={board} director={director} />
      <Jumps director={director} />
      <Pieces director={director} seats={seats} shadows={profile.shadows} reducedMotion={reducedMotion} boardSize={board.size} />
      <CameraRig director={director} seats={seats} me={me} watch={watch} reducedMotion={reducedMotion} boardSize={board.size} />
      {tags && <TagProjector director={director} seats={seats} boardSize={board.size} tags={tags} />}
    </>
  );
}

export interface MatchSceneProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  setting: QualitySetting;
  watch?: PlayerId | null;
  reducedMotion?: boolean;
  showStats?: boolean;
  tags?: TagRegistry;
}

/**
 * The match in 3D. To change the quality setting, remount it with a new `key`:
 * antialiasing is fixed when the WebGL context is made. Auto steps down to Low live.
 */
export function MatchScene({ director, seats, me, setting, watch = null, reducedMotion = false, showStats = false, tags }: MatchSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level, setLevel] = useState<QualityLevel>(() => startLevel(setting, deviceEnv()));
  const board = useStore(director.store, (s) => s.settled?.view.board);
  const stepDown = useCallback(() => setLevel('low'), []);
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return <p className="webgl-message">{WEBGL_MESSAGE}</p>;
  if (!board) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      {/* 'percentage' is PCF: three 0.186 dropped the soft PCF type R3F would pick for `true`. */}
      <Canvas shadows={profile.shadows ? 'percentage' : false} dpr={[1, profile.dpr]} gl={{ antialias: profile.antialias }} camera={{ fov: 42, near: 0.5, far: 200, position: [0, 23, 26] }}>
        <SceneContent director={director} seats={seats} me={me} board={board} level={level} watch={watch} reducedMotion={reducedMotion} tags={tags} />
        {showStats && <StatsProbe />}
        {setting === 'auto' && level === 'high' && <QualityWatch onStepDown={stepDown} />}
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
