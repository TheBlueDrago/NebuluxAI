// Nebulux AI's session limit (not Orbit's): 50 credits per 5-hour session, charged by how much work
// each reply takes. A short, quick answer costs a fraction of a credit; a long or hard one (more
// writing, more thinking) costs more. The first message starts the session's 5-hour timer; once its 50
// are used, every AI and every chat waits until the 5 hours are up (one shared limit for all of
// Nebulux AI). The monthly credits (credits.js) are charged as before, on top.
//
// Work = the tokens the model really produced, its thinking included (Google's usage data). When a
// reply comes without that data (the backup model, or a reply stopped early), it's estimated from the
// reply's length and the effort level. Charged in tenths of a credit (at least 0.1 per reply).
//
// D1 (session_work), not KV: KV's free tier allows only 1,000 writes a day for the whole site. A
// message is checked (and the timer started) as it's sent, and charged once its reply is done; a
// reply that got no answer costs nothing. The owner's own accounts (terms.js EXEMPT) have no limit.
import { exempt } from "./terms.js";
import { EFFORT_MULT } from "./credits.js";

export const SESSION_LIMIT = 50;
export const SESSION_HOURS = 5;
const SESSION_MS = SESSION_HOURS * 3600e3;
// 1 session credit = 2,000 tokens of work: a quick answer ≈ 0.1–0.3, an everyday answer ≈ 0.5–1,
// a long or hard one 2–5, a whole website about 5–10.
export const TOKENS_PER_CREDIT = 2000;
const TENTHS = SESSION_LIMIT * 10;

let ready = null;
const ensure = (db) =>
  (ready ||= db
    .prepare("CREATE TABLE IF NOT EXISTS session_work (user_id TEXT PRIMARY KEY, start INTEGER NOT NULL, used INTEGER NOT NULL)")
    .run()
    .catch((e) => {
      ready = null;
      throw e;
    }));

export const sessionExempt = (user) => exempt(user);

// Without usage data: about 4 characters a token, plus thinking that grows with the effort level.
const estimateTokens = (text, effort) => Math.ceil(String(text || "").length / 4) * (1 + (EFFORT_MULT[effort] || 1));

// What a reply's work costs, in session credits (one decimal, at least 0.1).
// tokens: { output } from Google (the answer plus its thinking), or null.
export function workCost({ tokens, text, effort }) {
  const work = tokens && tokens.output > 0 ? tokens.output : estimateTokens(text, effort);
  return Math.max(1, Math.ceil((work / TOKENS_PER_CREDIT) * 10)) / 10;
}

// How long a reply can get on `remaining` session credits (the same estimate, the other way round).
export const sessionMaxChars = (remaining, effort) => Math.max(0, Math.floor(((remaining * TOKENS_PER_CREDIT) / (1 + (EFFORT_MULT[effort] || 1))) * 4));

const toView = (r) => ({ start: Number(r.start), used: Number(r.used) / 10 });

// The running session, or null when none is running (none yet, or its 5 hours are up).
export async function readSession(db, userId, now = Date.now()) {
  await ensure(db);
  const r = await db.prepare("SELECT start, used FROM session_work WHERE user_id = ?").bind(userId).first();
  return r && now < Number(r.start) + SESSION_MS ? toView(r) : null;
}

// -> { limit, hours, used, remaining, resetAt (ms; null when no session is running) } for the app.
export function sessionView(s) {
  const used = s ? s.used : 0;
  return { limit: SESSION_LIMIT, hours: SESSION_HOURS, used, remaining: Math.max(0, Math.round((SESSION_LIMIT - used) * 10) / 10), resetAt: s ? s.start + SESSION_MS : null };
}

// A message was just sent: start a session if none is running (the 5-hour timer starts now) and say
// whether it has credits left. -> { ok, start, used, remaining }
export async function openSession(db, userId, now = Date.now()) {
  await ensure(db);
  const r = await db
    .prepare(
      `INSERT INTO session_work (user_id, start, used) VALUES (?1, ?2, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         start = CASE WHEN session_work.start + ?3 <= ?2 THEN ?2 ELSE session_work.start END,
         used = CASE WHEN session_work.start + ?3 <= ?2 THEN 0 ELSE session_work.used END
       RETURNING start, used`
    )
    .bind(userId, now, SESSION_MS)
    .first();
  const s = toView(r);
  const remaining = sessionView(s).remaining;
  return { ok: remaining > 0, start: s.start, used: s.used, remaining };
}

// The reply is done: charge its work to the session it was sent in (never past the 50).
export async function chargeSession(db, userId, start, cost) {
  const tenths = Math.max(0, Math.round(cost * 10));
  const r = await db
    .prepare("UPDATE session_work SET used = MIN(?3, used + ?4) WHERE user_id = ?1 AND start = ?2 RETURNING used")
    .bind(userId, start, TENTHS, tenths)
    .first()
    .catch(() => null);
  return r ? Number(r.used) / 10 : null;
}

// "2 hours 10 minutes", "12 minutes" (the limit's message).
export function waitText(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(mins / 60), m = mins % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return h ? (m ? `${part(h, "hour")} ${part(m, "minute")}` : part(h, "hour")) : part(m, "minute");
}
