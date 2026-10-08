import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { keepInside, tagAnchor, type TagRegistry } from './tags';

/**
 * Moves each registered name tag to its piece's place on screen, once per frame (spec #2 §7.2),
 * and nudges a tag's card bubble back inside the screen when it would run off an edge (polish spec §4.4).
 */
export function TagProjector({ director, seats, boardSize, tags }: { director: Director; seats: SeatInfo[]; boardSize: number; tags: TagRegistry }) {
  const point = useMemo(() => new Vector3(), []);
  const shifts = useMemo(() => new WeakMap<HTMLElement, { dx: number; dy: number }>(), []);
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
      const bubble = el.querySelector<HTMLElement>('.bubble');
      if (!bubble || !el.parentElement) return;
      const area = el.parentElement.getBoundingClientRect();
      const was = shifts.get(bubble) ?? { dx: 0, dy: 0 };
      const r = bubble.getBoundingClientRect();
      const left = r.left - area.left - was.dx;
      const top = r.top - area.top - was.dy;
      const shift = keepInside({ left, top, right: left + r.width, bottom: top + r.height }, area, { side: 8, top: Math.max(56, area.height * 0.13) });
      if (shift.dx !== was.dx || shift.dy !== was.dy) {
        bubble.style.translate = `${shift.dx.toFixed(1)}px ${shift.dy.toFixed(1)}px`;
        shifts.set(bubble, shift);
      }
    });
  });
  return null;
}
