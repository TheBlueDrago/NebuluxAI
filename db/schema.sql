-- Nebulux's own database (Cloudflare D1 "nebulux-db", bound to the Pages project as DB).
-- Replaces Base44: every record type (User, PublishedGame, ...) is a row here, its fields as JSON.
CREATE TABLE IF NOT EXISTS rows (
  entity TEXT NOT NULL,
  id TEXT PRIMARY KEY,
  created_by_id TEXT,
  created_date TEXT NOT NULL,
  updated_date TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rows_entity ON rows (entity, created_date);
-- Sign-in: one login per email (password hash, PBKDF2), linked to the User row.
CREATE TABLE IF NOT EXISTS logins (
  email TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pw_hash TEXT,
  pw_salt TEXT,
  verified INTEGER NOT NULL DEFAULT 0
);
-- Signed-in sessions (only a hash of the token is kept).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
-- Emailed codes: sign-up confirmation and password reset (hashed, 15 minutes, 5 tries).
CREATE TABLE IF NOT EXISTS codes (
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, purpose)
);
