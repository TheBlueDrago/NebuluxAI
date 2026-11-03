// Nebulux AI's usage limits, like Claude's (owner, 2026-11-03): every AI and every chat draws from ONE
// pool of tokens with two limits, and whichever runs out first makes everything wait until it resets.
// - the 5-hour limit: 100,000 tokens; the first message starts its 5 hours
// - the weekly limit: 1,000,000 tokens; it resets for everyone every Thursday at 8:00 AM Central time
//   (America/Chicago; the app shows that moment in each person's own time zone)
// Upgrading to a bigger plan resets both straight away. The app shows them as "% used" with when each
// resets, like Claude. Paid plans' limits are for the owner to set later; until then every plan has Free's.
// Usage credits (usageCredits.js) can extend only the 5-hour limit, never the weekly one.
//
// What a message uses, in tokens (about 4 characters each), unlike Claude only what's new: the message
// they typed (and any pictures), the reply, and the thinking behind it, counted at a quarter (medium
// thinking used to cost about 4 of the old 50 credits a reply). The conversation history the AI re-reads
// each time is NOT counted. Stronger AIs use more: Nebulux AI x1, Galaxy x1.5, Space x2, Nebula x3.
// Google reports the reply's and thinking's real token counts; without them (the backup model, a reply
// stopped early) they're estimated from the reply's length and the effort level.
//
// D1 (token_pool), not KV: KV's free tier allows only 1,000 writes a day for the whole site. A message is
// checked (and the 5-hour timer started) as it's sent, and charged once its reply is done; a reply that
// got no answer costs nothing. The owner's own accounts (terms.js EXEMPT) have no limits.
import { exempt } from "./terms.js";

export const SESSION_HOURS = 5;
export const WEEK_DAYS = 7;
const SESSION_MS = SESSION_HOURS * 3600e3;
// Tokens per window, per plan. The owner will say what the paid plans get; until then they get Free's.
export const POOL_LIMITS = { free: { session: 100000, week: 1000000 } };
export const limitsFor = (plan) => POOL_LIMITS[plan] || POOL_LIMITS.free;
// Stronger AIs use more of the pool (planTotals.js TIERS: Nebulux AI, Galaxy, Space, Nebula).
export const AI_MULT = { ai: 1, aiCode: 1.5, galaxy5: 2, space5: 3 };
// Thinking counts at a quarter of its tokens.
export const THINK_WEIGHT = 0.25;
// Without Google's counts: about how many thinking tokens each reply token takes, by effort level.
const THINK_EST = { low: 0.5, medium: 2, high: 4, extra: 6, ultracode: 8 };
// A picture they attach, as Google counts it.
export const IMAGE_TOKENS = 258;
// Which plans are bigger (an upgrade resets the limits).
const RANK = { free: 0, pro: 1, team: 2, secret: 3, enterprise: 4, admin: 5 };

// ---- the weekly reset: Thursday 8:00 AM in America/Chicago (CST in winter, CDT in summer) ----
export const WEEK_TZ = "America/Chicago";
export const WEEK_RESET = { weekday: 4, hour: 8 }; // Thursday, 8:00
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: WEEK_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
const partsAt = (ms) => Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
// The moment it's `hour`:00 on that calendar day in Chicago.
function chicago(y, m, d, hour) {
  const want = Date.UTC(y, m - 1, d, hour);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const p = partsAt(t);
    t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return t;
}
// -> { start, end }: the weekly window `now` is in (the last Thursday 8:00 AM Central, and the next).
export function weekWindow(now = Date.now()) {
  const p = partsAt(now);
  const day = Date.UTC(+p.year, +p.month - 1, +p.day) - ((WD.indexOf(p.weekday) - WEEK_RESET.weekday + 7) % 7) * 864e5;
  const at = (dayMs) => { const d = new Date(dayMs); return chicago(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), WEEK_RESET.hour); };
  let startDay = day, start = at(day);
  if (start > now) start = at((startDay -= 7 * 864e5));
  return { start, end: at(startDay + 7 * 864e5) };
}

let ready = null;
const ensure = (db) =>
  (ready ||= (async () => {
    await db.prepare("CREATE TABLE IF NOT EXISTS token_pool (user_id TEXT PRIMARY KEY, s_start INTEGER NOT NULL, s_used INTEGER NOT NULL, w_start INTEGER NOT NULL, w_used INTEGER NOT NULL, plan TEXT)").run();
    // (tables made before the plan column was added get it now; it fails harmlessly when it's there)
    await db.prepare("ALTER TABLE token_pool ADD COLUMN plan TEXT").run().catch(() => {});
  })().catch((e) => {
    ready = null;
    throw e;
  }));

export const sessionExempt = (user) => exempt(user);

const toks = (s) => Math.ceil(String(s || "").length / 4);

// The tokens one message uses (whole tokens, at least 1).
// tokens: { answer, thinking } from Google, or null; question: what they typed; images: how many.
export function tokensUsed({ tokens, text, question, images = 0, effort, tier }) {
  const asked = toks(question) + IMAGE_TOKENS * (Number(images) || 0);
  const real = tokens && (tokens.answer > 0 || tokens.thinking > 0);
  const answer = real ? tokens.answer || 0 : toks(text);
  const thinking = real ? tokens.thinking || 0 : answer * (THINK_EST[effort] ?? 2);
  return Math.max(1, Math.ceil((asked + answer + thinking * THINK_WEIGHT) * (AI_MULT[tier] || 1)));
}

// How long a reply can get on `remaining` tokens (the same estimate, the other way round).
export const maxCharsFor = (remaining, effort, tier) =>
  Math.max(0, Math.floor((remaining / (AI_MULT[tier] || 1) / (1 + (THINK_EST[effort] ?? 2) * THINK_WEIGHT)) * 4));

