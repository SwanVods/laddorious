import { challengeAwaited } from './challenge';
import { diceAwaited } from './dice';
import { mysteryAwaited } from './mystery';
import type { Awaiting, MatchState } from './types';
import { windowDuration } from './util';

/** Who must act now, and which window the host should time (spec §3.4). */
export function awaiting(s: MatchState): Awaiting {
  const phase = s.phase;
  switch (phase.kind) {
    case 'dice':
      return { windowId: s.windowId, window: 'dice', players: diceAwaited(phase), durationMs: windowDuration(s, 'dice') };
    case 'settle':
      return { windowId: s.windowId, window: 'challenge', players: challengeAwaited(s), durationMs: windowDuration(s, 'challenge') };
    case 'mysterySelect':
      return { windowId: s.windowId, window: 'mystery', players: mysteryAwaited(phase), durationMs: windowDuration(s, 'mystery') };
    case 'finished':
      return { windowId: s.windowId, window: 'none', players: [], durationMs: 0 };
  }
}
