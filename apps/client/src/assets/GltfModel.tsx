import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import type { Object3D } from 'three';
import { addStandIns } from './shadowOnly';
import { prepareModel, type ModelOptions } from './slots';

/** A slot's .glb model, readied for the game (spec #5 §6). Slot loads this module only when it has a URL. */
export default function GltfModel({ url, seat, clearcoat, emissive, shadows }: { url: string } & ModelOptions) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    prepareModel(copy, { seat, clearcoat, emissive, shadows });
    return copy;
  }, [scene, seat, clearcoat, emissive, shadows]);
  useEffect(() => {
    const standIns: Object3D[] = [];
    model.traverse((node) => {
      if (node.userData.standIn) standIns.push(node);
    });
    return addStandIns(standIns);
  }, [model]);
  return <primitive object={model} />;
}

/** Start loading these model files now. */
export function preload(urls: string[]): void {
  for (const url of urls) useGLTF.preload(url);
}
