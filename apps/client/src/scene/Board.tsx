import type { PlayerView } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three';
import { BOARD_COLORS, WORLD_COLORS } from '../app/theme';
import { tileGeometry } from '../assets/models';
import { useSlotMesh } from '../assets/slotMesh';
import type { Director } from '../director/director';
import { COLUMNS, TILE_SIZE, TILE_THICKNESS, squareColorIndex, tileToWorld } from './layout';
import { boardOverlayTexture } from './textures';

type PublicBoard = PlayerView['board'];

const MAX_RINGS = 4;

export function tileColor(tile: number, board: Pick<PublicBoard, 'size' | 'mystery'>): string {
  if (tile === board.size) return BOARD_COLORS.goal;
  if (board.mystery[tile]) return BOARD_COLORS.mystery;
  return BOARD_COLORS.squares[squareColorIndex(tile, BOARD_COLORS.squares.length)]!;
}

/** The tiles as one instanced draw call, one overlay for every number and glyph, and rings on landed "?" squares (spec #2 §6.1). */
export function Board({ board, director, clearcoat }: { board: PublicBoard; director: Director; clearcoat: boolean }) {
  const tilesRef = useRef<InstancedMesh>(null);
  const ringsRef = useRef<InstancedMesh>(null);
  const place = useMemo(() => new Object3D(), []);
  const tile = useSlotMesh('tile', () => ({ geometry: tileGeometry(), material: new MeshStandardMaterial({ roughness: 0.45 }) }), { clearcoat });
  // Every update brings a fresh copy of the board, so key the work on its content: size and Mystery layout
  // (card edits only change jumps). Otherwise the 1024 px overlay is repainted, and leaked, on every update.
  const size = board.size;
  const mysteryKey = JSON.stringify(board.mystery);
  const mystery = useMemo(() => JSON.parse(mysteryKey) as PublicBoard['mystery'], [mysteryKey]);
  const overlay = useMemo(() => boardOverlayTexture(size, mystery, BOARD_COLORS.rarity, WORLD_COLORS.ink), [size, mystery]);
  // three.js frees a texture's GPU memory only on dispose().
  useEffect(() => () => overlay?.dispose(), [overlay]);

  // Placed and painted again when the model replaces the stand-in: that's a new instanced mesh.
  useLayoutEffect(() => {
    const mesh = tilesRef.current;
    if (!mesh) return;
    const at = new Object3D();
    const color = new Color();
    for (let tile = 1; tile <= size; tile++) {
      const [x, , z] = tileToWorld(tile);
      at.position.set(x, -TILE_THICKNESS, z);
      at.updateMatrix();
      mesh.setMatrixAt(tile - 1, at.matrix);
      mesh.setColorAt(tile - 1, color.set(tileColor(tile, { size, mystery })));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [size, mystery, tile]);

  // A ring pulses on each "?" square with a piece on it, from the landing until the Mystery phase ends.
  useFrame(({ clock }) => {
    const mesh = ringsRef.current;
    if (!mesh) return;
    const { presentation, settled } = director.store.getState();
    const phase = settled?.view.phase.kind;
    const live =
      presentation && (phase === 'settle' || phase === 'mysterySelect')
        ? [...new Set(Object.values(presentation.positions))].filter((tile) => mystery[tile])
        : [];
    const pulse = 1 + 0.08 * Math.sin(clock.elapsedTime * 6);
    for (let i = 0; i < MAX_RINGS; i++) {
      const tile = live[i];
      if (tile === undefined) {
        place.scale.setScalar(0);
      } else {
        const [x, , z] = tileToWorld(tile);
        place.position.set(x, 0.014, z);
        place.rotation.set(-Math.PI / 2, 0, 0);
        place.scale.setScalar(pulse);
      }
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={tilesRef} name="tiles" args={[tile.geometry, tile.material, board.size]} receiveShadow />
      {overlay && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
          <planeGeometry args={[TILE_SIZE * COLUMNS, TILE_SIZE * COLUMNS]} />
          <meshBasicMaterial map={overlay} transparent depthWrite={false} />
        </mesh>
      )}
      <instancedMesh ref={ringsRef} args={[undefined, undefined, MAX_RINGS]}>
        <ringGeometry args={[0.6, 0.74, 32]} />
        <meshBasicMaterial color={WORLD_COLORS.ring} transparent opacity={0.9} />
      </instancedMesh>
    </group>
  );
}
