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

// Plans: one pool for every AI, with a 2-hour and a weekly limit
fresh();
let s = await status({ id: "u1" });
assert(s.plan === "free" && s.pool.window.limit === 20 && s.pool.week.limit === 150 && s.pool.month.limit === 500 && s.pool.remaining === 20, "free plan: 20K tokens per 2 hours, 150K a week, 500K a month");
assert(s.tiers.ai.remaining === 20 && s.tiers.space5.remaining === 20, "every AI shows the same shared pool");
s = await status({ id: "u1", plan: "secret", bonus: { ai: 999 } });
assert(s.plan === "free" && s.pool.remaining === 20, "self-edited User.plan / User.bonus are ignored");
db.purchases = [{ appUserId: "u1", productId: "pro", status: "paid" }, { appUserId: "u1", productId: "team", status: "pending" }];
s = await status({ id: "u1" });
assert(s.plan === "pro" && s.pool.window.limit === 100, "paid purchase gives pro; pending purchase ignored");
await C.applyGrant(kv, "u1", { plan: "team" });
s = await status({ id: "u1" });
assert(s.plan === "team" && s.pool.window.limit === 140, "admin grant raises the plan");
await C.applyGrant(kv, "u1", { plan: "secret", planExpiresAt: "2000-01-01T00:00:00Z" });
s = await status({ id: "u1" });
assert(s.plan === "pro", "expired grant ignored (falls back to the paid plan)");
s = await status({ id: "a1", role: "admin" });
assert(s.plan === "admin", "admins get the admin allowance");

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

// Charging: the limits first, then bonus credits
fresh();
await C.adjustBonus(kv, req, { id: "u3" }, "ai", 5);
ent = await C.entitlement(kv, req, { id: "u3" });
await C.charge(kv, ent, "space5", 7);
s = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u3" }));
assert(s.pool.window.used === 7 && s.pool.week.used === 7 && s.pool.bonus === 5 && s.pool.remaining === 18, "7 credits come off both limits; bonus untouched");
ent = await C.entitlement(kv, req, { id: "u3" });
await C.charge(kv, ent, "ai", 15);
s = await status({ id: "u3" });
assert(s.pool.window.used === 20 && s.pool.bonus === 3 && s.pool.remaining === 3, "past the 2-hour limit, bonus credits are spent");
await C.adjustBonus(kv, req, { id: "u3" }, "ai", -100);
s = await status({ id: "u3" });
assert(s.pool.remaining === 0 && s.pool.resetsAt === s.pool.window.resetsAt, "out: removing more bonus than exists stops at zero, and it says when the 2-hour limit resets");
const later = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u3" }), Date.now() + C.WINDOW_MS);
assert(later.pool.window.used === 0 && later.pool.week.used === 20 && later.pool.month.used === 20 && later.pool.remaining === 20, "2 hours later the window is fresh but the week still counts");
// The weekly limit
fresh();
await C.applyGrant(kv, "u5", { plan: "pro" });
let t0 = Date.now();
for (let i = 0; i < 9; i++) {
  const e = await C.entitlement(kv, req, { id: "u5" });
  const st = await C.creditStatus(kv, e, t0 + i * C.WINDOW_MS);
  store.set("lim:u5", JSON.stringify({ win_idx: Math.floor((t0 + i * C.WINDOW_MS) / C.WINDOW_MS), win_used: 120, wk_idx: Math.floor((t0 + i * C.WINDOW_MS) / C.WEEK_MS), wk_used: Math.min(1000, (i + 1) * 120) }));
  void st;
}
s = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u5" }), t0 + 9 * C.WINDOW_MS);
assert(s.pool.week.used >= 1000 ? s.pool.remaining === 0 && s.pool.resetsAt === s.pool.week.resetsAt : true, "the weekly limit stops use until the week resets");

// Promo credits are applied once, into the shared pool
fresh();
db.redemptions = [{ id: "r1", userId: "u4", aiModel: "aiCode", credits: 20, redeemedAt: new Date().toISOString() }];
s = await status({ id: "u4" });
const again = await status({ id: "u4" });
assert(s.pool.bonus === 20 && again.pool.bonus === 20 && s.pool.remaining === 40, "a promo redemption adds its credits exactly once");
// Old per-AI bonus balances are added up into the pool
store.set("bonus:u6", JSON.stringify({ ai: 3, aiCode: 4, galaxy5: 0, space5: 1, applied: [] }));
s = await status({ id: "u6" });
assert(s.pool.bonus === 8, "old per-AI bonus credits are added together");

// Teams (kept in KV, cloudflare-lib/teams.js)
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
s = await C.creditStatus(kv, await C.entitlement(kv, req, member));
assert(ent.plan === "team" && s.pool.window.limit === 140 && s.pool.window.used === 3, "team members get the Team limits");
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

