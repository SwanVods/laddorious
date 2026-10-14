import type { PlayerId } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { PIECE_GEOMETRY, dieGeometry, dieRotationFor } from '../assets/models';
import { Slot, setEmissive, type SlotName } from '../assets/slots';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { PIECE_SCALE } from './layout';
import { clamp01, easeOut, landingPose, poseAt, projectileAt, stackLandings, withIdle, type Landing, type Pose } from './motion';
import type { PieceRegistry } from './Crown';
import type { TagPeeks } from './tags';
import { dieAtlasTexture } from './textures';

/** Pieces render at 1.3 × their base size (spec #2 §6.2). */
export { PIECE_SCALE } from './layout';
const DIE_LIFT = 2.2;
const SHIELD_HOOKS = new Set(['beforeSnake', 'beforeAttack']);

export interface Roll {
  face: number;
  forced: boolean;
  startedAt: number;
  durationMs: number;
}

interface PiecesProps {
  director: Director;
  seats: SeatInfo[];
  shadows: boolean;
  clearcoat: boolean;
  /** Draw the lighter piece models (Low quality, spec #5 A14). */
  low?: boolean;
  reducedMotion: boolean;
  boardSize: number;
  /** Pointing at or tapping a piece shows its name tag (round 5). */
  tagPeeks?: TagPeeks;
  /** Where each piece is registered, so the crown can find the winner's head (round 5). */
  registry?: PieceRegistry;
  /** The dice showing over the pieces, by player; the name tags read it (2026-10-14). */
  rolls?: Map<PlayerId, Roll>;
}

/** Every seat's piece, its die and its shield bubble, and card projectiles (spec #2 §5.1, §6.2). */
export function Pieces({ director, seats, shadows, clearcoat, low = false, reducedMotion, boardSize, tagPeeks, registry, rolls }: PiecesProps) {
  const seatOf = useMemo(() => {
    const index = new Map(seats.map((s, i) => [s.playerId, i]));
    return (player: PlayerId) => index.get(player) ?? 0;
  }, [seats]);
  // A die shows from its roll beat until the pieces start moving.
  const rollsRef = useRef(rolls ?? new Map<PlayerId, Roll>());
  // Pieces that land on a stack wiggle a little after their beat (2026-10-14).
  const landingsRef = useRef<Landing[]>([]);
  useEffect(
    () =>
      director.store.subscribe((s, prev) => {
        if (!s.beat || s.beat === prev.beat) return;
        landingsRef.current = [...landingsRef.current.filter((l) => l.atMs > s.beat!.startedAt - 2000), ...stackLandings(s.beat, boardSize)];
        // A pause after the last roll keeps the dice up (2026-10-14).
        if (s.beat.kind !== 'roll' && s.beat.kind !== 'pause') {
          rollsRef.current.clear();
          return;
        }
        for (const e of s.beat.events) {
          if (e.type === 'DieRolled') rollsRef.current.set(e.player, { face: e.face, forced: e.forced, startedAt: s.beat.startedAt, durationMs: s.beat.durationMs });
        }
      }),
    [director, boardSize],
  );
  return (
    <>
      {seats.map((seat, i) => (
        <Actor key={seat.playerId} director={director} seat={seat} index={i} shadows={shadows} clearcoat={clearcoat} low={low} reducedMotion={reducedMotion} boardSize={boardSize} tagPeeks={tagPeeks} registry={registry} rollsRef={rollsRef} landingsRef={landingsRef} />
      ))}
      <Projectile director={director} seatOf={seatOf} />
    </>
  );
}

/** One orb that carries each card from its caster to its target. */
function Projectile({ director, seatOf }: { director: Director; seatOf: (player: PlayerId) => number }) {
  const orbRef = useRef<Mesh>(null);
  useFrame(() => {
    const { beat, presentation } = director.store.getState();
    const at = beat && presentation ? projectileAt(beat, presentation, seatOf, Date.now()) : null;
    if (!orbRef.current) return;
    orbRef.current.visible = at !== null;
    if (at) orbRef.current.position.set(...at);
  });
  return (
    <mesh ref={orbRef} visible={false}>
      <icosahedronGeometry args={[0.22, 1]} />
      <meshBasicMaterial color={WORLD_COLORS.chevron} />
    </mesh>
  );
}

/**
 * Places a piece (2026-10-14, as in the mockup): the body moves, squashes and turns to face its way; the
 * inner model flips and wobbles about the piece's own sides, so a backflip turns it over and a wobble
 * rocks it, both seen side-on by the camera.
 */
export function placePiece(body: Object3D, inner: Object3D, pose: Pose) {
  body.position.set(...pose.position);
  body.rotation.set(0, pose.rotation[1], 0);
  body.scale.set(...pose.scale);
  inner.rotation.set(pose.rotation[0], 0, pose.rotation[2]);
}

interface ActorProps extends Omit<PiecesProps, 'seats'> {
  seat: SeatInfo;
  index: number;
  rollsRef: RefObject<Map<PlayerId, Roll>>;
  landingsRef: RefObject<Landing[]>;
}

