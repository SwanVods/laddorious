import { diceAwaited } from './dice';
import type { Awaiting, MatchState } from './types';
import { windowDuration } from './util';

/** Who must act now, and which window the host should time (spec §3.4). */
export function awaiting(s: MatchState): Awaiting {
  const phase = s.phase;
  switch (phase.kind) {
    case 'dice':
      return { windowId: s.windowId, window: phase.window, players: diceAwaited(phase), durationMs: windowDuration(s, phase.window) };
    default:
      // Challenge and Mystery windows are added in Tasks 10 and 11.
      return { windowId: s.windowId, window: 'none', players: [], durationMs: 0 };
  }
}
