-- Match stats (2026-10-17): every match, online and offline, for real players only, never bots.
-- Apply with: pnpm --filter @laddorious/server exec wrangler d1 migrations apply laddorious-stats --remote

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  version TEXT NOT NULL,
  seed TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  humans INTEGER NOT NULL,
  bots INTEGER NOT NULL,
  human_won INTEGER
);

CREATE TABLE match_players (
  match_id TEXT NOT NULL REFERENCES matches (id),
  player_key TEXT NOT NULL,
  nickname TEXT NOT NULL,
  piece TEXT NOT NULL,
  place INTEGER,
  tile INTEGER NOT NULL,
  rockets INTEGER NOT NULL,
  whirlpools INTEGER NOT NULL,
  dodged INTEGER NOT NULL,
  face_offs_won INTEGER NOT NULL,
  face_offs_lost INTEGER NOT NULL,
  cards_picked INTEGER NOT NULL,
  left_early INTEGER NOT NULL
);

CREATE TABLE card_offers (
  match_id TEXT NOT NULL REFERENCES matches (id),
  player_key TEXT NOT NULL,
  card_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  round INTEGER NOT NULL,
  picked INTEGER NOT NULL,
  auto INTEGER NOT NULL,
  result TEXT,
  picker_won INTEGER NOT NULL
);
