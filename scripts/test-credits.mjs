// Offline test for the server-side credit rules in cloudflare-lib/credits.js, with
// Base44 (fetch) and the KV namespace faked. Run: node scripts/test-credits.mjs
const R = new URL("../", import.meta.url).pathname;
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

const store = new Map();
const kv = {
  get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : null),
  put: async (k, v) => store.set(k, String(v)),
  delete: async (k) => store.delete(k),
};

// What Base44 answers, per test.
let db = { purchases: [], redemptions: [], team: null };
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  const p = u.pathname;
  const qp = u.searchParams.get("q") ? JSON.parse(u.searchParams.get("q")) : {};
  let body = [];
  if (p.endsWith("/entities/Base44Purchase")) body = db.purchases.filter((x) => x.appUserId === qp.appUserId);
  else if (p.endsWith("/entities/PromoRedemption")) body = db.redemptions.filter((x) => x.userId === qp.userId);
  else if (p.endsWith("/functions/my-team")) body = { team: db.team };
  else if (p.endsWith("/entities/Team")) body = [];
  return new Response(JSON.stringify(body), { status: 200 });
};

const C = await import(R + "cloudflare-lib/credits.js");
const req = new Request("https://x/", { headers: { authorization: "Bearer t" } });
const status = async (user, opts) => C.creditStatus(kv, await C.entitlement(kv, req, user, opts));
const fresh = () => {
  store.clear();
  db = { purchases: [], redemptions: [], team: null };
};

// Plans
fresh();
let s = await status({ id: "u1" });
assert(s.plan === "free" && s.tiers.ai.total === 100 && s.tiers.aiCode.total === 75 && s.tiers.galaxy5.total === 50 && s.tiers.space5.remaining === 25, "free plan: 100 AI, 75 Code, 50 Galaxy, 25 Space");
s = await status({ id: "u1", plan: "secret", bonus: { ai: 999 } });
assert(s.plan === "free" && s.tiers.ai.total === 100, "self-edited User.plan / User.bonus are ignored");
db.purchases = [{ appUserId: "u1", productId: "pro", status: "paid" }, { appUserId: "u1", productId: "team", status: "pending" }];
s = await status({ id: "u1" });
assert(s.plan === "pro" && s.tiers.aiCode.total === 50 && s.tiers.ai.total === 100, "paid purchase gives pro; pending purchase ignored");
await C.applyGrant(kv, "u1", { plan: "team" });
s = await status({ id: "u1" });
assert(s.plan === "team" && s.tiers.aiCode.total === 100, "admin grant raises the plan");
await C.applyGrant(kv, "u1", { plan: "secret", planExpiresAt: "2000-01-01T00:00:00Z" });
s = await status({ id: "u1" });
assert(s.plan === "pro", "expired grant ignored (falls back to the paid plan)");
s = await status({ id: "a1", role: "admin" });
assert(s.plan === "free", "admins are on Free like everyone else unless given a plan (owner, 2026-10-07)");

// Bans
fresh();
await C.applyGrant(kv, "u2", { banned: true });
let ent = await C.entitlement(kv, req, { id: "u2" });
assert(ent.blocked === true, "admin ban blocks");
fresh();
await C.applyGrant(kv, "u2", { blockedUntil: new Date(Date.now() + 3600e3).toISOString() });
assert((await C.entitlement(kv, req, { id: "u2" })).blocked === true, "temporary block active");
await C.applyGrant(kv, "u2", { blockedUntil: new Date(Date.now() - 1000).toISOString() });
assert((await C.entitlement(kv, req, { id: "u2" })).blocked === false, "expired block lifted");

// Charging: bonus first, then the monthly allowance
fresh();
await C.adjustBonus(kv, req, { id: "u3" }, "ai", 5);
ent = await C.entitlement(kv, req, { id: "u3" });
await C.charge(kv, ent, "ai", 7);
s = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u3" }));
assert(s.tiers.ai.used === 2 && s.tiers.ai.remaining === 98 && s.tiers.ai.total === 100, "7 credits: 5 from bonus, 2 from the allowance");
await C.adjustBonus(kv, req, { id: "u3" }, "ai", -100);
s = await status({ id: "u3" });
assert(s.tiers.ai.remaining === 98, "removing more bonus than exists stops at zero");
ent = await C.entitlement(kv, req, { id: "u3" });
await C.charge(kv, ent, "ai", 200);
s = await status({ id: "u3" });
assert(s.tiers.ai.remaining === 0, "remaining never goes below zero");

// Promo credits are applied once
fresh();
db.redemptions = [{ id: "r1", userId: "u4", aiModel: "aiCode", credits: 20, redeemedAt: new Date().toISOString() }];
s = await status({ id: "u4" });
const again = await status({ id: "u4" });
assert(s.tiers.aiCode.total === 95 && again.tiers.aiCode.total === 95, "a promo redemption adds its credits exactly once");

