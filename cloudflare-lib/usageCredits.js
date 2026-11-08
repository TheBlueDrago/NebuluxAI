// Usage credits, like Claude's extra usage (owner, 2026-11-03): money someone adds that extends their
// 5-hour limit (creditSession.js) once it runs out. They never extend the weekly limit, and messages
// they pay for still count toward it: with the week used up, it's upgrade or use the API. Bought as a
// dollar amount ($5 to $500, $100 recommended; src/lib/usageCredits.js), and each person can set how
// much of them may be spent per day.
//
// The rate: $1 for every 10,000 tokens past the 5-hour limit (the same tokens the limits count). The app
// shows money, not tokens. Bought through Stripe (create-checkout); its signed webhook adds them (addUsageCredits).
//
// D1 (usage_credits), in millicents (1/100,000 of a dollar) like the API balance (apibilling.js).
export const DAILY_LIMIT_MIN = 1;
export const DAILY_LIMIT_MAX = 500;
export const TOKENS_PER_DOLLAR = 10000;
const MC = 100000; // millicents in a dollar
const MC_PER_TOKEN = MC / TOKENS_PER_DOLLAR; // 10

let ready = null;
const ensure = (db) =>
  (ready ||= db
    .prepare("CREATE TABLE IF NOT EXISTS usage_credits (user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, daily_limit INTEGER, day TEXT, spent_today INTEGER NOT NULL DEFAULT 0)")
    .run()
    .catch((e) => {
      ready = null;
      throw e;
    }));

const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const dollars = (mc) => Math.round(Number(mc) || 0) / MC;

// -> { balance, dailyLimit (whole dollars, or null for no limit), spentToday, spendable (what can still be
// spent today: the balance, held to the daily limit) } in dollars.
export async function usageCreditsView(db, userId, now = Date.now()) {
  await ensure(db);
  const r = await db.prepare("SELECT balance, daily_limit, day, spent_today FROM usage_credits WHERE user_id = ?").bind(userId).first();
  if (!r) return { balance: 0, dailyLimit: null, spentToday: 0, spendable: 0 };
  const balance = Math.max(0, Number(r.balance) || 0), spent = r.day === today(now) ? Number(r.spent_today) || 0 : 0;
  const cap = r.daily_limit == null ? Infinity : Math.max(0, Number(r.daily_limit) * MC - spent);
  return { balance: dollars(balance), dailyLimit: r.daily_limit == null ? null : Number(r.daily_limit), spentToday: dollars(spent), spendable: dollars(Math.min(balance, cap)) };
}

// How many tokens past the 5-hour limit `view` (usageCreditsView) can still pay for.
export const tokensFor = (view) => Math.floor(((view && view.spendable) || 0) * TOKENS_PER_DOLLAR);
// What `tokens` past the 5-hour limit cost, in dollars.
export const costOf = (tokens) => dollars(Math.ceil(Math.max(0, tokens) * MC_PER_TOKEN));

// A typed daily limit -> whole dollars ($1 to $500), null for "no limit", or undefined when it isn't valid.
export function parseDailyLimit(v) {
  if (v === null || v === "" || v === "none") return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n !== Math.floor(n) || n < DAILY_LIMIT_MIN || n > DAILY_LIMIT_MAX) return undefined;
  return n;
}

// Sets how many dollars of usage credits may be spent per day (null: no daily limit).
export async function setDailyLimit(db, userId, limit) {
  await ensure(db);
  await db
    .prepare("INSERT INTO usage_credits (user_id, daily_limit) VALUES (?1, ?2) ON CONFLICT(user_id) DO UPDATE SET daily_limit = ?2")
    .bind(userId, limit)
    .run();
  return usageCreditsView(db, userId);
}

// Pays for `tokens` used past the 5-hour limit: taken from the balance (never below $0) and added to
// today's spending. -> the dollars actually taken.
export async function spendUsageCredits(db, userId, tokens, now = Date.now()) {
  const mc = Math.ceil(Math.max(0, tokens) * MC_PER_TOKEN);
  if (!mc) return 0;
  await ensure(db);
  const day = today(now);
  const before = await db.prepare("SELECT balance FROM usage_credits WHERE user_id = ?").bind(userId).first();
  const take = Math.min(mc, Math.max(0, Number(before && before.balance) || 0));
  if (!take) return 0;
  await db
    .prepare("UPDATE usage_credits SET balance = MAX(0, balance - ?2), spent_today = CASE WHEN day = ?3 THEN spent_today + ?2 ELSE ?2 END, day = ?3 WHERE user_id = ?1")
    .bind(userId, take, day)
    .run();
  return dollars(take);
}

// Adds bought usage credits (from the Stripe webhook, cloudflare-lib/stripe.js; amounts in dollars).
export async function addUsageCredits(db, userId, amount) {
  const mc = Math.round(Math.max(0, Number(amount) || 0) * MC);
  await ensure(db);
  await db.prepare("INSERT INTO usage_credits (user_id, balance) VALUES (?1, ?2) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?2").bind(userId, mc).run();
  return usageCreditsView(db, userId);
}
