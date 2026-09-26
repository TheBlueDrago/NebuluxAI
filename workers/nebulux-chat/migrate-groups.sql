-- Groups (like Discord servers). "nebulux" is the public one everyone is in; the rest are made
-- by people and joined with an invite code. Apply: npx wrangler d1 execute nebulux-chat --remote --file migrate-groups.sql
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🪐',
  owner_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS members_user ON members (user_id);
