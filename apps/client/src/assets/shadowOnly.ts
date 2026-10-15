import type { Object3D } from 'three';

// The models' Shadow stand-ins (spec #5 §6) draw only into the shadow map (2026-10-15). three.js builds the
// main pass's draw list before it renders the shadow map, so a stand-in hidden then, and shown just for the
// shadow pass, costs no draw call on screen.

const standIns = new Set<Object3D>();

/** Track these stand-ins while their model is shown; call the result to let go of them. */
export function addStandIns(nodes: readonly Object3D[]): () => void {
  for (const node of nodes) standIns.add(node);
  return () => {
    for (const node of nodes) standIns.delete(node);
  };
}

interface ShadowRenderer {
  shadowMap: { render: (...args: never[]) => void };
}

/** Show the stand-ins only while this renderer draws its shadow map; call the result to undo. */
export function standInsInShadowsOnly(renderer: ShadowRenderer): () => void {
  const shadowMap = renderer.shadowMap;
  const original = shadowMap.render;
  shadowMap.render = function (this: unknown, ...args: never[]) {
    for (const node of standIns) node.visible = true;
    try {
      original.apply(this, args);
    } finally {
      for (const node of standIns) node.visible = false;
    }
  };
  return () => {
    shadowMap.render = original;
  };
}
