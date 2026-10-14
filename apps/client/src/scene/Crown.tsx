import type { PlayerId } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, DoubleSide, MeshBasicMaterial, Object3D, OctahedronGeometry, type Group, type InstancedMesh } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { crownGeometry } from '../assets/models';
import { Slot } from '../assets/slots';
import type { Director } from '../director/director';
import type { Vec3 } from './layout';
import { crownPose, crownWinner } from './motion';

/** Each seat's piece as the scene draws it: the body the poses move, and the model inside it (to measure). */
export type PieceRegistry = Map<PlayerId, { body: Object3D; model: Object3D }>;

/** Gold sparkles in the crown's landing burst. */
const SPARKLES = 14;
/** How far the crown sinks onto the head, so it sits on it rather than floats over it. */
const SEAT = 0.08;

interface CrownProps {
  director: Director;
  pieces: PieceRegistry;
  shadows: boolean;
  clearcoat: boolean;
  low: boolean;
  reducedMotion: boolean;
}

/**
 * The crown (spec #2 §6.1, round 5): it spins on tile 100 until someone wins, then flies onto the winner's
 * head with a bounce and a burst of gold sparkles, and stays there through the ranks and the end screen.
 */
export function Crown({ director, pieces, shadows, clearcoat, low, reducedMotion }: CrownProps) {
  const crown = useMemo(() => crownGeometry(), []);
  const sparkle = useMemo(() => new OctahedronGeometry(0.07, 0), []);
  const sparkleMaterial = useMemo(() => new MeshBasicMaterial({ color: WORLD_COLORS.crown }), []);
  useEffect(
    () => () => {
      crown.dispose();
      sparkle.dispose();
      sparkleMaterial.dispose();
    },
    [crown, sparkle, sparkleMaterial],
  );
  const crownRef = useRef<Group>(null);
  const sparklesRef = useRef<InstancedMesh>(null);
  // Each winner's head height above its feet, measured from its model the first time it wins.
  const headsRef = useRef(new Map<PlayerId, number>());
  const box = useMemo(() => new Box3(), []);
  const place = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const state = director.store.getState();
    const now = Date.now();
    const winner = crownWinner(state);
    const piece = winner ? pieces.get(winner) : undefined;
    let head: Vec3 | null = null;
    if (winner && piece) {
      let height = headsRef.current.get(winner);
      if (height === undefined && !box.setFromObject(piece.model).isEmpty()) {
        height = box.max.y - piece.body.position.y;
        headsRef.current.set(winner, height);
      }
      const { x, y, z } = piece.body.position;
      if (height !== undefined) head = [x, y + height - SEAT, z];
    }
    const pose = crownPose(state, head, now, reducedMotion);
    crownRef.current?.position.set(...pose.position);
    crownRef.current?.rotation.set(0, pose.turn, 0);
    // The burst: a ring of sparkles flying out from the head, rising and shrinking away.
    const sparkles = sparklesRef.current;
    if (!sparkles) return;
    const k = pose.sparkle;
    sparkles.count = k === null ? 0 : SPARKLES;
    sparkles.visible = k !== null;
    if (k === null) return;
    const [x, y, z] = pose.position;
    for (let i = 0; i < SPARKLES; i++) {
      const angle = (i / SPARKLES) * Math.PI * 2;
      const reach = 0.3 + 1.3 * k;
      place.position.set(x + Math.cos(angle) * reach, y + 0.25 + 0.7 * k - 0.6 * k * k, z + Math.sin(angle) * reach);
      place.rotation.set(0, angle + k * 6, 0);
      place.scale.setScalar(1.4 * (1 - k));
      place.updateMatrix();
      sparkles.setMatrixAt(i, place.matrix);
    }
    sparkles.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={crownRef} name="crown-holder">
        <Slot
          name="crown"
          low={low}
          clearcoat={clearcoat}
          shadows={shadows}
          fallback={
            <mesh geometry={crown} castShadow={shadows}>
              <meshStandardMaterial color={WORLD_COLORS.crown} metalness={0.55} roughness={0.28} side={DoubleSide} />
            </mesh>
          }
        />
      </group>
      <instancedMesh ref={sparklesRef} name="crown-sparkles" args={[sparkle, sparkleMaterial, SPARKLES]} visible={false} />
    </>
  );
}