const toRow = (r) => (r ? { sStart: Number(r.s_start), sUsed: Number(r.s_used), wStart: Number(r.w_start), wUsed: Number(r.w_used), plan: r.plan || null } : null);

// They moved to a bigger plan since their last message: both limits start fresh right away (the next
// message starts a new 5 hours). A smaller plan is just noted, so a later upgrade resets again.
async function syncPlan(db, userId, plan) {
  if (!plan) return;
  const r = await db.prepare("SELECT plan FROM token_pool WHERE user_id = ?").bind(userId).first();
  if (!r || r.plan === plan) return;
  if (r.plan && (RANK[plan] ?? 0) > (RANK[r.plan] ?? 0)) await db.prepare("UPDATE token_pool SET s_start = 0, s_used = 0, w_used = 0, plan = ?2 WHERE user_id = ?1").bind(userId, plan).run();
  else await db.prepare("UPDATE token_pool SET plan = ?2 WHERE user_id = ?1").bind(userId, plan).run();
}

// This person's windows as stored (null before their first message). With their current `plan`, an
// upgrade since their last message resets the limits first.
export async function readPool(db, userId, plan) {
  await ensure(db);
  await syncPlan(db, userId, plan);
  return toRow(await db.prepare("SELECT s_start, s_used, w_start, w_used, plan FROM token_pool WHERE user_id = ?").bind(userId).first());
}

// -> what the app shows: each window's limit, tokens used, % used and when it resets, and which limit
// is used up ("session", "week" or null). The 5-hour limit's resetAt is null while it isn't running (its
// time is up, or it hasn't started); the week always resets next Thursday.
export function poolView(row, limits = POOL_LIMITS.free, now = Date.now()) {
  const sRunning = !!row && now < row.sStart + SESSION_MS;
  const sUsed = sRunning ? Math.min(limits.session, row.sUsed) : 0;
  const wk = weekWindow(now);
  const wUsed = row && row.wStart === wk.start ? Math.min(limits.week, row.wUsed) : 0;
  const win = (limit, used, resetAt) => ({ limit, used, left: limit - used, pct: Math.min(100, Math.floor((used / limit) * 100)), resetAt });
  const session = { ...win(limits.session, sUsed, sRunning ? row.sStart + SESSION_MS : null), hours: SESSION_HOURS };
  const week = { ...win(limits.week, wUsed, wk.end), days: WEEK_DAYS };
  return { session, week, out: week.left <= 0 ? "week" : session.left <= 0 ? "session" : null };
}

// A message was just sent: start the 5 hours if they aren't running, move to this week if it's a new
// one, then say whether there's room. -> { ok, out, row, left (tokens the tighter window has left), view }
export async function openPool(db, userId, limits = POOL_LIMITS.free, now = Date.now(), plan = null) {
  await ensure(db);
  await syncPlan(db, userId, plan);
  const wk = weekWindow(now).start;
  const r = await db
    .prepare(
      `INSERT INTO token_pool (user_id, s_start, s_used, w_start, w_used, plan) VALUES (?1, ?2, 0, ?4, 0, ?5)
       ON CONFLICT(user_id) DO UPDATE SET
         s_start = CASE WHEN token_pool.s_start + ?3 <= ?2 THEN ?2 ELSE token_pool.s_start END,
         s_used = CASE WHEN token_pool.s_start + ?3 <= ?2 THEN 0 ELSE token_pool.s_used END,
         w_start = CASE WHEN token_pool.w_start < ?4 THEN ?4 ELSE token_pool.w_start END,
         w_used = CASE WHEN token_pool.w_start < ?4 THEN 0 ELSE token_pool.w_used END,
         plan = COALESCE(?5, token_pool.plan)
       RETURNING s_start, s_used, w_start, w_used, plan`
    )
    .bind(userId, now, SESSION_MS, wk, plan)
    .first();
  const row = toRow(r);
  const view = poolView(row, limits, now);
  return { ok: !view.out, out: view.out, row, left: Math.min(view.session.left, view.week.left), view };
}

// The reply is done: charge its tokens to the windows it was sent in (never past their limits; a
// window that reset in the meantime isn't charged). -> the stored row afterwards, or null.
export async function chargePool(db, userId, row, used, limits = POOL_LIMITS.free) {
  const t = Math.max(0, Math.round(used));
  const r = await db
    .prepare(
      `UPDATE token_pool SET
         s_used = CASE WHEN s_start = ?2 THEN MIN(?4, s_used + ?6) ELSE s_used END,
         w_used = CASE WHEN w_start = ?3 THEN MIN(?5, w_used + ?6) ELSE w_used END
       WHERE user_id = ?1 RETURNING s_start, s_used, w_start, w_used, plan`
    )
    .bind(userId, row.sStart, row.wStart, limits.session, limits.week, t)
    .first()
    .catch(() => null);
  return toRow(r);
}

// "2 hours 10 minutes", "3 days 4 hours", "12 minutes" (the limit's message).
export function waitText(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d) return h ? `${part(d, "day")} ${part(h, "hour")}` : part(d, "day");
  return h ? (m ? `${part(h, "hour")} ${part(m, "minute")}` : part(h, "hour")) : part(m, "minute");
}

// What the AI says when a limit is used up ("You've hit your 5-hour limit. It resets in 2 hours 10 minutes.").
export function limitMessage(view, now = Date.now()) {
  const w = view.out === "week" ? view.week : view.session;
  const name = view.out === "week" ? "weekly limit" : `${SESSION_HOURS}-hour limit`;
  return `You've hit your ${name}. It resets in ${waitText((w.resetAt || now) - now)}.`;
}
