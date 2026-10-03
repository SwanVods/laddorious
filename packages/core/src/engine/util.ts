import type { MoveCause } from '../cards/types';
import { InvariantError } from './errors';
import type { EventBody, GameEvent, MatchState, PlayerId, PlayerState, WindowKind } from './types';

/** Deep copy of plain JSON data (the whole match state is plain JSON). Faster than structuredClone here. */
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function pub(body: EventBody): GameEvent {
  return { ...body, visibility: 'public' };
}

export function priv(player: PlayerId, body: EventBody): GameEvent {
  return { ...body, visibility: { private: player } };
}

export function getPlayer(s: MatchState, id: PlayerId): PlayerState {
  const p = s.players.find((pl) => pl.id === id);
  if (!p) throw new InvariantError(`unknown player ${id}`);
  return p;
}

export function nextId(s: MatchState, prefix: string): string {
  s.counter += 1;
  return `${prefix}${s.counter}`;
}

/** Bounce off the final tile and floor at 0 (spec §4.4). */
export function bounce(target: number, size: number): number {
  let to = target;
  if (to > size) to = size - (to - size);
  return Math.max(0, to);
}

/**
 * Set a player's position and emit Moved. A move that bounces back onto the
 * same tile still counts as landing there, so it is reported too.
 */
export function movePlayer(
  s: MatchState,
  ev: GameEvent[],
  id: PlayerId,
  to: number,
  cause: MoveCause,
  bounced = false,
): void {
  const p = getPlayer(s, id);
  if (!Number.isInteger(to) || to < 0 || to > s.board.size) throw new InvariantError(`bad destination ${to}`);
  if (p.position === to && !bounced) return;
  ev.push(pub({ type: 'Moved', player: id, from: p.position, to, cause, bounced }));
  p.position = to;
  if (!s.movedThisRound.includes(id)) s.movedThisRound.push(id);
}

export function windowDuration(s: MatchState, window: WindowKind): number {
  switch (window) {
    case 'dice':
      return s.config.windows.diceMs;
    case 'bonusGrace':
      return s.config.windows.bonusGraceMs;
    case 'challenge':
      return s.config.windows.challengeMs;
    case 'mystery':
      return s.config.windows.mysteryMs;
    case 'none':
      return 0;
  }
}

export function openWindow(s: MatchState, ev: GameEvent[], window: WindowKind, players: PlayerId[]): void {
  s.windowId += 1;
  ev.push(pub({ type: 'WindowOpened', windowId: s.windowId, window, players, durationMs: windowDuration(s, window) }));
}

/** Tiles in 1..N occupied by two or more players, ascending. */
export function sharedTiles(s: MatchState): number[] {
  const counts = new Map<number, number>();
  for (const p of s.players) if (p.position >= 1) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  return [...counts.entries()].filter(([, c]) => c >= 2).map(([t]) => t).sort((a, b) => a - b);
}

export function seatOrder(s: MatchState, ids: Iterable<PlayerId>): PlayerId[] {
  const set = new Set(ids);
  return s.players.filter((p) => set.has(p.id)).map((p) => p.id);
}
