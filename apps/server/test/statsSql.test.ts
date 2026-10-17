import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { MatchStats } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { handleStats, writeStats, type StatsDb, type StatsStatement } from '../src/stats';

// The stats SQL against a real SQLite database (D1 is SQLite): the migration, the writes and the summary.

/** D1's calls over Node's own SQLite. */
function sqliteDb(): StatsDb {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(resolve(__dirname, '../migrations/0001_match_stats.sql'), 'utf8'));
  const statement = (sql: string, args: unknown[] = []): StatsStatement & { run(): void } => ({
    bind: (...next: unknown[]) => statement(sql, next),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: () => void db.prepare(sql).run(...(args as never[])),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (stmts) => {
      db.exec('BEGIN');
      for (const s of stmts) (s as ReturnType<typeof statement>).run();
      db.exec('COMMIT');
    },
  };
}

const match = (mode: MatchStats['match']['mode'], won: boolean, picks: Array<[string, boolean, 'hit' | 'blocked' | 'fizzled' | null]>): MatchStats => ({
  match: { mode, status: 'finished', version: '0.2.0', seed: 's', rounds: 10, durationMs: 600_000, humans: 1, bots: 3, humanWon: won },
  players: [{ playerKey: `key-${mode}`, nickname: 'Ari', piece: 'duck', place: won ? 1 : 3, tile: 50, rockets: 1, whirlpools: 2, dodged: 0, faceOffsWon: 0, faceOffsLost: 1, cardsPicked: picks.filter((p) => p[1]).length, leftEarly: false }],
  cards: picks.map(([cardId, picked, result]) => ({ playerKey: `key-${mode}`, cardId, rarity: 'common', round: 2, picked, auto: false, result, pickerWon: picked && won })),
});

describe('the stats SQL on SQLite (2026-10-17)', () => {
  it('stores matches and sums them up, per card and by where they were played', async () => {
    const db = sqliteDb();
    await writeStats(db, match('offline', true, [['sprint', true, 'hit'], ['shove', false, null]]));
    await writeStats(db, match('quick', false, [['sprint', true, 'fizzled'], ['shove', false, null], ['moonwalk', false, null]]));
    const summary = async (mode: string) => {
      const res = await handleStats(new Request(`https://game.test/api/stats/summary?mode=${mode}`, { headers: { authorization: 'Bearer k' } }), { STATS: db, STATS_KEY: 'k' }, () => {});
      return res!.json() as Promise<{ matches: unknown[]; players: unknown; cards: Array<Record<string, unknown>> }>;
    };
    const all = await summary('all');
    expect(all.matches).toHaveLength(2);
    expect(all.players).toEqual({ players: 2, leftEarly: 0 });
    expect(all.cards.find((c) => c.cardId === 'sprint')).toEqual({ cardId: 'sprint', rarity: 'common', offered: 2, picked: 2, auto: 0, hit: 1, blocked: 0, fizzled: 1, wins: 1 });
    expect(all.cards[0]!.cardId).toBe('sprint'); // most picked first
    // A card nobody picked counts zero plays, not null (2026-10-17: SQL's = on a null result is null).
    expect(all.cards.find((c) => c.cardId === 'shove')).toMatchObject({ picked: 0, hit: 0, blocked: 0, fizzled: 0, wins: 0 });
    const offline = await summary('offline');
    expect(offline.matches).toEqual([{ mode: 'offline', status: 'finished', matches: 1, avgRounds: 10, avgDurationMs: 600_000, humanWins: 1 }]);
    expect(offline.cards.map((c) => c.cardId).sort()).toEqual(['shove', 'sprint']);
    const online = await summary('online');
    expect(online.cards.find((c) => c.cardId === 'sprint')).toMatchObject({ picked: 1, fizzled: 1, wins: 0 });
  });
});
