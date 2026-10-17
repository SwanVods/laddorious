import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MatchStats } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { MAX_STATS_BYTES, handleStats, parseOfflineStats, statsStatements, type StatsEnv } from '../src/stats';

// Match stats in D1 (the user, 2026-10-17): every match, real players only; offline matches post theirs.

const STATS: MatchStats = {
  match: { mode: 'room', status: 'finished', version: '0.2.0', seed: 'board-1', rounds: 9, durationMs: 300_000, humans: 1, bots: 3, humanWon: true },
  players: [{ playerKey: 'key-ari', nickname: 'Ari', piece: 'duck', place: 1, tile: 100, rockets: 2, whirlpools: 1, dodged: 0, faceOffsWon: 1, faceOffsLost: 0, cardsPicked: 1, leftEarly: false }],
  cards: [
    { playerKey: 'key-ari', cardId: 'sprint', rarity: 'common', round: 2, picked: true, auto: false, result: 'hit', pickerWon: true },
    { playerKey: 'key-ari', cardId: 'shove', rarity: 'common', round: 2, picked: false, auto: false, result: null, pickerWon: false },
  ],
};

/** A D1 stand-in: records batches, and answers queries with canned rows in order. */
function fakeDb(answers: unknown[][] = []) {
  const batches: { sql: string; args: unknown[] }[][] = [];
  const queries: string[] = [];
  const db = {
    prepare(sql: string) {
      const stmt = {
        sql,
        args: [] as unknown[],
        bind(...args: unknown[]) {
          return { ...stmt, args };
        },
        async all() {
          queries.push(sql);
          return { results: answers.shift() ?? [] };
        },
      };
      return stmt;
    },
    async batch(stmts: { sql: string; args: unknown[] }[]) {
      batches.push(stmts.map((s) => ({ sql: s.sql, args: s.args })));
      return [];
    },
  };
  return { db, batches, queries };
}

function env(db?: ReturnType<typeof fakeDb>['db'], key?: string): StatsEnv {
  return { ...(db ? { STATS: db as unknown as NonNullable<StatsEnv['STATS']> } : {}), ...(key ? { STATS_KEY: key } : {}) };
}

/** Runs a request through the stats routes, waiting for any background write. */
async function call(request: Request, e: StatsEnv) {
  const waits: Promise<unknown>[] = [];
  const response = await handleStats(request, e, (p) => waits.push(p));
  await Promise.all(waits);
  return response;
}

