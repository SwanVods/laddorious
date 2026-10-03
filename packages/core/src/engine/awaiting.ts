import { challengeAwaited } from './challenge';
import { diceAwaited } from './dice';
import type { Awaiting, MatchState } from './types';
import { windowDuration } from './util';

/** Who must act now, and which window the host should time (spec §3.4). */
export function awaiting(s: MatchState): Awaiting {
  const phase = s.phase;
  switch (phase.kind) {
    case 'dice':
      return { windowId: s.windowId, window: phase.window, players: diceAwaited(phase), durationMs: windowDuration(s, phase.window) };
    case 'settle':
      return { windowId: s.windowId, window: 'challenge', players: challengeAwaited(s), durationMs: windowDuration(s, 'challenge') };
    default:
      // The Mystery window is added in Task 11.
      return { windowId: s.windowId, window: 'none', players: [], durationMs: 0 };
  }
}
