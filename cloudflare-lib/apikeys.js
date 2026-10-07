// Nebulux API keys (the Nebulux Platform page, /chat/platform). A key ("nx-sk-..." + 48 hex) is
// shown once when it's made; only its SHA-256 is stored (D1 table api_keys). Calls to the public
// API (functions/v1/chat.js) run as the key's owner and use their normal credits.
import { sha } from "./auth.js";

export const MAX_KEYS = 10;
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, prefix TEXT, hash TEXT UNIQUE NOT NULL, created_at TEXT, last_used TEXT, uses INTEGER DEFAULT 0, revoked INTEGER DEFAULT 0)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS api_keys_user ON api_keys (user_id)").run();
  // A monthly spending limit per key (millicents, null = none) and what it spent this month.
  for (const col of ["limit_mc INTEGER", "spent_mc INTEGER DEFAULT 0", "spent_month TEXT"]) {
    await db.prepare(`ALTER TABLE api_keys ADD COLUMN ${col}`).run().catch(() => {}); // already there
  }
  ready = true;
}
const month = () => new Date().toISOString().slice(0, 7);
// What a key has spent this month (a new month starts again at 0).
export const spentThisMonth = (row) => (row && row.spent_month === month() ? row.spent_mc || 0 : 0);
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function listKeys(db, userId) {
  await ensure(db);
  const r = await db.prepare("SELECT id, name, prefix, created_at, last_used, uses, limit_mc, spent_mc, spent_month FROM api_keys WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC").bind(userId).all();
  return (r.results || []).map(({ spent_mc, spent_month, ...k }) => ({ ...k, spent_mc: spentThisMonth({ spent_mc, spent_month }) }));
}
export async function createKey(db, userId, name) {
  await ensure(db);
  const n = await db.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked = 0").bind(userId).first();
  if ((n && n.n) >= MAX_KEYS) return { error: `You can have up to ${MAX_KEYS} keys. Delete one first.` };
  const key = "nx-sk-" + hex(24);
  const id = hex(8);
  await db
    .prepare("INSERT INTO api_keys (id, user_id, name, prefix, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, userId, String(name || "My key").slice(0, 60), key.slice(0, 12), await sha(key), new Date().toISOString())
    .run();
  return { key, id };
}
export async function revokeKey(db, userId, id) {
  await ensure(db);
  await db.prepare("UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?").bind(String(id || ""), userId).run();
}
// Sets (dollars) or clears (null) a key's monthly spending limit.
export async function setLimit(db, userId, id, dollars) {
  await ensure(db);
  const mc = dollars == null || dollars === "" ? null : Math.round(Math.max(0, Math.min(100000, Number(dollars) || 0)) * 100000);
  await db.prepare("UPDATE api_keys SET limit_mc = ? WHERE id = ? AND user_id = ?").bind(mc, String(id || ""), userId).run();
}
// Adds a request's cost to the key's spending this month.
export async function noteSpend(db, id, mc) {
  if (!(mc > 0)) return;
  const m = month();
  await db.prepare("UPDATE api_keys SET spent_mc = CASE WHEN spent_month = ? THEN COALESCE(spent_mc, 0) + ? ELSE ? END, spent_month = ? WHERE id = ?").bind(m, mc, mc, m, id).run();
}
// The key's owner for an "Authorization: Bearer nx-sk-..." header, or null.
export async function keyOwner(db, request) {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(nx-sk-[0-9a-f]{48})$/i);
  if (!m || !db) return null;
  await ensure(db);
  const row = await db.prepare("SELECT id, user_id, limit_mc, spent_mc, spent_month FROM api_keys WHERE hash = ? AND revoked = 0").bind(await sha(m[1].toLowerCase())).first();
  return row || null;
}
export async function noteUse(db, id) {
  await db.prepare("UPDATE api_keys SET last_used = ?, uses = uses + 1 WHERE id = ?").bind(new Date().toISOString(), id).run();
}
// A short sign-in for one API call, so the request runs through the normal AI path (credits,
// limits, safety) as the key's owner; removed right after.
export async function oneCallSession(db, userId) {
  const token = "nx_" + hex(32);
  const h = await sha(token);
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)").bind(h, userId, Date.now() + 5 * 60000).run();
  return { token, done: () => db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(h).run().catch(() => {}) };
}
