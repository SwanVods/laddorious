import type { PlayerId } from '@laddorious/core';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { tuning } from '../app/tuning';
import { cameraShot } from './camera';
import type { Vec3 } from './layout';
import { poseAt } from './motion';

interface CameraRigProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  watch: PlayerId | null;
  reducedMotion: boolean;
  boardSize: number;
  peeking?: boolean;
}

/** Moves the camera by the rules of spec #2 §5.3, easing between shots unless a shot is a cut. */
export function CameraRig({ director, seats, me, watch, reducedMotion, boardSize, peeking = false }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const lookRef = useRef(new Vector3(0, 0, 0));
  const aim = useMemo(() => ({ position: new Vector3(), target: new Vector3() }), []);
  const seatOf = useMemo(() => new Map(seats.map((s, i) => [s.playerId, i])), [seats]);

  useFrame((_, delta) => {
    const state = director.store.getState();
    const now = Date.now();
    const offer = state.settled?.view.myOffer;
    const shot = cameraShot({
      beat: state.beat,
      window: state.settled?.view.awaiting.window ?? null,
      myPick: !!offer && offer.picked === null,
      me,
      watch,
      reducedMotion,
      nowMs: now,
      peeking,
      piece: (id): Vec3 => poseAt(state, id, seatOf.get(id) ?? 0, now, boardSize)?.position ?? [0, 0, 0],
    });
    const { follow, swoop } = tuning().camera;
    const k = shot.cut ? 1 : 1 - Math.exp(-delta * (shot.mode === 'swoop' ? swoop.ease : follow.ease));
    camera.position.lerp(aim.position.set(...shot.position), k);
    lookRef.current.lerp(aim.target.set(...shot.target), k);
    camera.lookAt(lookRef.current);
  });
  return null;
}
