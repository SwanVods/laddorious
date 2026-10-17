import type { MatchStats } from '@laddorious/host';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_KEY, devicePlayerKey, postStats } from '../src/service/stats';

// Match stats (the user, 2026-10-17): a random key on this device links a player's matches, no account needed.

const STATS = { match: { mode: 'offline' }, players: [], cards: [] } as unknown as MatchStats;

function storage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

describe("this device's player key (2026-10-17)", () => {
  it('makes a random key once and keeps it', () => {
    const store = storage();
    const key = devicePlayerKey(store);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.map.get(PLAYER_KEY)).toBe(key);
    expect(devicePlayerKey(store)).toBe(key);
    expect(devicePlayerKey(storage())).not.toBe(key);
  });

  it('replaces a damaged key, and still gives one when storage is blocked', () => {
    expect(devicePlayerKey(storage({ [PLAYER_KEY]: 'not a key!' }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(devicePlayerKey(null)).toMatch(/^[0-9a-f-]{36}$/);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(devicePlayerKey(broken)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("posting an offline match's stats (2026-10-17)", () => {
  it('posts them to the server, even as the page closes', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    await postStats(STATS, fetch);
    expect(fetch).toHaveBeenCalledWith('/api/stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(STATS), keepalive: true });
  });

  it('never fails the game when the server is away', async () => {
    await expect(postStats(STATS, vi.fn(async () => Promise.reject(new Error('offline'))))).resolves.toBeUndefined();
  });
});