const post = (body: unknown, raw?: string) => new Request('https://game.test/api/stats', { method: 'POST', body: raw ?? JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('match stats rows (2026-10-17)', () => {
  it('writes one match row, one row per real player and one per card shown', () => {
    const rows = statsStatements(STATS, { id: 'm1', createdAt: 1000 });
    expect(rows.map((r) => r.sql.match(/INSERT INTO (\w+)/)![1])).toEqual(['matches', 'match_players', 'card_offers', 'card_offers']);
    expect(rows[0]!.args).toEqual(['m1', 1000, 'room', 'finished', '0.2.0', 'board-1', 9, 300_000, 1, 3, 1]);
    expect(rows[1]!.args).toEqual(['m1', 'key-ari', 'Ari', 'duck', 1, 100, 2, 1, 0, 1, 0, 1, 0]);
    expect(rows[2]!.args).toEqual(['m1', 'key-ari', 'sprint', 'common', 2, 1, 0, 'hit', 1]);
    expect(rows[3]!.args).toEqual(['m1', 'key-ari', 'shove', 'common', 2, 0, 0, null, 0]);
  });

  it("matches the database's tables, column for column", () => {
    // Windows checkouts may turn the file's line endings to CRLF.
    const schema = readFileSync(resolve(__dirname, '../migrations/0001_match_stats.sql'), 'utf8').replace(/\r\n/g, '\n');
    const columns = (table: string) => {
      const body = schema.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\);`))![1]!;
      return body.split(',\n').map((line) => line.trim().split(/\s+/)[0]);
    };
    for (const row of statsStatements(STATS, { id: 'm1', createdAt: 1 })) {
      const [, table, list] = row.sql.match(/INSERT INTO (\w+) \(([^)]*)\)/)!;
      expect(list!.split(',').map((c) => c.trim()), table).toEqual(columns(table!));
      expect(row.args, table).toHaveLength(list!.split(',').length);
    }
  });
});

describe("an offline match's posted stats (2026-10-17)", () => {
  it('takes a well-formed summary, always as an offline match', () => {
    expect(parseOfflineStats(STATS)).toEqual({ ...STATS, match: { ...STATS.match, mode: 'offline' } });
  });

  it('refuses anything malformed or too big', () => {
    const bad = [
      null,
      { ...STATS, players: [] },
      { ...STATS, players: Array(5).fill(STATS.players[0]) },
      { ...STATS, cards: Array(401).fill(STATS.cards[0]) },
      { ...STATS, match: { ...STATS.match, status: 'won' } },
      { ...STATS, match: { ...STATS.match, rounds: -1 } },
      { ...STATS, players: [{ ...STATS.players[0], nickname: 'x'.repeat(40) }] },
      { ...STATS, players: [{ ...STATS.players[0], piece: 'queen' }] },
      { ...STATS, cards: [{ ...STATS.cards[0], result: 'great' }] },
      { ...STATS, cards: [{ ...STATS.cards[0], cardId: 'x'.repeat(80) }] },
    ];
    for (const b of bad) expect(parseOfflineStats(b), JSON.stringify(b)?.slice(0, 80)).toBeNull();
  });
});

describe('the stats routes (2026-10-17)', () => {
  it('stores a posted offline match', async () => {
    const { db, batches } = fakeDb();
    const res = await call(post(STATS), env(db));
    expect(res?.status).toBe(204);
    expect(batches).toHaveLength(1);
    expect(batches[0]![0]!.args[2]).toBe('offline');
    expect(batches[0]).toHaveLength(4);
  });

  it('turns away a malformed or oversized post, and stores nothing', async () => {
    const { db, batches } = fakeDb();
    expect((await call(post({ nope: 1 }), env(db)))?.status).toBe(400);
    expect((await call(post(null, 'x'.repeat(MAX_STATS_BYTES + 1)), env(db)))?.status).toBe(413);
    expect(batches).toEqual([]);
  });

  it("accepts a post quietly when there's no database yet", async () => {
    expect((await call(post(STATS), env()))?.status).toBe(204);
  });

  it('leaves other paths to the game', async () => {
    expect(await call(new Request('https://game.test/lobby'), env())).toBeNull();
  });

  it('shows the summary only with the stats key', async () => {
    const { db } = fakeDb();
    const get = (key?: string) => new Request('https://game.test/api/stats/summary?mode=all', { headers: key ? { authorization: `Bearer ${key}` } : {} });
    expect((await call(get(), env(db, 'sekret')))?.status).toBe(401);
    expect((await call(get('wrong'), env(db, 'sekret')))?.status).toBe(401);
    // No key set on the server: nobody can read it.
    expect((await call(get('sekret'), env(db)))?.status).toBe(401);
  });

  it('sums up matches, players and cards, filtered by where they were played', async () => {
    const matches = [{ mode: 'offline', status: 'finished', matches: 3, avgRounds: 11, avgDurationMs: 320_000, humanWins: 2 }];
    const players = [{ players: 2, leftEarly: 1 }];
    const cards = [{ cardId: 'sprint', rarity: 'common', offered: 6, picked: 3, auto: 1, hit: 3, blocked: 0, fizzled: 0, wins: 2 }];
    const { db, queries } = fakeDb([matches, players, cards]);
    const res = await call(new Request('https://game.test/api/stats/summary?mode=offline', { headers: { authorization: 'Bearer sekret' } }), env(db, 'sekret'));
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({ mode: 'offline', matches, players: players[0], cards });
    expect(queries.every((q) => q.includes("m.mode = 'offline'"))).toBe(true);
    // An unknown filter is all matches.
    const all = fakeDb([[], [{ players: 0, leftEarly: 0 }], []]);
    await call(new Request('https://game.test/api/stats/summary?mode=bogus', { headers: { authorization: 'Bearer sekret' } }), env(all.db, 'sekret'));
    expect(all.queries.some((q) => q.includes("m.mode = 'offline'") || q.includes("m.mode != 'offline'"))).toBe(false);
  });

  it('lets the local card editor read the summary from another origin, and no website', async () => {
    const pre = (origin: string) => new Request('https://game.test/api/stats/summary', { method: 'OPTIONS', headers: { origin } });
    const local = await call(pre('http://localhost:5173'), env());
    expect(local?.status).toBe(204);
    expect(local?.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(local?.headers.get('access-control-allow-headers')).toMatch(/authorization/i);
    const other = await call(pre('https://evil.example'), env());
    expect(other?.headers.get('access-control-allow-origin')).toBeNull();
  });
});
