// Nebulux AI's session limit (not Orbit's): every message takes 1 credit the moment it's sent, up to 50
// in a 5-hour session. The first message starts the session's timer; once its 50 are used, every AI
// and every chat waits until the 5 hours are up (it's one shared limit for all of Nebulux AI). The
// monthly credits (credits.js) are charged as before, on top.
//
// D1 (credit_sessions), not KV: a message is counted before the reply starts, and KV's free tier
// allows only 1,000 writes a day for the whole site; D1 also checks and counts in one statement, so
// messages sent all at once can't slip past the limit. The owner's own accounts (terms.js EXEMPT)
// have no session limit. A website or game build's automatic "continue" requests ride on the message
// that started them (up to 3, within 10 minutes of it), and a message that got no answer (the AI was
// busy or failed) gets its credit back.
import { exempt } from "./terms.js";

export const SESSION_LIMIT = 50;
export const SESSION_HOURS = 5;
const SESSION_MS = SESSION_HOURS * 3600e3;
const FOLLOW_UPS = 3;
const FOLLOW_MS = 10 * 60e3;

let ready = null;
const ensure = (db) =>
  (ready ||= db
    .prepare("CREATE TABLE IF NOT EXISTS credit_sessions (user_id TEXT PRIMARY KEY, start INTEGER NOT NULL, used INTEGER NOT NULL, last INTEGER NOT NULL DEFAULT 0, follow INTEGER NOT NULL DEFAULT 0)")
    .run()
    .catch((e) => {
      ready = null;
      throw e;
    }));

export const sessionExempt = (user) => exempt(user);

// The running session, or null when none is running (none yet, or its 5 hours are up).
export async function readSession(db, userId, now = Date.now()) {
  await ensure(db);
  const r = await db.prepare("SELECT start, used FROM credit_sessions WHERE user_id = ?").bind(userId).first();
  return r && now < Number(r.start) + SESSION_MS ? { start: Number(r.start), used: Number(r.used) } : null;
}

// -> { limit, hours, used, remaining, resetAt (ms; null when no session is running) } for the app.
export function sessionView(s) {
  const used = s ? s.used : 0;
  return { limit: SESSION_LIMIT, hours: SESSION_HOURS, used, remaining: Math.max(0, SESSION_LIMIT - used), resetAt: s ? s.start + SESSION_MS : null };
}

// A message was just sent: take its credit. -> { ok, counted, start, used }
// ok false: this session's 50 are used (nothing was taken). counted false: a free follow-up.
export async function takeSessionCredit(db, userId, { followUp = false, now = Date.now() } = {}) {
  await ensure(db);
  if (followUp) {
    const f = await db
      .prepare("UPDATE credit_sessions SET follow = follow + 1 WHERE user_id = ?1 AND follow < ?2 AND last > ?3 AND start + ?4 > ?5 RETURNING start, used")
      .bind(userId, FOLLOW_UPS, now - FOLLOW_MS, SESSION_MS, now)
      .first();
    if (f) return { ok: true, counted: false, start: Number(f.start), used: Number(f.used) };
  }
  // A new session when none is running (the timer starts now), otherwise one more message in it,
  // unless its 50 are used (then nothing changes and nothing comes back).
  const r = await db
    .prepare(
      `INSERT INTO credit_sessions (user_id, start, used, last, follow) VALUES (?1, ?2, 1, ?2, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         start = CASE WHEN credit_sessions.start + ?3 <= ?2 THEN ?2 ELSE credit_sessions.start END,
         used = CASE WHEN credit_sessions.start + ?3 <= ?2 THEN 1 ELSE credit_sessions.used + 1 END,
         last = ?2, follow = 0
       WHERE credit_sessions.start + ?3 <= ?2 OR credit_sessions.used < ?4
       RETURNING start, used`
    )
    .bind(userId, now, SESSION_MS, SESSION_LIMIT)
    .first();
  if (r) return { ok: true, counted: true, start: Number(r.start), used: Number(r.used) };
  const s = await readSession(db, userId, now);
  return { ok: false, counted: false, start: s ? s.start : now, used: s ? s.used : SESSION_LIMIT };
}

// The message got no answer (the AI was busy or failed): its credit goes back (same session only).
export async function giveSessionCredit(db, userId, start) {
  await db.prepare("UPDATE credit_sessions SET used = MAX(0, used - 1) WHERE user_id = ? AND start = ?").bind(userId, start).run().catch(() => {});
}

// "2 hours 10 minutes", "12 minutes" (the limit's message).
export function waitText(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(mins / 60), m = mins % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return h ? (m ? `${part(h, "hour")} ${part(m, "minute")}` : part(h, "hour")) : part(m, "minute");
}