// Team (kept in KV, cloudflare-lib/teams.js): Nebulux Code uses the owner's shared pool
fresh();
const T = await import(R + "cloudflare-lib/teams.js");
const owner = { id: "own", email: "owner@x.com" };
const member = { id: "mem", email: "member@x.com" };
await C.applyGrant(kv, "own", { plan: "team" });
await T.invite(kv, owner, "team", ["Member@x.com", "a@x.com", "b@x.com"]);
const team = await T.readTeam(kv, "own");
assert(team.memberEmails.length === 2 && team.memberEmails[0] === "member@x.com", "team invite: emails cleaned, capped at 2 for Team");
ent = await C.entitlement(kv, req, member);
await C.charge(kv, ent, "aiCode", 3);
s = await C.creditStatus(kv, await C.entitlement(kv, req, owner));
assert(ent.plan === "team" && s.tiers.aiCode.used === 3 && store.get("teamusage:own:" + s.month) === "3", "team members share the owner's Nebulux Code pool");
const mt = await T.myTeam(kv, member, "free", 3);
assert(mt && mt.active && !mt.isOwner && mt.ownerPlan === "team", "my-team shape for a member");
await T.leave(kv, member);
assert((await C.entitlement(kv, req, member)).plan === "free", "a member who leaves is back on free");
await T.invite(kv, owner, "team", ["member@x.com"]);
const stale = await T.readTeam(kv, "own");
stale.ownerPlan = "free";
await T.saveTeam(kv, stale);
assert((await C.entitlement(kv, req, member)).plan === "free", "no team access once the owner's plan is gone");
assert((await T.myTeam(kv, owner, "team", 0)).cap === 2, "Team: the owner can add 2 people (3 in total)");

// Enterprise: seats set by an admin; every kind of credit comes from one shared pool
fresh();
const boss = { id: "boss", email: "boss@acme.com" };
const staff = { id: "staff", email: "staff@acme.com" };
await C.applyGrant(kv, "boss", { plan: "enterprise", seats: 3 });
await T.invite(kv, boss, "enterprise", ["staff@acme.com", "b@acme.com", "c@acme.com"]);
assert((await T.readTeam(kv, "boss")).memberEmails.length === 2, "Enterprise: people added up to the seats (owner takes one)");
s = await status(boss);
assert(s.plan === "enterprise" && s.shared && s.seats === 3 && s.tiers.ai.total === 300 && s.tiers.aiCode.total === 225 && s.tiers.galaxy5.total === 150 && s.tiers.space5.total === 75, "Enterprise pool: 100/75/50/25 per seat");
await C.charge(kv, await C.entitlement(kv, req, staff), "ai", 40);
await C.charge(kv, await C.entitlement(kv, req, boss), "space5", 5);
s = await status(boss);
const s2 = await status(staff);
assert(s.tiers.ai.used === 40 && s.tiers.ai.remaining === 260 && s2.tiers.ai.remaining === 260 && s2.tiers.space5.used === 5, "Enterprise: everyone draws from and sees the same pool");

// Activity for Monitor rides along in the usage record
fresh();
ent = await C.entitlement(kv, req, { id: "u7" });
await C.charge(kv, ent, "ai", 1, "build me a bakery site");
await C.charge(kv, ent, "ai", 1, "make it blue");
const act = await C.activityOf(kv, "u7");
assert(act.prompts === 2 && act.sessions === 1 && act.recent[0].prompt === "make it blue", "activity: prompts, sessions and latest question recorded");

// Credit cost
assert(C.creditsFor("x".repeat(10000), "low") === 1 && C.creditsFor("x".repeat(10001), "low") === 2 && C.creditsFor("hi", "ultracode") === 4, "cost: 1 per started 10,000 chars, times effort");

// One-time credit packs: a paid pack adds to the bonus balance exactly once
fresh();
db.purchases = [
  { id: "b1", appUserId: "u9", productId: "credits-galaxy-25", status: "paid", quantity: 2 },
  { id: "b2", appUserId: "u9", productId: "credits-ai-50", status: "pending", quantity: 1 },
];
s = await status({ id: "u9" });
assert(s.plan === "free" && s.tiers.galaxy5.remaining === 100 && s.tiers.ai.remaining === 100, "2 paid Galaxy packs add 50 Galaxy credits (on top of Free's 50); a pending pack adds nothing; plan stays Free");
s = await status({ id: "u9" });
assert(s.tiers.galaxy5.remaining === 100, "a pack is only added once");
ent = await C.entitlement(kv, req, { id: "u9" });
await C.charge(kv, ent, "galaxy5", 10);
db.purchases[1].status = "paid";
s = await status({ id: "u9" });
assert(s.tiers.galaxy5.remaining === 90 && s.tiers.ai.remaining === 150, "spending uses bought credits; a pack that gets paid later is added then");

// Settings → Download my data asks for this month's activity record: your own, and only yours.
{
  const month = new Date().toISOString().slice(0, 7);
  const key = Object.keys(Object.fromEntries(store)).find((k) => k.startsWith("usage:u9:")) || `usage:u9:${month}`;
  const rec = JSON.parse(store.get(key) || "{}");
  rec.activity = { prompts: 2, recent: [{ prompt: "make a cat game", at: "x" }] };
  store.set(key, JSON.stringify(rec));
  store.set(key.replace("u9", "someone"), JSON.stringify({ activity: { prompts: 9, recent: [{ prompt: "secret" }] } }));
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).endsWith("/entities/User/me") ? new Response(JSON.stringify({ id: "u9", role: "user" })) : baseFetch(url, init));
  const { onRequest } = await import(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/credits.js");
  const request = new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ action: "my-activity" }) });
  const res = await onRequest({ request, env: { PUBLISHED_HTML: kv } });
  const data = await res.json();
  assert(res.status === 200 && data.activity && data.activity.prompts === 2 && data.activity.recent[0].prompt === "make a cat game", "your own activity record can be downloaded");
  assert(!JSON.stringify(data).includes("secret"), "and nobody else's");
  const plain = await onRequest({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: "{}" }), env: { PUBLISHED_HTML: kv } });
  assert((await plain.json()).tiers, "a normal credits call still returns the credit status");
  globalThis.fetch = baseFetch;
}