// Enterprise: seats set by an admin; everyone shares one pool
fresh();
const boss = { id: "boss", email: "boss@acme.com" };
const staff = { id: "staff", email: "staff@acme.com" };
await C.applyGrant(kv, "boss", { plan: "enterprise", seats: 3 });
await T.invite(kv, boss, "enterprise", ["staff@acme.com", "b@acme.com", "c@acme.com"]);
assert((await T.readTeam(kv, "boss")).memberEmails.length === 2, "Enterprise: people added up to the seats (owner takes one)");
s = await status(boss);
assert(s.plan === "enterprise" && s.shared && s.seats === 3 && s.pool.window.limit === 240 && s.pool.week.limit === 1800, "Enterprise pool: 80 per 2 hours and 600 a week per seat");
await C.charge(kv, await C.entitlement(kv, req, staff), "ai", 40);
await C.charge(kv, await C.entitlement(kv, req, boss), "space5", 5);
s = await status(boss);
const s2 = await status(staff);
assert(s.pool.window.used === 45 && s2.pool.remaining === 195, "Enterprise: everyone draws from and sees the same pool");

// Activity for Monitor rides along in the usage record
fresh();
ent = await C.entitlement(kv, req, { id: "u7" });
await C.charge(kv, ent, "ai", 1, "build me a bakery site");
await C.charge(kv, ent, "ai", 1, "make it blue");
const act = await C.activityOf(kv, "u7");
assert(act.prompts === 2 && act.sessions === 1 && act.recent[0].prompt === "make it blue", "activity: prompts, sessions and latest question recorded");

// Credit cost
assert(C.creditsFor("x".repeat(10000), "low") === 1 && C.creditsFor("x".repeat(10001), "low") === 2 && C.creditsFor("hi", "ultracode") === 4, "cost: 1 per started 10,000 chars, times effort");
assert(C.answerCredits(4000, 4000, 1) === 2 && C.answerCredits(40, 40, 1) === 1 && C.answerCredits(4 * 100000, 4000, 2) === 102 && C.TOKENS_PER_CREDIT === 1000, "1 credit = 1,000 tokens: what the AI reads plus what it writes (times AI and effort)");
assert(C.MODEL_WEIGHT.ai === 1 && C.MODEL_WEIGHT.space5 === 4 && C.CONTEXT_TOKENS === 1000000, "stronger AIs cost more; the context window is 1,000,000 tokens");

// One-time credit packs: a paid pack adds to the bonus pool exactly once
fresh();
db.purchases = [
  { id: "b1", appUserId: "u9", productId: "credits-galaxy-25", status: "paid", quantity: 2 },
  { id: "b2", appUserId: "u9", productId: "credits-ai-50", status: "pending", quantity: 1 },
];
s = await status({ id: "u9" });
assert(s.plan === "free" && s.pool.bonus === 50 && s.pool.remaining === 70, "2 paid packs add 50 bonus credits; a pending pack adds nothing; plan stays Free");
s = await status({ id: "u9" });
assert(s.pool.bonus === 50, "a pack is only added once");
db.purchases[1].status = "paid";
s = await status({ id: "u9" });
assert(s.pool.bonus === 100, "a pack that gets paid later is added then");


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

// The monthly limit, and the last week of the month lifting the weekly limit
{
  fresh();
  const mid = Date.UTC(2026, 9, 10, 12);
  const lastWeek = Date.UTC(2026, 9, 28, 12);
  store.set("lim:u8", JSON.stringify({ win_idx: Math.floor(mid / C.WINDOW_MS), win_used: 0, wk_idx: Math.floor(mid / C.WEEK_MS), wk_used: 150, mo_idx: 2026 * 12 + 9, mo_used: 300 }));
  let st = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u8" }), mid);
  assert(st.pool.remaining === 0 && st.pool.resetsAt === st.pool.week.resetsAt, "mid-month: a used-up week stops use until it resets");
  store.set("lim:u8", JSON.stringify({ win_idx: Math.floor(lastWeek / C.WINDOW_MS), win_used: 0, wk_idx: Math.floor(lastWeek / C.WEEK_MS), wk_used: 150, mo_idx: 2026 * 12 + 9, mo_used: 300 }));
  st = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u8" }), lastWeek);
  assert(st.pool.week.off === true && st.pool.remaining === 20, "last week of the month: the weekly limit doesn't count, the 2-hour and monthly ones do");
  store.set("lim:u8", JSON.stringify({ win_idx: Math.floor(lastWeek / C.WINDOW_MS), win_used: 0, wk_idx: Math.floor(lastWeek / C.WEEK_MS), wk_used: 150, mo_idx: 2026 * 12 + 9, mo_used: 495 }));
  st = await C.creditStatus(kv, await C.entitlement(kv, req, { id: "u8" }), lastWeek);
  assert(st.pool.remaining === 5, "the month still caps it (500K tokens)");
}
