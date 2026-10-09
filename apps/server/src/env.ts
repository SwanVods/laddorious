import type { LobbyDO } from './LobbyDO';
import type { MatchDO } from './MatchDO';

/** The Worker's bindings (wrangler.toml). */
export interface Env {
  LOBBY: DurableObjectNamespace<LobbyDO>;
  MATCH: DurableObjectNamespace<MatchDO>;
  /** "1" in e2e runs: bots play every seat, with short windows. */
  FAST?: string;
}
