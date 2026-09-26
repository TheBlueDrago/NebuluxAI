// Server-side credits. Credits used to be counted only in the user's browser
// (localStorage) and bonus balances were written back with updateMe, so anyone
// could reset or raise their own credits — and the AI endpoint didn't check at all.
// Now every AI call is authenticated and charged here, and the UI just displays
// the status this returns.
//
// Access follows credits, not plans: any AI can be used while the user has credits
// for it (from a plan, a referral reward, a promo code or an admin), and not without.
//
// Where each fact comes from (nothing a user can edit about themselves):
// - role "admin": Base44 enforces role itself (all entity RLS depends on it).
// - Paid plans: Base44Purchase rows with status "paid" (admin/service-only writes).
// - Team membership: Base44's my-team function (reads admin-only Team rows).
// - Admin grants / bans: "grant:<userId>" in KV, written only via admin-grant.
//   (User.plan / User.bonus / User.banned are NOT trusted — a user can set their own.)
// - Promo bonus credits: PromoRedemption rows (service-only writes), folded into
//   the server-owned "bonus:<userId>" balance once each.
// - Monthly usage: "usage:<userId>:<YYYY-MM>"; for a team's shared Nebulux Code pool,
//   "teamusage:<teamId>:<YYYY-MM>"; and for an Enterprise organization, which shares all of
//   its credits, "orgusage:<ownerId>:<YYYY-MM>" ({ ai, aiCode, galaxy5, space5 }).
// Stored in the PUBLISHED_HTML KV namespace (already bound to this Pages project)
// under their own key prefixes.
import { base44 } from "./published.js";
import { teamFor, seatsOf } from "./teams.js";
import { offerFor, OFFER_TAG } from "./offers.js";
import { CREDIT_PACKS } from "./creditPacks.js";

// Plan allowances live in planTotals.js so the app can show them too (out-of-credits card).
export { TIERS, TIER_OF_MODEL, TIER_NAMES, PLAN_TOTALS } from "./planTotals.js";
import { TIERS, PLAN_TOTALS } from "./planTotals.js";
import { blockedBy, unverified, emailRemoved, removedEmailKey } from "./bans.js";
const RANK = { free: 0, pro: 1, team: 2, secret: 3, enterprise: 4, admin: 5 };

// Whole credits: 1 per started 10,000 characters of reply, times the effort level.
export const CHARS_PER_CREDIT = 10000;
export const EFFORT_MULT = { low: 1, medium: 1, high: 2, extra: 3, ultracode: 4 };
export const creditsFor = (text, effort) =>
  Math.max(1, Math.ceil(String(text || "").length / CHARS_PER_CREDIT)) * (EFFORT_MULT[effort] || 1);

const monthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const q = (obj) => encodeURIComponent(JSON.stringify(obj));

