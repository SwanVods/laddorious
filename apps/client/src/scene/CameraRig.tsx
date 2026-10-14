import type { PlayerId } from '@laddorious/core';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { tuning } from '../app/tuning';
import { cameraShot } from './camera';
import { pinchZoom, wheelZoom } from './zoom';
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
  const canvas = useThree((s) => s.gl.domElement);
  // The overview's zoom (2026-10-15): a mouse wheel or a two-finger pinch over the board.
  const zoomRef = useRef(1);
  useEffect(() => {
    const limits = () => ({ min: tuning().camera.overview.zoomMin, max: tuning().camera.overview.zoomMax });
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { gap: number; zoom: number } | null = null;
    const gap = () => {
      const [a, b] = [...fingers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = wheelZoom(zoomRef.current, e.deltaY, limits());
    };
    const onDown = (e: PointerEvent) => {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2) pinch = { gap: gap(), zoom: zoomRef.current };
    };
    const onMove = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && fingers.size === 2) zoomRef.current = pinchZoom(pinch.zoom, pinch.gap, gap(), limits());
    };
    const onUp = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinch = null;
    };
    canvas.style.touchAction = 'none'; // the browser leaves pinches on the board to the game
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [canvas]);
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
      faceOffs: state.presentation?.faceOffs ?? [],
      zoom: zoomRef.current,
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
