import type { Env } from './env';
import { handleStats } from './stats';

export { LobbyDO } from './LobbyDO';
export { MatchDO } from './MatchDO';

/** Durable Object ids are 64 hex characters. */
const MATCH_PATH = /^\/match\/([0-9a-f]{64})$/;

/**
 * The Worker (spec #4 §3.2). Files of the built game are served before this runs; the rest
 * routes here: /lobby to the one lobby, /match/:id to that match, /api/stats to the match stats (2026-10-17).
 */
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const stats = await handleStats(request, env, (p) => ctx.waitUntil(p));
    if (stats) return stats;
    const { pathname } = new URL(request.url);
    if (pathname === '/lobby') return env.LOBBY.get(env.LOBBY.idFromName('global')).fetch(request);
    const match = MATCH_PATH.exec(pathname);
    if (match) {
      try {
        return env.MATCH.get(env.MATCH.idFromString(match[1]!)).fetch(request);
      } catch {
        return new Response('No such match', { status: 404 }); // an id from another namespace
      }
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
