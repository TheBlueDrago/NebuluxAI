-- Things quests count that aren't messages (react, buy, profile). Apply: npx wrangler d1 execute nebulux-chat --remote --file migrate-events.sql
CREATE TABLE IF NOT EXISTS events (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user ON events (user_id, created_at);
CREATE INDEX IF NOT EXISTS quests_done_day ON quests_done (user_id, created_at);
-- Stars bought with money: each paid Base44Purchase row is added once.
CREATE TABLE IF NOT EXISTS star_buys (
  purchase_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
