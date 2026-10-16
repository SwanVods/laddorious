import type { PlayerId } from '@laddorious/core';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { tuning } from '../app/tuning';
import { OVERVIEW_TARGET_Z, cameraShot, heldNext, homeShown, myPickPending, type Focus, type ShotMode } from './camera';
import { fitOverview } from './fit';
import { pinchZoom, rememberZoom, savedZoom, wheelZoom } from './zoom';
import { BOARD_HALF, type Vec3 } from './layout';
import { NO_PAN, PanDrag, clampPan, dragPan, panAfterShot, panBox, panReach, unitsPerPixel, type Pan } from './pan';
import { cameraPoint } from './motion';

interface CameraRigProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  watch: PlayerId | null;
  reducedMotion: boolean;
  boardSize: number;
  peeking?: boolean;
  /** The card-pick window I picked in, before the view knows (2026-10-15). */
  pickedWindow?: number | null;
  /** When I last pressed Back to my piece (epoch ms; 2026-10-17). */
  homeAt?: number | null;
}

/** Moves the camera by the rules of spec #2 §5.3, easing between shots unless a shot is a cut. */
export function CameraRig({ director, seats, me, watch, reducedMotion, boardSize, peeking = false, pickedWindow = null, homeAt = null }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  // The overview's zoom (2026-10-15): a mouse wheel or a two-finger pinch over the board.
  // It starts where the last match left it (2026-10-15).
  const zoomRef = useRef(savedZoom({ min: tuning().camera.overview.zoomMin, max: tuning().camera.overview.zoomMax }));
  // The zoomed-in overview's pan (board theme spec B5), and the last shot's kind: only the overview pans.
  const panRef = useRef<Pan>(NO_PAN);
  // Null until the first frame, so the match starts with every piece in frame (2026-10-17).
  const modeRef = useRef<ShotMode | null>(null);
  // The Break the overview last fitted itself to (its start, epoch ms).
  const fittedBreakRef = useRef<number | null>(null);
  // What the camera was last on: it stays there through beats with nothing to show, while the timeline plays (2026-10-15).
  const heldRef = useRef<Focus | null>(null);
  useEffect(() => {
    const limits = () => ({ min: tuning().camera.overview.zoomMin, max: tuning().camera.overview.zoomMax });
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { gap: number; zoom: number } | null = null;
    const drag = new PanDrag();
    const gap = () => {
      const [a, b] = [...fingers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = wheelZoom(zoomRef.current, e.deltaY, limits());
      rememberZoom(zoomRef.current);
    };
    const onDown = (e: PointerEvent) => {
      drag.down(e.pointerId, e.clientX, e.clientY);
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2) pinch = { gap: gap(), zoom: zoomRef.current };
    };
    const onUp = (e: PointerEvent) => {
      drag.up(e.pointerId);
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinch = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return;
      // Let go off the canvas (over the HUD): its pointerup never came here, so end it now.
      if (e.buttons === 0) {
        onUp(e);
        return;
      }
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && fingers.size === 2) {
        zoomRef.current = pinchZoom(pinch.zoom, pinch.gap, gap(), limits());
        rememberZoom(zoomRef.current);
        return;
      }
      const { overview, pan } = tuning().camera;
      const step = drag.move(e.pointerId, e.clientX, e.clientY, pan.tapSlopPx);
      if (!step || modeRef.current !== 'overview' || zoomRef.current >= pan.lockAbove) return;
      panRef.current = dragPan(panRef.current, step.dx, step.dy, unitsPerPixel(overview.height * zoomRef.current, canvas.clientHeight));
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
    const { overview, pan } = tuning().camera;
    panRef.current = clampPan(panRef.current, panBox(panReach(zoomRef.current, pan.lockAbove, overview.zoomMin), BOARD_HALF, OVERVIEW_TARGET_Z));
    const shot = cameraShot({
      beat: state.beat,
      window: state.settled?.view.awaiting.window ?? null,
      myPick: myPickPending(offer, state.settled?.view.awaiting.windowId ?? null, pickedWindow),
      me,
      watch,
      reducedMotion,
      nowMs: now,
      peeking,
      faceOffs: state.presentation?.faceOffs ?? [],
      zoom: zoomRef.current,
      pan: panRef.current,
      timeline: state.timeline,
      held: heldRef.current,
      home: homeShown(homeAt, now),
      // Through hops the camera glides instead of bobbing with the piece (2026-10-15).
      piece: (id): Vec3 => cameraPoint(state, id, seatOf.get(id) ?? 0, now, boardSize) ?? [0, 0, 0],
    });
    // Back on the overview, and at each Break: every piece in frame, panning and zooming out only as needed (2026-10-17).
    const atBreak = state.beat?.kind === 'roundBreak' ? state.beat.startedAt : null;
    if (shot.mode === 'overview' && (modeRef.current !== 'overview' || (atBreak !== null && atBreak !== fittedBreakRef.current))) {
      const points = seats.map((s, i) => cameraPoint(state, s.playerId, i, now, boardSize)).filter((p): p is Vec3 => p !== null);
      const lens = camera as PerspectiveCamera;
      const fitted = fitOverview({ zoom: zoomRef.current, pan: panRef.current }, points, { fov: lens.fov, aspect: lens.aspect });
      zoomRef.current = fitted.zoom;
      panRef.current = fitted.pan;
      fittedBreakRef.current = atBreak;
    }
    modeRef.current = shot.mode;
    heldRef.current = heldNext({ beat: state.beat, window: state.settled?.view.awaiting.window ?? null, focus: shot.focus, held: heldRef.current });
    panRef.current = panAfterShot(panRef.current, shot.mode);
    const { follow, swoop } = tuning().camera;
    // Reduced motion glides more slowly, never cuts (2026-10-15: reduce, not remove).
    const ease = (shot.mode === 'swoop' ? swoop.ease : follow.ease) * (reducedMotion ? 0.6 : 1);
    const k = shot.cut ? 1 : 1 - Math.exp(-delta * ease);
    camera.position.lerp(aim.position.set(...shot.position), k);
    lookRef.current.lerp(aim.target.set(...shot.target), k);
    camera.lookAt(lookRef.current);
  });
  return null;
}