function Actor({ director, seat, index, shadows, clearcoat, low, reducedMotion, boardSize, tagPeeks, registry, rollsRef, landingsRef }: ActorProps) {
  const bodyRef = useRef<Group>(null);
  const modelRef = useRef<Group>(null);
  const orbRef = useRef<Mesh>(null);
  const blobRef = useRef<Mesh>(null);
  const dieRef = useRef<Group>(null);
  const shieldRef = useRef<Mesh>(null);
  const geometry = useMemo(() => PIECE_GEOMETRY[seat.piece](), [seat.piece]);
  const dieShape = useMemo(() => dieGeometry(), []);
  const atlas = useMemo(() => dieAtlasTexture(WORLD_COLORS.die, WORLD_COLORS.pip), []);
  const slot = `piece.${seat.piece}` as SlotName;
  useEffect(() => {
    const body = bodyRef.current;
    const model = modelRef.current;
    if (!registry || !body || !model) return;
    registry.set(seat.playerId, { body, model });
    return () => void registry.delete(seat.playerId);
  }, [registry, seat.playerId]);

  useFrame(() => {
    const state = director.store.getState();
    const now = Date.now();
    const pose = poseAt(state, seat.playerId, index, now, boardSize);
    if (!pose || !bodyRef.current || !modelRef.current || !orbRef.current || !dieRef.current || !shieldRef.current) return;
    const acting = state.beat?.events.some((e) => (e.type === 'Moved' && e.player === seat.playerId) || (e.type === 'MatchWon' && e.winner === seat.playerId)) ?? false;
    placePiece(bodyRef.current, modelRef.current, landingPose(reducedMotion || acting ? pose : withIdle(pose, now, index * 1.7), seat.playerId, landingsRef.current, now, reducedMotion));
    modelRef.current.visible = !pose.orb;
    orbRef.current.visible = pose.orb;
    if (blobRef.current) {
      const s = Math.max(0.35, 1 - pose.position[1] * 0.25);
      blobRef.current.position.set(pose.position[0], 0.012, pose.position[2]);
      blobRef.current.scale.set(s, s, s);
    }
    // The die tumbles above the piece and settles on the rolled face; forced faces flash (spec #2 §5.1).
    const roll = rollsRef.current.get(seat.playerId);
    dieRef.current.visible = roll !== undefined;
    if (roll) {
      const spin = 1 - easeOut(clamp01((now - roll.startedAt) / roll.durationMs));
      const [rx, ry, rz] = dieRotationFor(roll.face);
      dieRef.current.position.set(pose.position[0], pose.position[1] + DIE_LIFT + spin * 0.8, pose.position[2]);
      dieRef.current.rotation.set(rx + spin * Math.PI * 6, ry + spin * Math.PI * 4, rz + spin * Math.PI * 5);
      setEmissive(dieRef.current, roll.forced ? 0.35 + 0.35 * Math.sin(now / 90) : 0);
    }
    // The shield bubble shows while a shield effect is up and flares when it blocks.
    const shielded = state.presentation?.effects.some((e) => e.owner === seat.playerId && SHIELD_HOOKS.has(e.params.hook)) ?? false;
    const blocking =
      state.beat?.events.some((e) => (e.type === 'SnakeBlocked' && e.player === seat.playerId) || (e.type === 'CardResolved' && e.target === seat.playerId && e.result === 'blocked')) ?? false;
    shieldRef.current.visible = shielded || blocking;
    shieldRef.current.position.set(pose.position[0], pose.position[1] + 0.7, pose.position[2]);
    (shieldRef.current.material as MeshBasicMaterial).opacity = blocking ? 0.45 + 0.3 * Math.sin(now / 60) : 0.22;
  });

  return (
    <>
      <group
        ref={bodyRef}
        name={`piece-${seat.playerId}`}
        // Pointing at or tapping a piece shows its name, and the tile under it doesn't also peek a path.
        onClick={(e) => {
          e.stopPropagation();
          tagPeeks?.tap(seat.playerId, Date.now());
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (tagPeeks) tagPeeks.hovered = seat.playerId;
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          if (tagPeeks?.hovered === seat.playerId) tagPeeks.hovered = null;
          document.body.style.cursor = '';
        }}
      >
        <group ref={modelRef} scale={PIECE_SCALE}>
          <Slot
            name={slot}
            seat={seat.color}
            low={low}
            clearcoat={clearcoat}
            shadows={shadows}
            fallback={
              <mesh geometry={geometry} castShadow={shadows}>
                <meshPhysicalMaterial color={seat.color} clearcoat={clearcoat ? 1 : 0} clearcoatRoughness={0.12} roughness={0.32} />
              </mesh>
            }
          />
        </group>
        <mesh ref={orbRef} visible={false}>
          <sphereGeometry args={[0.3, 16, 12]} />
          <meshBasicMaterial color={WORLD_COLORS.orb} />
        </mesh>
      </group>
      {!shadows && (
        <mesh ref={blobRef} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.55, 20]} />
          <meshBasicMaterial color={WORLD_COLORS.ink} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      <group ref={dieRef} visible={false}>
        <Slot
          name="die"
          clearcoat={clearcoat}
          shadows={shadows}
          emissive={WORLD_COLORS.crown}
          fallback={
            <mesh geometry={dieShape} castShadow={shadows}>
              <meshStandardMaterial {...(atlas ? { map: atlas } : { color: WORLD_COLORS.die })} emissive={WORLD_COLORS.crown} emissiveIntensity={0} roughness={0.4} />
            </mesh>
          }
        />
      </group>
      <mesh ref={shieldRef} visible={false}>
        <sphereGeometry args={[0.95, 24, 16]} />
        <meshBasicMaterial color={WORLD_COLORS.shield} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </>
  );
}