async function getJSON(kv, key, fallback) {
  try {
    const v = await kv.get(key, "json");
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
async function putJSON(kv, key, value) {
  try {
    await kv.put(key, JSON.stringify(value));
  } catch (err) {
    // KV's free tier allows 1,000 writes/day; don't fail the user's request over it.
    console.error("credits: KV write failed", key, String(err));
  }
}

export async function currentUser(request) {
  if (!request.headers.get("authorization")) return null;
  try {
    const u = await base44(request, "GET", "entities/User/me");
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

// The user's Base44Purchase rows (a promise; null when Base44 couldn't be reached). The plan
// and the bonus balance both need them, so entitlement() reads them once and passes them on.
const purchasesOf = (request, user) =>
  base44(request, "GET", `entities/Base44Purchase?q=${q({ appUserId: user.id })}`).then(
    (rows) => rows || [],
    () => null
  );

// The best plan the user has paid for, and whether they've already bought something with the
// one-time new-member discount (checkout tags those purchases, see create-checkout).
async function paidPlan(request, user, purchases) {
  try {
    const rows = await (purchases || purchasesOf(request, user));
    if (!rows) throw new Error("Base44Purchase unavailable");
    let best = "free";
    let discountUsed = false;
    for (const p of rows || []) {
      if (p.status === "paid" && RANK[p.productId] > RANK[best]) best = p.productId;
      if ((p.status === "paid" || p.status === "canceled") && String(p.productName || "").includes(OFFER_TAG)) discountUsed = true;
    }
    return { plan: best, discountUsed };
  } catch {
    return { plan: "free", discountUsed: false };
  }
}

// An admin looking at someone else: my-team only answers for the caller, so read the
// (admin-readable) Team rows directly.

// Server-owned bonus balance: seeded from the admin snapshot, plus each promo redemption and
// each paid credit pack (creditPacks.js) once.
async function syncBonus(kv, request, user, grant, purchases) {
  const key = `bonus:${user.id}`;
  let b = await getJSON(kv, key, null);
  let changed = false;
  if (!b) {
    b = { ai: 0, aiCode: 0, galaxy5: 0, space5: 0, applied: [] };
    if (grant && grant.bonus) for (const t of TIERS) b[t] = Math.max(0, Number(grant.bonus[t]) || 0);
    changed = true;
  }
  b.applied = b.applied || [];
  let reds = [];
  try {
    reds = (await base44(request, "GET", `entities/PromoRedemption?q=${q({ userId: user.id })}`)) || [];
  } catch {
    reds = [];
  }
  const since = (grant && grant.bonusAsOf) || "";
  for (const r of reds) {
    if (!r || !r.id || b.applied.includes(r.id)) continue;
    b.applied.push(r.id);
    changed = true;
    // Redemptions from before the snapshot are already in the seeded balance.
    if (since && r.redeemedAt && r.redeemedAt <= since) continue;
    const tier = TIERS.includes(r.aiModel) ? r.aiModel : "ai";
    b[tier] = (Number(b[tier]) || 0) + (Number(r.credits) || 0);
  }
  // Base44Purchase rows are written only by the payment functions (service role), so a paid
  // pack row can be trusted; "buy:<id>" keeps it apart from redemption ids in `applied`.
  for (const p of (await (purchases || purchasesOf(request, user))) || []) {
    const pack = p && p.status === "paid" && CREDIT_PACKS[p.productId];
    if (!pack || !p.id || b.applied.includes(`buy:${p.id}`)) continue;
    b.applied.push(`buy:${p.id}`);
    changed = true;
    if (since && p.paidAt && p.paidAt <= since) continue;
    const packs = Math.max(1, Math.trunc(Number(p.quantity)) || 1);
    b[pack.tier] = (Number(b[pack.tier]) || 0) + pack.credits * packs;
  }
  if (changed) await putJSON(kv, key, b);
  return b;
}

// The user's own plan, before team membership: admin role, an admin grant, a payment, or
// the new-account free week of Pro (offers.js). Pass `details` to learn where it came from.
export async function basePlanOf(kv, request, user, grant, details, purchases) {
  if (grant === undefined) grant = await getJSON(kv, `grant:${user.id}`, null);
  let plan = "free";
  let source = "free";
  let endsAt = null;
  const consider = (p, from, until = null) => {
    if (p && RANK[p] > RANK[plan]) {
      plan = p;
      source = from;
      endsAt = until;
    }
  };
  if (user.role === "admin") consider("admin", "admin");
  if (grant && grant.plan && !(grant.planExpiresAt && new Date(grant.planExpiresAt) < new Date())) consider(grant.plan, "grant", grant.planExpiresAt || null);
  const paid = await paidPlan(request, user, purchases);
  consider(paid.plan, "paid");
  const offer = offerFor(user);
  if (offer && offer.trialActive) consider("pro", "trial", offer.trialEndsAt);
  // The discount can be used once.
  if (offer) offer.discountAvailable = offer.discountActive && !paid.discountUsed;
  if (details) Object.assign(details, { source, endsAt, offer });
  return plan;
}

// Teams live in KV (cloudflare-lib/teams.js), not Base44's my-team function: every
// Base44 function call used up the Base44 integration allowance, and once that ran out
// they all failed. `other` is kept for callers that compute this for another user.
// eslint-disable-next-line no-unused-vars
export async function entitlement(kv, request, user, { other = false } = {}) {
  const grant = await getJSON(kv, `grant:${user.id}`, null);
  const details = {};
  const purchases = purchasesOf(request, user);
  const [base, bonus] = await Promise.all([
    basePlanOf(kv, request, user, grant, details, purchases),
    syncBonus(kv, request, user, grant, purchases),
  ]);
  const team = await teamFor(kv, user, base);
  let plan = base;
  if (team && RANK[team.plan] > RANK[plan]) {
    plan = team.plan;
    details.source = "member";
    details.endsAt = null;
  }
  const now = new Date();
  // Not confirmed by email yet: nothing works until the code is entered (the app asks for it).
  const notVerified = unverified(user);
  const blocked = blockedBy(user, grant, now) || notVerified || (user.role !== "admin" && (await emailRemoved(kv, user.email)));
  // For the ban screen: when a timed block ends (the later one, if both set one); null = banned.
  const blockedUntil = blocked
    ? [grant && grant.blockedUntil, user.blockedUntil].filter((v) => v && new Date(v) > now).sort().pop() || null
    : null;
  // Enterprise: everyone in the organization draws every kind of credit from one pool.
  const orgId = team && plan === "enterprise" ? team.teamId : null;
  const seats = orgId ? await seatsOf(kv, orgId) : null;
  if (details.source === "paid" && UPGRADE_REWARD[base]) await rewardReferrers(kv, user, base, base === "enterprise" ? seats : 0).catch(() => {});
  return {
    user,
    plan,
    teamId: team && (plan === "team" || plan === "secret") ? team.teamId : null,
    orgId,
    seats,
    bonus,
    blocked,
    blockedUntil,
    unverified: notVerified,
    // Why, when it's the accounts-per-network limit (the ban screen explains it).
    blockReason: grant && grant.networkLimit && !grant.banned && !user.banned ? "network" : null,
    // Where the plan comes from ("free", "paid", "trial", "grant", "member", "admin"), when it
    // ends if it does, and the new-account offer (for the Subscriptions screen).
    planSource: details.source,
    planEndsAt: details.endsAt,
    offer: details.offer || null,
  };
}

export async function creditStatus(kv, ent) {
  const month = monthKey();
  const base = PLAN_TOTALS[ent.plan] || PLAN_TOTALS.free;
  const totals = {};
  for (const t of TIERS) totals[t] = ent.orgId ? base[t] * ent.seats : base[t];
  const usage = ent.orgId
    ? await getJSON(kv, `orgusage:${ent.orgId}:${month}`, {})
    : await getJSON(kv, `usage:${ent.user.id}:${month}`, {});
  const teamUsed = ent.teamId ? Number(await kv.get(`teamusage:${ent.teamId}:${month}`).catch(() => 0)) || 0 : null;
  const tiers = {};
  for (const t of TIERS) {
    const used = t === "aiCode" && teamUsed !== null ? teamUsed : Number(usage[t]) || 0;
    const bonus = Math.max(0, Number(ent.bonus[t]) || 0);
    // Same display rule the app always used: bonus credits add to the total.
    tiers[t] = { total: totals[t] + bonus, used, remaining: Math.max(0, totals[t] - used) + bonus };
  }
  return {
    plan: ent.plan,
    month,
    blocked: ent.blocked,
    ...(ent.unverified ? { unverified: true } : {}),
    ...(ent.blocked && ent.blockReason ? { blockReason: ent.blockReason } : {}),
    ...(ent.blocked ? { blockedUntil: ent.blockedUntil || null } : {}),
    tiers,
    planSource: ent.planSource || "free",
    planEndsAt: ent.planEndsAt || null,
    offer: ent.offer || null,
    ...(ent.orgId ? { seats: ent.seats, shared: true } : {}),
  };
}

// Takes whole credits from the bonus balance first, then the monthly allowance (or the
// team's shared pool for Nebulux Code on a team plan, or the organization's shared pool
// for everything on Enterprise).
// Monitor's per-user activity (questions asked, time on the AI, latest questions) rides
// along in the same monthly usage record, so logging it costs no extra KV write when
// the charge already writes that record. (Base44's AiActivity table was written by a
// Base44 function, which used up the Base44 integration allowance.)
const SESSION_GAP_MS = 30 * 60 * 1000;
function noteActivity(usage, tier, prompt) {
  const a = usage.activity || { prompts: 0, sessions: 0, minutes: 0, first: null, last: null, recent: [] };
  const now = Date.now();
  const last = a.last ? new Date(a.last).getTime() : 0;
  if (last && now - last <= SESSION_GAP_MS) a.minutes += (now - last) / 60000;
  else a.sessions += 1;
  a.prompts += 1;
  a.first = a.first || new Date(now).toISOString();
  a.last = new Date(now).toISOString();
  a.recent = [{ prompt: String(prompt || "").slice(0, 300), bucket: tier, at: a.last }, ...(a.recent || [])].slice(0, 5);
  // Messages per day (UTC), for Monitor's Growth chart.
  const day = a.last.slice(0, 10);
  a.days = { ...(a.days || {}), [day]: ((a.days && a.days[day]) || 0) + 1 };
  usage.activity = a;
}

export async function charge(kv, ent, tier, amount, prompt) {
  let left = Math.max(0, Math.ceil(amount));
  const month = monthKey();
  const fromBonus = Math.min(Math.max(0, Number(ent.bonus[tier]) || 0), left);
  if (fromBonus > 0) {
    ent.bonus[tier] -= fromBonus;
    left -= fromBonus;
    await putJSON(kv, `bonus:${ent.user.id}`, ent.bonus);
  }
  if (left > 0 && ent.orgId) {
    const key = `orgusage:${ent.orgId}:${month}`;
    const pool = await getJSON(kv, key, {});
    pool[tier] = (Number(pool[tier]) || 0) + left;
    await putJSON(kv, key, pool);
    left = 0;
  }
  if (left > 0 && tier === "aiCode" && ent.teamId) {
    const key = `teamusage:${ent.teamId}:${month}`;
    const cur = Number(await kv.get(key).catch(() => 0)) || 0;
    try {
      await kv.put(key, String(cur + left));
    } catch (err) {
      console.error("credits: KV write failed", key, String(err));
    }
    left = 0;
  }
  if (left <= 0 && prompt === undefined) return;
  const key = `usage:${ent.user.id}:${month}`;
  const usage = await getJSON(kv, key, {});
  if (left > 0) usage[tier] = (Number(usage[tier]) || 0) + left;
  if (prompt !== undefined) noteActivity(usage, tier, prompt);
  await putJSON(kv, key, usage);
}

// This month's activity for one user (Monitor), from the usage record above.
export async function activityOf(kv, userId) {
  const usage = await getJSON(kv, `usage:${userId}:${monthKey()}`, {});
  return usage.activity || null;
}

// Adds (or with a negative delta, removes) bonus credits for one AI. Balances never go
// below zero. Used by referral rewards, promo codes and by admins in the Monitor page.
// `once` (e.g. "welcome", "referral:<id>") makes it a one-time grant: it's remembered in the
// balance record itself, so the same grant can't land twice, even from requests sent at the
// same moment that all saw "not claimed yet" (KV has no locks).
export async function adjustBonus(kv, request, user, tier, delta, once) {
  if (!TIERS.includes(tier)) throw new Error("Unknown AI");
  const grant = await getJSON(kv, `grant:${user.id}`, null);
  const b = await syncBonus(kv, request, user, grant);
  if (once) {
    const key = `once:${once}`;
    if (b.applied.includes(key)) return b;
    b.applied.push(key);
  }
  b[tier] = Math.max(0, (Number(b[tier]) || 0) + Math.trunc(Number(delta) || 0));
  await putJSON(kv, `bonus:${user.id}`, b);
  return b;
}

// Gives bonus credits to SOMEONE ELSE (a referrer) during another person's request. It never
// calls syncBonus, which would read promo codes and purchases with the wrong person's sign-in:
// a missing balance is seeded like syncBonus does, and their own next request applies the rest.
export async function giveBonusTo(kv, userId, amounts, once) {
  const key = `bonus:${userId}`;
  let b = await getJSON(kv, key, null);
  if (!b) {
    const grant = await getJSON(kv, `grant:${userId}`, null);
    b = { ai: 0, aiCode: 0, galaxy5: 0, space5: 0, applied: [] };
    if (grant && grant.bonus) for (const t of TIERS) b[t] = Math.max(0, Number(grant.bonus[t]) || 0);
  }
  b.applied = b.applied || [];
  if (b.applied.includes(`once:${once}`)) return false;
  b.applied.push(`once:${once}`);
  for (const t of TIERS) b[t] = Math.max(0, (Number(b[t]) || 0) + Math.trunc(Number(amounts[t]) || 0));
  await putJSON(kv, key, b);
  return true;
}

// Referral upgrade rewards: when someone who joined through a referral link (the sign-up one,
// or a Nebulux Chat invite) starts paying, whoever referred them gets credits of every AI:
// Pro 25 each, Team 50 each, Enterprise 5 each per seat. Once per plan per referred person.
export const UPGRADE_REWARD = { pro: 25, team: 50, enterprise: 5 };
async function rewardReferrers(kv, user, plan, seats) {
  const per = UPGRADE_REWARD[plan];
  if (!per) return;
  const each = plan === "enterprise" ? per * Math.max(1, Number(seats) || 1) : per;
  const seen = `refupgrade:${user.id}:${plan}`;
  if (await kv.get(seen)) return;
  await kv.put(seen, "1");
  const referrers = new Set([await kv.get(`referredby:${user.id}`), await kv.get(`chatreferredby:${user.id}`)].filter((r) => r && r !== user.id));
  const amounts = Object.fromEntries(TIERS.map((t) => [t, each]));
  for (const r of referrers) await giveBonusTo(kv, r, amounts, `${seen}`);
}

// Admin-only: record plan grants, bans/blocks and (for the one-time snapshot) bonus balances.
export async function applyGrant(kv, userId, patch) {
  const key = `grant:${userId}`;
  const grant = await getJSON(kv, key, {});
  for (const f of ["plan", "planExpiresAt", "banned", "blockedUntil", "removed", "networkLimit"]) if (f in patch) grant[f] = patch[f];
  // Unblock / unban in Monitor also lets in an account the accounts-per-network limit stopped.
  if (patch.banned === false && !("networkLimit" in patch)) delete grant.networkLimit;
  // Removed: new accounts with the same email are blocked as well (bans.js emailRemoved).
  if ("removed" in patch && patch.email) {
    const k = removedEmailKey(patch.email);
    if (patch.removed) await kv.put(k, JSON.stringify({ userId, at: new Date().toISOString() }));
    else await kv.delete(k);
  }
  // Accounts the accounts-per-network limit put on hold, for Monitor (Unblock takes them off).
  if ("networkLimit" in patch || (patch.banned === false && grant.networkLimit === undefined)) {
    const held = (await getJSON(kv, "net-held", [])).filter((r) => r.userId !== userId);
    if (patch.networkLimit) held.unshift({ userId, at: new Date().toISOString() });
    await putJSON(kv, "net-held", held.slice(0, 2000));
  }
  // The list Monitor hides removed accounts by (and shows under "Removed accounts").
  if ("removed" in patch) {
    const list = (await getJSON(kv, "removed-users", [])).filter((r) => r.userId !== userId);
    if (patch.removed) list.unshift({ userId, email: String(patch.email || ""), at: new Date().toISOString() });
    await putJSON(kv, "removed-users", list.slice(0, 5000));
  }
  // Enterprise: how many people the organization pays for (the owner counts as one).
  if ("seats" in patch) grant.seats = Math.max(1, Math.min(10000, Math.trunc(Number(patch.seats)) || 1));
  if (patch.bonus && typeof patch.bonus === "object") {
    const b = { ai: 0, aiCode: 0, galaxy5: 0, space5: 0, applied: [] };
    for (const t of TIERS) b[t] = Math.max(0, Number(patch.bonus[t]) || 0);
    grant.bonus = { ...b };
    grant.bonusAsOf = new Date().toISOString();
    await putJSON(kv, `bonus:${userId}`, b);
  }
  await putJSON(kv, key, grant);
  return grant;
}
