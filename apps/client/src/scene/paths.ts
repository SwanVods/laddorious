import type { EventBody, Jump } from '@laddorious/core';

/** How long a tapped jump shows its path (spec #5 A13). */
export const PEEK_MS = 3000;
/** How long a path takes to grow in along its length, or shrink away. */
export const REVEAL_MS = 350;

/** Paths a player asked to see by tapping one of their ends: jump id → when it hides again. */
export interface Peeks {
  readonly until: ReadonlyMap<string, number>;
  /** Show every jump that starts or ends on this tile for PEEK_MS. */
  tap(tile: number, jumps: readonly Jump[], now: number): void;
}

export function createPeeks(): Peeks {
  const until = new Map<string, number>();
  return {
    until,
    tap(tile, jumps, now) {
      for (const j of jumps) if (j.from === tile || j.to === tile) until.set(j.id, now + PEEK_MS);
    },
  };
}

export interface PathInputs {
  jumps: readonly Jump[];
  /** Where each piece stands. */
  positions: Readonly<Record<string, number>>;
  /** The current beat's events. */
  moving: readonly EventBody[];
  peeks: Peeks;
  now: number;
}

/**
 * The jumps whose path (a pad's trail, a slide's channel) shows (spec #5 A13): paths are hidden unless
 * a piece stands on the start tile, a piece is riding the jump in this beat, or a player tapped an end.
 */
export function shownPaths({ jumps, positions, moving, peeks, now }: PathInputs): Set<string> {
  const occupied = new Set(Object.values(positions));
  const shown = new Set<string>();
  for (const j of jumps) {
    const riding = moving.some((e) => e.type === 'Moved' && (e.cause === 'ladder' || e.cause === 'snake') && e.from === j.from && e.to === j.to);
    if (occupied.has(j.from) || riding || (peeks.until.get(j.id) ?? 0) > now) shown.add(j.id);
  }
  return shown;
}
