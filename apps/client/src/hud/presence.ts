import type { PlayerId } from '@laddorious/core';
import type { SeatInfo } from '../service/matchService';

/**
 * The toast for a change in who is away (spec #4 §3.3), or null. My own drop shows as the
 * reconnecting pill instead; my return is "Back in the match".
 */
export function presenceToast(before: readonly PlayerId[], after: readonly PlayerId[], seats: readonly SeatInfo[], me: PlayerId): string | null {
  if (before.includes(me) && !after.includes(me)) return 'Back in the match';
  const names = (ids: PlayerId[]) => ids.map((id) => seats.find((s) => s.playerId === id)?.nickname ?? id).join(' and ');
  const gone = after.filter((id) => id !== me && !before.includes(id));
  if (gone.length > 0) return `${names(gone)} lost connection`;
  const back = before.filter((id) => id !== me && !after.includes(id));
  if (back.length > 0) return `${names(back)} ${back.length > 1 ? 'are' : 'is'} back`;
  return null;
}
