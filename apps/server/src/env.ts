import type { LobbyDO } from './LobbyDO';
import type { MatchDO } from './MatchDO';

/** The Worker's bindings (wrangler.toml). */
export interface Env {
  LOBBY: DurableObjectNamespace<LobbyDO>;
  MATCH: DurableObjectNamespace<MatchDO>;
  /** "1" in e2e runs: bots play every seat, with short windows. */
  FAST?: string;
  /** Match stats (2026-10-17): the D1 database, absent until it's created and bound in wrangler.toml. */
  STATS?: D1Database;
  /** The key that reads the stats summary: `wrangler secret put STATS_KEY`. */
  STATS_KEY?: string;
}
