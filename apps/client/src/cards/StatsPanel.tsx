import type { CardCatalog } from '@laddorious/core';
import { useState } from 'react';

// Player stats (the user, 2026-10-17): totals from real players' matches, online and offline, read from the
// game server's /api/stats/summary with the stats key (`wrangler secret put STATS_KEY`). Bots never count.

export interface StatsSummary {
  mode: string;
  matches: { mode: string; status: string; matches: number; avgRounds: number; avgDurationMs: number; humanWins: number | null }[];
  players: { players: number; leftEarly: number | null };
  cards: { cardId: string; rarity: string; offered: number; picked: number; auto: number; hit: number; blocked: number; fizzled: number; wins: number }[];
}

type Filter = 'all' | 'online' | 'offline';
export type LoadSummary = (url: string, key: string, mode: Filter) => Promise<StatsSummary>;

/** Reads the summary from the game server. */
export async function fetchSummary(url: string, key: string, mode: Filter, send: typeof fetch = fetch): Promise<StatsSummary> {
  const res = await send(`${url.replace(/\/+$/, '')}/api/stats/summary?mode=${mode}`, { headers: { authorization: `Bearer ${key}` } });
  if (res.status === 401) throw new Error('Wrong stats key');
  if (!res.ok) throw new Error(`The server answered ${res.status}`);
  return (await res.json()) as StatsSummary;
}

/** The address and key, kept in this browser so they're typed once. */
const SAVED = { url: 'laddorious.cards.statsUrl', key: 'laddorious.cards.statsKey' } as const;
const saved = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const keep = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Blocked storage: type them again next time.
  }
};

const MODES: Record<string, string> = { offline: 'Offline', quick: 'Quick match', room: 'Private room' };
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');
const one = (x: number) => String(Number(x.toFixed(1)));

export function StatsPanel({ catalog, load = fetchSummary }: { catalog: CardCatalog; load?: LoadSummary }) {
  const [url, setUrl] = useState(() => saved(SAVED.url));
  const [key, setKey] = useState(() => saved(SAVED.key));
  const [mode, setMode] = useState<Filter>('all');
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => catalog.cards.find((c) => c.id === id)?.name ?? id;
  const start = async () => {
    keep(SAVED.url, url);
    keep(SAVED.key, key);
    setBusy(true);
    setError(null);
    try {
      setSummary(await load(url, key, mode));
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const total = summary?.matches.reduce((n, m) => n + m.matches, 0) ?? 0;
  return (
    <section className="simulate player-stats" aria-label="Player stats">
      <h2>Player stats</h2>
      <p>Real players&apos; matches, online and offline, never the bots. Offline matches report themselves, so they could be faked.</p>
      <div className="stats-form">
        <label>
          Game address
          <input type="text" value={url} placeholder="https://your-game.workers.dev" onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Stats key
          <input type="password" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
        </label>
        <label>
          Matches
          <select value={mode} onChange={(e) => setMode(e.target.value as Filter)}>
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        <button type="button" onClick={start} disabled={busy || !url || !key}>
          Load player stats
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <>
          <p className="stats-total">{`${total} matches · ${summary.players.players} players`}</p>
          <ul className="stats-matches">
            {summary.matches.map((m) => (
              <li key={`${m.mode}-${m.status}`}>{`${MODES[m.mode] ?? m.mode} ${m.status}: ${m.matches} matches, ${one(m.avgRounds)} rounds, ${one(m.avgDurationMs / 60_000)} min, real players won ${m.humanWins ?? 0}`}</li>
            ))}
          </ul>
          <div className="simulate-table">
            <table>
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Rarity</th>
                  <th>Shown</th>
                  <th>Picked</th>
                  <th>Pick rate</th>
                  <th>Hit · blocked · fizzled</th>
                  <th>Picked on timeout</th>
                  <th>Win rate when picked</th>
                </tr>
              </thead>
              <tbody>
                {summary.cards.map((c) => (
                  <tr key={`${c.cardId}-${c.rarity}`}>
                    <td>{name(c.cardId)}</td>
                    <td>{c.rarity}</td>
                    <td>{c.offered}</td>
                    <td>{c.picked}</td>
                    <td>{pct(c.picked, c.offered)}</td>
                    <td>{`${c.hit} · ${c.blocked} · ${c.fizzled}`}</td>
                    <td>{c.auto}</td>
                    <td>{pct(c.wins, c.picked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
