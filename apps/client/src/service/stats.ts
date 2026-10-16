import type { MatchStats } from '@laddorious/host';
import type { KeyValueStore } from '../app/prefs';

// Match stats (the user, 2026-10-17): a random key kept on this device links a player's matches without an
// account. Offline matches post their summary to the server; online ones are stored by the server itself.

/** Where the key lives. */
export const PLAYER_KEY = 'laddorious.playerKey';
const KEY_SHAPE = /^[0-9a-f-]{36}$/;

/** This device's player key: made once at random and kept; a fresh one each visit if storage is blocked. */
export function devicePlayerKey(storage: Pick<KeyValueStore, 'getItem' | 'setItem'> | null): string {
  try {
    const saved = storage?.getItem(PLAYER_KEY);
    if (saved && KEY_SHAPE.test(saved)) return saved;
  } catch {
    // Blocked storage: a key for this visit only.
  }
  const key = crypto.randomUUID();
  try {
    storage?.setItem(PLAYER_KEY, key);
  } catch {
    // As above.
  }
  return key;
}

/** What an offline match needs to report its stats: this device's key, the game's version, and where to send them. */
export interface OfflineStats {
  playerKey: string;
  version: string;
  report(stats: MatchStats): void;
}

/** Posts an offline match's stats. Best effort: it outlives a closing page, and never fails the game. */
export async function postStats(stats: MatchStats, send: typeof fetch = fetch): Promise<void> {
  try {
    await send('/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(stats), keepalive: true });
  } catch {
    // The server is away: these stats are lost, and that's fine.
  }
}
