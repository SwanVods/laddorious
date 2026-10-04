import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { tintSeat } from './slots';

/** A slot's .glb model with its `Seat` materials tinted (spec #2 §6.3). Slot loads this module only when it has a URL. */
export default function GltfModel({ url, color }: { url: string; color?: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    if (color) tintSeat(copy, color);
    return copy;
  }, [scene, color]);
  return <primitive object={model} />;
}
