// What to offer someone who has run out of credits, like Base44 does: upgrade now for a
// price, buy a one-time pack of credits, or wait until the monthly credits come back. Uses relative imports so the offline
// test (scripts/test-refresh.mjs) can load it with plain node.
import { SALES_OPEN } from "./salesOpen.js";
import { PLAN_TOTALS, TIER_NAMES } from "../../cloudflare-lib/planTotals.js";
import { discounted } from "../../cloudflare-lib/offers.js";
import { packsForTier, DEFAULT_PACK_SIZE } from "../../cloudflare-lib/creditPacks.js";

// The plans a person can buy themselves, cheapest first (prices as in create-checkout).
const UPGRADES = [
  { id: "pro", name: "Pro", price: 15 },
  { id: "team", name: "Team", price: 20 },
];
// The AI pickers' keys -> credit tiers.
export const TIER_OF_AI = { ai: "ai", code: "aiCode", opus5: "galaxy5", fable: "space5" };
const RANK = { free: 0, pro: 1, team: 2, secret: 3, enterprise: 4, admin: 5 };

// Monthly usage is kept per UTC calendar month (cloudflare-lib/credits.js), so everyone's
// credits come back at midnight UTC on the 1st.
export function nextRefresh(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

// The usage limits every AI shares, like Claude's (cloudflare-lib/creditSession.js poolView: a 5-hour
// limit and a weekly limit, in tokens). `limits` is the server's { session, week, out }, or null (the
// owner: no limits). -> { out: "session" | "week" | null, resetAt (when the used-up one resets),
// session: { pct, resetAt }, week: { pct, resetAt } }; a limit whose time is up counts as fresh (0%)
// even before the next check.
export function limitsState(limits, now = Date.now()) {
  if (!limits) return { out: null, resetAt: null, session: null, week: null };
  const win = (w) => (w && w.resetAt && w.resetAt > now ? { pct: Math.min(100, w.pct || 0), resetAt: w.resetAt, full: w.left <= 0 } : { pct: 0, resetAt: null, full: false });
  const session = win(limits.session), week = win(limits.week);
  const out = week.full ? "week" : session.full ? "session" : null;
  return { out, resetAt: out === "week" ? week.resetAt : out === "session" ? session.resetAt : null, session, week };
}
// When a limit resets, in Claude's words: "Resets in 3 hr 12 min" for the 5-hour limit, "Resets Tue
// 9:00 AM" for the weekly one (and "Resets 9:00 AM" when that's today).
export function resetsText(at, now = Date.now(), weekly = false) {
  if (!at) return "";
  if (!weekly) {
    const mins = Math.max(1, Math.ceil((at - now) / 60000)), h = Math.floor(mins / 60), m = mins % 60;
    return `Resets in ${h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`}`;
  }
  const d = new Date(at), time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Resets ${d.toDateString() === new Date(now).toDateString() ? "" : d.toLocaleDateString(undefined, { weekday: "short" }) + " "}${time}`;
}

// "6 days 4 hours", "3 hours 12 minutes", "12 minutes".
export function waitText(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (days) return hours ? `${part(days, "day")} ${part(hours, "hour")}` : part(days, "day");
  if (hours) return minutes ? `${part(hours, "hour")} ${part(minutes, "minute")}` : part(hours, "hour");
  return part(minutes, "minute");
}

// `tier` is "ai", "aiCode", "galaxy5" or "space5"; `credits` is the useCredits() status.
// -> { name, upgrade: { id, name, price, salePrice, extra } | null,
//      pack: { id, min, max, from } | null (id = the pack a picker starts on, from = lowest price),
//      refresh: { at, amount } | null }
// While plans and packs are "coming soon" (lib/salesOpen.js) there's nothing to buy: only when
// the credits come back.
export function outOfCreditsOptions(tier, credits, now = Date.now(), salesOpen = SALES_OPEN) {
  const plan = PLAN_TOTALS[credits?.plan] ? credits.plan : "free";
  const has = PLAN_TOTALS[plan][tier] || 0;

  // The cheapest plan above this one that gives more of these credits. Buying it lifts the
  // monthly allowance at once, so the extra is usable straight away.
  let upgrade = null;
  const next = UPGRADES.find((u) => RANK[u.id] > RANK[plan] && PLAN_TOTALS[u.id][tier] > has);
  if (next) {
    const pct = credits?.offer?.discountAvailable ? credits.offer.discountPct : 0;
    upgrade = { ...next, salePrice: pct ? discounted(next.price) : null, extra: PLAN_TOTALS[next.id][tier] - has };
  }

  // What comes back on the 1st: this plan's allowance, unless the plan (free week, admin
  // grant) ends before then. Enterprise pools add one allowance per seat.
  const at = nextRefresh(now);
  const endsFirst = credits?.planEndsAt && Date.parse(credits.planEndsAt) < at;
  const seats = !endsFirst && credits?.shared && credits?.seats ? credits.seats : 1;
  const amount = (PLAN_TOTALS[endsFirst ? "free" : plan][tier] || 0) * seats;
  const refresh = amount > 0 ? { at, amount } : null;

  // Packs of just these credits (5-50), for any plan: for anyone who'd rather not subscribe,
  // whose plan doesn't include this AI, or who has no plan to go up to.
  const packs = packsForTier(tier);
  const start = packs.find(([, p]) => p.credits === DEFAULT_PACK_SIZE) || packs[0];
  const pack = start
    ? {
        id: start[0],
        min: packs[0][1].credits,
        max: packs[packs.length - 1][1].credits,
        from: Math.min(...packs.map(([, p]) => Number(p.price))),
      }
    : null;

  return { name: TIER_NAMES[tier] || "Nebulux AI", upgrade: salesOpen ? upgrade : null, pack: salesOpen ? pack : null, refresh };
}
