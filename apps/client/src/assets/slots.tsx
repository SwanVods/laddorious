import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Mesh, type Material, type MeshStandardMaterial, type Object3D } from 'three';

export type SlotName = 'piece.knight' | 'piece.pawn' | 'piece.meeple' | 'piece.dragon' | 'die' | 'pad' | 'slide.vortex' | 'crown' | 'island';

/**
 * Optional .glb overrides per slot (spec #2 §6.3); the Spec #5 art pass fills these in.
 * Contract: 1 tile = 1.6 units, origin at the feet, +Z forward, Y up, pieces under 5k
 * triangles, PBR materials, and a material named `Seat` takes the player's colour.
 */
export const SLOT_URLS: Partial<Record<SlotName, string>> = {};

/** Give every material named `Seat` the seat colour. Tinted materials are copies, so shared ones stay as they were. */
export function tintSeat(root: Object3D, color: string): void {
  const tint = (material: Material): Material => {
    if (material.name !== 'Seat' || !('color' in material)) return material;
    const copy = material.clone() as MeshStandardMaterial;
    copy.color.set(color);
    return copy;
  };
  root.traverse((node) => {
    if (node instanceof Mesh) node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
  });
}

interface BoundaryProps {
  name: SlotName;
  fallback: ReactNode;
  children: ReactNode;
}

/** A model that fails to load shows the slot's built-in default and warns once (spec #2 §6.3, §8). */
export class SlotBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn(`asset slot ${this.props.name} failed to load; using the built-in model`, error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// drei's loader comes in only when a slot has a URL: it stays out of the main bundle and out of tests.
const GltfModel = lazy(() => import('./GltfModel'));

/** An asset slot: its .glb override when one is set, its code-built default otherwise or on failure. */
export function Slot({ name, fallback, color }: { name: SlotName; fallback: ReactNode; color?: string }) {
  const url = SLOT_URLS[name];
  if (!url) return fallback;
  return (
    <SlotBoundary name={name} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel url={url} color={color} />
      </Suspense>
    </SlotBoundary>
  );
}
