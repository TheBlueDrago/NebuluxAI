// Every email Nebulux AI sends goes through here (Resend, RESEND_API_KEY, from support@nebuluxai.com).
// Resend's free plan sends 100 emails a day for everything, so the day's count is kept in D1 (exact across
// data centres) and the emails people are waiting for come first: sign-up, sign-in and password codes can
// use the whole day, while the extras stop earlier and leave room for them. When Resend itself says the
// day (or month) is used up, nothing else is tried until tomorrow, and Monitor → Errors says so once.
//   sendEmail(env, { to, subject, text, html, kind }) -> { ok: true } | { ok: false, full: true } | { ok: false }
import { logError } from "./errorlog.js";

export const DAY_LIMIT = 100;
// How far into the day's emails each kind may go.
export const ROOM = { code: 100, device: 75, notice: 70, welcome: 55, alert: 45, announce: 40, newacct: 25 };
const FULL = 100000;

export const FULL_MESSAGE = "We've sent all the emails we can for today, so we can't send that right now. Please try again tomorrow.";

const today = () => new Date().toISOString().slice(0, 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensure(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS mail_days (day TEXT PRIMARY KEY, sent INTEGER NOT NULL DEFAULT 0)").run();
}

// Counts n emails of this kind if there's room for them today. A database problem never stops an email.
export async function takeRoom(db, kind, n = 1) {
  if (!db) return true;
  try {
    await ensure(db);
    const limit = ROOM[kind] || ROOM.alert;
    const r = await db
      .prepare("INSERT INTO mail_days (day, sent) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET sent = sent + excluded.sent WHERE sent + excluded.sent <= ? RETURNING sent")
      .bind(today(), n, limit)
      .first();
    return !!r && r.sent <= limit;
  } catch {
    return true;
  }
}

export async function sentToday(db) {
  try {
    await ensure(db);
    const r = await db.prepare("SELECT sent FROM mail_days WHERE day = ?").bind(today()).first();
    return Math.min((r && r.sent) || 0, DAY_LIMIT);
  } catch {
    return 0;
  }
}

async function markFull(env, why) {
  try {
    await ensure(env.DB);
    const before = await env.DB.prepare("SELECT sent FROM mail_days WHERE day = ?").bind(today()).first();
    await env.DB.prepare("INSERT INTO mail_days (day, sent) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET sent = ?").bind(today(), FULL, FULL).run();
    if (!before || before.sent < FULL)
      await logError(env.DB, { kind: "server", message: `Emails stopped for today: Resend says ${why}. Sign-up and sign-in codes start again tomorrow (UTC).`, path: "email" }).catch(() => {});
  } catch {
    /* nothing to record it in */
  }
}

export async function sendEmail(env, { to, subject, text, html, kind = "code" }) {
  if (!env || !env.RESEND_API_KEY) return { ok: false, unset: true };
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!list.length) return { ok: false };
  if (!(await takeRoom(env.DB, kind, list.length))) return { ok: false, full: true };
  const body = JSON.stringify({ from: "Nebulux AI <support@nebuluxai.com>", to: list, subject, text, ...(html ? { html } : {}) });
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body,
    }).catch(() => null);
    if (r && r.ok) return { ok: true };
    if (!r || r.status !== 429) return { ok: false };
    const e = await r.json().catch(() => ({}));
    const name = String((e && (e.name || e.error)) || "");
    if (/daily_quota|monthly_quota|quota/i.test(name) || /quota/i.test(String(e && e.message))) {
      await markFull(env, /monthly/i.test(name + (e && e.message)) ? "this month's emails are used up" : "today's emails are used up");
      return { ok: false, full: true };
    }
    // Too many at once (2 a second on the free plan): one more try a moment later.
    await wait(1100);
  }
  return { ok: false };
}
