import { PIECES, type MatchStats } from '@laddorious/host';

// Match stats in D1 (the user, 2026-10-17): every match, online and offline, real players only.
// Online matches write theirs from the match's Durable Object; an offline match's browser posts
// its summary to /api/stats. The card editor reads totals from /api/stats/summary with the stats key.

/** The parts of a D1 database the stats use, so tests can stand in for one. */
export interface StatsStatement {
  bind(...args: unknown[]): StatsStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface StatsDb {
  prepare(sql: string): StatsStatement;
  batch(statements: StatsStatement[]): Promise<unknown>;
}

/** The Worker's stats bindings: the database, and the key that reads the summary (`wrangler secret put STATS_KEY`). */
export interface StatsEnv {
  STATS?: StatsDb;
  STATS_KEY?: string;
}

/** The largest offline summary the server takes. */
export const MAX_STATS_BYTES = 64 * 1024;
const MAX_PLAYERS = 4;
const MAX_CARDS = 400;

const MATCH_COLUMNS = 'id, created_at, mode, status, version, seed, rounds, duration_ms, humans, bots, human_won';
const PLAYER_COLUMNS = 'match_id, player_key, nickname, piece, place, tile, rockets, whirlpools, dodged, face_offs_won, face_offs_lost, cards_picked, left_early';
const CARD_COLUMNS = 'match_id, player_key, card_id, rarity, round, picked, auto, result, picker_won';
const insert = (table: string, columns: string) => `INSERT INTO ${table} (${columns}) VALUES (${columns.split(',').map(() => '?').join(', ')})`;
const bit = (b: boolean) => (b ? 1 : 0);

/** A match's rows as insert statements: the match, each real player, each card they were shown. */
export function statsStatements(stats: MatchStats, meta: { id: string; createdAt: number }): { sql: string; args: unknown[] }[] {
  const m = stats.match;
  return [
    { sql: insert('matches', MATCH_COLUMNS), args: [meta.id, meta.createdAt, m.mode, m.status, m.version, m.seed, m.rounds, m.durationMs, m.humans, m.bots, m.humanWon === null ? null : bit(m.humanWon)] },
    ...stats.players.map((p) => ({
      sql: insert('match_players', PLAYER_COLUMNS),
      args: [meta.id, p.playerKey, p.nickname, p.piece, p.place, p.tile, p.rockets, p.whirlpools, p.dodged, p.faceOffsWon, p.faceOffsLost, p.cardsPicked, bit(p.leftEarly)],
    })),
    ...stats.cards.map((c) => ({ sql: insert('card_offers', CARD_COLUMNS), args: [meta.id, c.playerKey, c.cardId, c.rarity, c.round, bit(c.picked), bit(c.auto), c.result, bit(c.pickerWon)] })),
  ];
}

/** Writes a match's stats in one batch. Best effort: a failure is logged and the game carries on. */
export async function writeStats(db: StatsDb | undefined, stats: MatchStats): Promise<void> {
  if (!db) return;
  try {
    const rows = statsStatements(stats, { id: crypto.randomUUID(), createdAt: Date.now() });
    await db.batch(rows.map((r) => db.prepare(r.sql).bind(...r.args)));
  } catch (err) {
    console.error('match stats not saved', err);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => typeof v === 'string' && (options as readonly string[]).includes(v);
const BIG = 1_000_000_000;

/**
 * An offline match's posted summary, checked field by field (2026-10-17). It always counts as offline:
 * the browser played it, so it can't vouch for itself. Null when anything is off.
 */
export function parseOfflineStats(raw: unknown): MatchStats | null {
  if (!isObj(raw) || !isObj(raw.match) || !Array.isArray(raw.players) || !Array.isArray(raw.cards)) return null;
  const m = raw.match;
  if (!oneOf(m.status, ['finished', 'abandoned', 'failed'] as const) || !isText(m.version, 20) || !isText(m.seed, 80)) return null;
  if (!isInt(m.rounds, 0, 10_000) || !isInt(m.durationMs, 0, BIG) || !isInt(m.humans, 1, 4) || !isInt(m.bots, 0, 3) || !(m.humanWon === null || isBool(m.humanWon))) return null;
  if (raw.players.length < 1 || raw.players.length > MAX_PLAYERS || raw.cards.length > MAX_CARDS) return null;
  const players = raw.players.map((p) => {
    if (!isObj(p) || !isText(p.playerKey, 64) || !isText(p.nickname, 16) || !oneOf(p.piece, PIECES) || !(p.place === null || isInt(p.place, 1, 4))) return null;
    const counts = ['tile', 'rockets', 'whirlpools', 'dodged', 'faceOffsWon', 'faceOffsLost', 'cardsPicked'] as const;
    if (!counts.every((k) => isInt(p[k], 0, 10_000)) || !isBool(p.leftEarly)) return null;
    return { playerKey: p.playerKey, nickname: p.nickname, piece: p.piece, place: p.place, tile: p.tile as number, rockets: p.rockets as number, whirlpools: p.whirlpools as number, dodged: p.dodged as number, faceOffsWon: p.faceOffsWon as number, faceOffsLost: p.faceOffsLost as number, cardsPicked: p.cardsPicked as number, leftEarly: p.leftEarly };
  });
  const cards = raw.cards.map((c) => {
    if (!isObj(c) || !isText(c.playerKey, 64) || !isText(c.cardId, 64) || !oneOf(c.rarity, ['common', 'rare', 'epic'] as const) || !isInt(c.round, 1, 10_000)) return null;
    if (!isBool(c.picked) || !isBool(c.auto) || !isBool(c.pickerWon) || !(c.result === null || oneOf(c.result, ['hit', 'blocked', 'fizzled'] as const))) return null;
    return { playerKey: c.playerKey, cardId: c.cardId, rarity: c.rarity, round: c.round, picked: c.picked, auto: c.auto, result: c.result, pickerWon: c.pickerWon };
  });
  if (players.some((p) => p === null) || cards.some((c) => c === null)) return null;
  return {
    match: { mode: 'offline', status: m.status, version: m.version, seed: m.seed, rounds: m.rounds, durationMs: m.durationMs, humans: m.humans, bots: m.bots, humanWon: m.humanWon },
    players: players as MatchStats['players'],
    cards: cards as MatchStats['cards'],
  };
}

/** Which matches the summary counts: fixed SQL per filter, never built from the request. */
const WHERE: Record<string, string> = { all: '1 = 1', online: "m.mode != 'offline'", offline: "m.mode = 'offline'" };

/** Totals for the card editor's Stats tab. */
async function summary(db: StatsDb, mode: string) {
  const where = WHERE[mode] ?? WHERE.all!;
  const [matches, players, cards] = await Promise.all([
    db.prepare(`SELECT m.mode AS mode, m.status AS status, COUNT(*) AS matches, AVG(m.rounds) AS avgRounds, AVG(m.duration_ms) AS avgDurationMs, SUM(m.human_won) AS humanWins FROM matches m WHERE ${where} GROUP BY m.mode, m.status`).all(),
    db.prepare(`SELECT COUNT(DISTINCT p.player_key) AS players, SUM(p.left_early) AS leftEarly FROM match_players p JOIN matches m ON m.id = p.match_id WHERE ${where}`).all(),
    db
      .prepare(
        `SELECT c.card_id AS cardId, c.rarity AS rarity, COUNT(*) AS offered, SUM(c.picked) AS picked, SUM(c.auto) AS auto, SUM(c.result IS 'hit') AS hit, SUM(c.result IS 'blocked') AS blocked, SUM(c.result IS 'fizzled') AS fizzled, SUM(c.picker_won) AS wins FROM card_offers c JOIN matches m ON m.id = c.match_id WHERE ${where} GROUP BY c.card_id, c.rarity ORDER BY picked DESC`,
      )
      .all(),
  ]);
  return { mode: WHERE[mode] ? mode : 'all', matches: matches.results, players: players.results[0] ?? { players: 0, leftEarly: 0 }, cards: cards.results };
}

/** The local card editor may read the summary from its own dev server, and no other site may. */
function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET, OPTIONS', vary: 'origin' }
    : {};
}

/** Constant-time string comparison, so the key can't be guessed by timing. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The stats routes, or null for any other path. `waitUntil` keeps a write going after the response. */
export async function handleStats(request: Request, env: StatsEnv, waitUntil: (p: Promise<unknown>) => void): Promise<Response | null> {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === '/api/stats' && request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_STATS_BYTES) return new Response('Too large', { status: 413 });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return new Response('Bad stats', { status: 400 });
    }
    const stats = parseOfflineStats(raw);
    if (!stats) return new Response('Bad stats', { status: 400 });
    waitUntil(writeStats(env.STATS, stats));
    return new Response(null, { status: 204 });
  }
  if (pathname === '/api/stats/summary') {
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const given = (request.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    if (!env.STATS_KEY || !env.STATS || !sameKey(given, env.STATS_KEY)) return new Response('Unauthorized', { status: 401, headers });
    return Response.json(await summary(env.STATS, searchParams.get('mode') ?? 'all'), { headers });
  }
  return null;
}
