import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { tagAnchor, type TagRegistry } from './tags';

/** Moves each registered name tag to its piece's place on screen, once per frame (spec #2 §7.2). */
export function TagProjector({ director, seats, boardSize, tags }: { director: Director; seats: SeatInfo[]; boardSize: number; tags: TagRegistry }) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const state = director.store.getState();
    const now = Date.now();
    seats.forEach((seat, index) => {
      const el = tags.elements.get(seat.playerId);
      if (!el) return;
      const at = tagAnchor(state, seat.playerId, index, now, boardSize);
      if (at) point.set(...at).project(camera);
      if (!at || point.z > 1) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      el.style.transform = `translate(${(((point.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - point.y) / 2) * size.height).toFixed(1)}px)`;
    });
  });
  return null;
}
