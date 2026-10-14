import type { PlayerId } from '@laddorious/core';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { crownWinner } from './motion';
import { tagAnchor, tagVisible, type TagPeeks, type TagRegistry } from './tags';

interface TagProjectorProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  boardSize: number;
  tags: TagRegistry;
  peeks: TagPeeks;
}

/**
 * Moves each registered name tag to its piece's place on screen, once per frame (spec #2 §7.2). Only my
 * own tag shows unless a player points at or taps another piece, or the match is won (round 5).
 */
export function TagProjector({ director, seats, me, boardSize, tags, peeks }: TagProjectorProps) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const state = director.store.getState();
    const now = Date.now();
    const won = crownWinner(state) !== null;
    seats.forEach((seat, index) => {
      const el = tags.elements.get(seat.playerId);
      if (!el) return;
      const at = tagAnchor(state, seat.playerId, index, now, boardSize);
      if (at) point.set(...at).project(camera);
      if (!at || point.z > 1) {
        el.style.visibility = 'hidden';
        return;
      }
      // A hidden tag still follows its piece, so a tap shows it in the right place at once.
      el.style.visibility = tagVisible(seat.playerId, me, peeks, now, won) ? 'visible' : 'hidden';
      el.style.transform = `translate(${(((point.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - point.y) / 2) * size.height).toFixed(1)}px)`;
    });
  });
  return null;
}
