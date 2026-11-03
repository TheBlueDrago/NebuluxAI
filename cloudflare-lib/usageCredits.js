// Usage credits, like Claude's extra usage (owner, 2026-11-03): money someone adds that extends their
// 5-hour limit (creditSession.js) once it runs out. They never extend the weekly limit, and messages
// they pay for still count toward it: with the week used up, it's upgrade or use the API. Bought as a
// dollar amount ($5 to $500, $100 recommended; src/lib/usageCredits.js), and each person can set how
// much of them may be spent per day.
//
// Not on sale yet (src/lib/salesOpen.js): balances are $0 until the payment provider is connected, and
// spending them (the rate, and letting a message through past the 5-hour limit) comes with it. The daily
// limit is stored now so it's ready.
//
// D1 (usage_credits), in millicents (1/100,000 of a dollar) like the API balance (apibilling.js).
export const DAILY_LIMIT_MIN = 1;
export const DAILY_LIMIT_MAX = 500;

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
const dollars = (mc) => Math.round(Number(mc) || 0) / 100000;

// -> { balance, dailyLimit (whole dollars, or null for no limit), spentToday } in dollars.
export async function usageCreditsView(db, userId, now = Date.now()) {
  await ensure(db);
  const r = await db.prepare("SELECT balance, daily_limit, day, spent_today FROM usage_credits WHERE user_id = ?").bind(userId).first();
  if (!r) return { balance: 0, dailyLimit: null, spentToday: 0 };
  return { balance: dollars(r.balance), dailyLimit: r.daily_limit == null ? null : Number(r.daily_limit), spentToday: r.day === today(now) ? dollars(r.spent_today) : 0 };
}

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
