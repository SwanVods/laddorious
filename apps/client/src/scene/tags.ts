import type { PlayerId } from '@laddorious/core';
import type { DirectorState } from '../director/director';
import { stackOn } from '../director/presentation';
import type { Vec3 } from './layout';
import { STACK_HEIGHT, poseAt, rowOn, standsInRow } from './motion';

// In-world name tags (spec #2 §7.2): DOM elements over the canvas, moved every frame to
// their piece's place on screen, without re-rendering React.

/** How far above a piece's feet its tag hangs: pieces stand about 1.3 units tall. */
export const TAG_HEIGHT = 1.6;
/** How far beside a stack a piece underneath shows its tag. */
export const TAG_SIDE = 1.1;
/** On the start row, and in the row before a rocket or a flag, the pieces stand close together: every other tag hangs this much higher. */
export const START_STAGGER = 0.55;

/** How long another player's tag shows after their piece is tapped (round 5). */
export const TAG_PEEK_MS = 3000;

/** Which other players' tags a player asked to see: the piece under the mouse, and when each piece was last tapped. */
export interface TagPeeks {
  hovered: PlayerId | null;
  tappedAt: Map<PlayerId, number>;
  tap(player: PlayerId, nowMs: number): void;
}

export function createTagPeeks(): TagPeeks {
  const tappedAt = new Map<PlayerId, number>();
  return { hovered: null, tappedAt, tap: (player, nowMs) => void tappedAt.set(player, nowMs) };
}

/**
 * Whether a tag shows (round 5): my own always; another player's while the mouse is over their piece, or for a
 * while after a tap. Once the match is `won` every tag shows, since the ranks reveal hangs its badges on them.
 */
export function tagVisible(player: PlayerId, me: PlayerId, peeks: TagPeeks, nowMs: number, won = false): boolean {
  const tapped = peeks.tappedAt.get(player);
  return won || player === me || peeks.hovered === player || (tapped !== undefined && nowMs - tapped < TAG_PEEK_MS);
}

/** The tags' DOM elements by player: the HUD registers them, the scene moves them. */
export interface TagRegistry {
  elements: Map<PlayerId, HTMLElement>;
}

export function createTagRegistry(): TagRegistry {
  return { elements: new Map() };
}

/**
 * Where a piece's tag hangs in the world: above the piece, or beside the stack for a piece
 * standing under another one (face-off opponents stand apart, so theirs stay above).
 */
export function tagAnchor(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Vec3 | null {
  const shown = state.presentation;
  const pose = poseAt(state, player, seat, nowMs, boardSize);
  if (!shown || !pose) return null;
  const [x, y, z] = pose.position;
  const moving = state.beat?.events.some((e) => e.type === 'Moved' && e.player === player) ?? false;
  const tile = shown.positions[player] ?? 0;
  // In the row before a rocket or a flag the pieces stand close together: every other tag hangs higher.
  if (!moving && tile > 0 && standsInRow(shown, tile)) return [x, y + TAG_HEIGHT + (rowOn(shown, tile).indexOf(player) % 2 === 1 ? START_STAGGER : 0), z];
  if (!moving && tile > 0 && !shown.faceOffs.some((f) => f.tile === tile && f.players.includes(player))) {
    const stack = stackOn(shown, tile);
    const level = stack.indexOf(player);
    if (level >= 0 && level < stack.length - 1) return [x + (level % 2 === 0 ? -TAG_SIDE : TAG_SIDE), y + STACK_HEIGHT * 0.55, z];
  }
  const stagger = tile === 0 && !moving && seat % 2 === 1 ? START_STAGGER : 0;
  return [x, y + TAG_HEIGHT + stagger, z];
}
