// Offline test for Monitor's live parts: who bought what (cloudflare-lib/monitorLive.js, monitor-live)
// and Nebulux Orbit (monitor-orbit). Run: node scripts/test-monitor-live.mjs
import { purchaseSummary, stripeIsLive, liveSummary } from "../cloudflare-lib/monitorLive.js";
import { onRequestPost as liveFn } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/monitor-live.js";
import { onRequestPost as orbitFn } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/monitor-orbit.js";
import { readFileSync } from "node:fs";

let failed = 0;
const assert = (c, m) => {
  console.log((c ? "ok " : "FAIL ") + m);
  if (!c) failed++;
};
const flat = (o) => ({ entity: "Base44Purchase", id: o.id, created_by_id: "x", created_date: o.created_date, updated_date: o.created_date, data: JSON.stringify(o) });
const rows = [
  { id: "a", created_date: "2026-11-08T10:00:00Z", appUserId: "u1", productId: "team", productName: "Team Plan Monthly", status: "paid", provider: "stripe", billing: "monthly", amountCents: 2000, livemode: true, customerId: "cus_secret" },
  { id: "b", created_date: "2026-11-08T11:00:00Z", appUserId: "u1", productId: "pro", productName: "Pro Plan Yearly", status: "paid", provider: "stripe", billing: "yearly", amountCents: 14400 },
  { id: "c", created_date: "2026-11-08T12:00:00Z", appUserId: "u2", productId: "pro", productName: "Pro Plan Monthly", status: "canceled", provider: "stripe", amountCents: 1500 },
  { id: "d", created_date: "2026-11-08T13:00:00Z", appUserId: "u3", productId: "usage-credits", productName: "$25 usage credits", status: "paid", provider: "stripe", amountCents: 2500 },
  { id: "e", created_date: "2026-09-01T13:00:00Z", appUserId: "u4", productId: "pro", productName: "Pro", status: "paid", amount: 15 },
  { id: "f", created_date: "2026-11-08T14:00:00Z", appUserId: "u5", productId: "team", productName: "Team Plan Monthly", status: "processing", provider: "stripe", amountCents: 2000 },
];
const S = purchaseSummary(rows);
assert(S.plans.u1.plan === "team", "someone who bought shows the plan they have, the highest one");
assert(!S.plans.u1.test && S.plans.u4.plan === "pro" && !S.plans.u4.test, "a real payment isn't called a test");
assert(!S.plans.u2, "a canceled plan doesn't count");
assert(!S.plans.u3, "usage credits aren't a plan");
assert(!S.plans.u5, "a bank payment still clearing doesn't give a plan yet");
assert(S.sales.length === 5 && S.sales[0].id === "f", "Stripe sales only, newest first");
assert(S.sales.find((x) => x.id === "b").live === false && S.sales.find((x) => x.id === "a").live === true, "sales from before the sandbox flag count as test money");
assert(S.sales.find((x) => x.id === "d").kind === "usage" && S.sales.find((x) => x.id === "d").plan === null, "usage credits are marked as usage credits");
assert(!JSON.stringify(S).includes("cus_secret"), "Stripe's customer ids stay out of it");
assert(stripeIsLive({ STRIPE_SECRET_KEY: "sk_live_x" }) && stripeIsLive({ STRIPE_SECRET_KEY: "rk_live_x" }), "live keys are seen as live");
assert(!stripeIsLive({ STRIPE_SECRET_KEY: "sk_test_x" }) && !stripeIsLive({}), "test keys and no key are not");

// ---- the endpoints ----
let me = { id: "boss", role: "admin" };
globalThis.fetch = async () => new Response(JSON.stringify(me));
const TABLES = {
  orbit_tokens: [
    { user_id: "o1", name: "Ann", at: 500 },
    { user_id: "o2", name: "Bo", at: 900 },
  ],
  orbit_session_work: [{ user_id: "o1", start: Date.now() - 3600e3, used: 125 }],
  orbit_terms: [
    { user_id: "o1", version: "2026-10-25", at: 1 },
    { user_id: "o2", version: "declined", at: 2 },
  ],
  orbit_connections: [
    { user_id: "o1", provider: "google" },
    { user_id: "o2", provider: "google" },
    { user_id: "o2", provider: "slack" },
  ],
  orbit_ages: [
    { user_id: "o1", birth: "2000-01-01" },
    { user_id: "o2", birth: `${new Date().getUTCFullYear() - 10}-01-01` },
  ],
  orbit_data: [{ user_id: "o1", size: 40, at: 3 }],
  orbit_kv: [
    { k: "nebula", v: "402 out_of_credit", at: 1000 },
    { k: "answered", v: "workers-ai", at: 1001 },
  ],
};
let wrote = 0;
const db = (missing = false) => ({
  prepare: (sql) => {
    if (!/^\s*SELECT/i.test(sql)) wrote++;
    const run = async (a) => {
      if (/FROM rows/.test(sql)) return { results: rows.map(flat) };
      const t = (sql.match(/FROM (\w+)/) || [])[1];
      if (missing && t !== "orbit_tokens") throw new Error("no such table");
      if (/COUNT\(\*\)/.test(sql)) return { results: [{ n: TABLES[t].length }] };
      return { results: TABLES[t] || [], a };
    };
    return { all: () => run([]), bind: (...a) => ({ all: () => run(a) }) };
  },
});
const call = async (fn, env) => {
  const res = await fn({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t" }, body: "{}" }), env });
  return { status: res.status, data: await res.json() };
};
const live = await call(liveFn, { DB: db(), STRIPE_SECRET_KEY: "sk_test_abc" });
assert(live.status === 200 && live.data.plans.u1.plan === "team" && live.data.sales.length === 5, "Monitor gets the plans and the sales");
assert(live.data.stripe.ready === true && live.data.stripe.live === false, "and knows they're test payments");
assert(!JSON.stringify(live.data).includes("sk_test_abc"), "the key itself is never sent");
assert((await liveSummary(db(), {})).stripe.ready === false, "no key: Stripe isn't connected");
const o = await call(orbitFn, { DB: db() });
const ann = o.data.people.find((p) => p.id === "o1"), bo = o.data.people.find((p) => p.id === "o2");
assert(o.status === 200 && o.data.totals.people === 2 && o.data.totals.devices === 2 && o.data.totals.activeNow === 1, "Orbit: people, devices and who's in a session");
assert(o.data.totals.creditsNow === 12.5 && ann.used === 12.5 && ann.resetAt > Date.now(), "credits are read in tenths, the way Orbit saves them");
assert(ann.terms === "accepted" && ann.termsVersion === "2026-10-25" && bo.terms === "declined" && o.data.totals.declined === 1, "terms accepted and declined");
assert(ann.age === "13+" && bo.age === "under 13" && o.data.totals.under13 === 1, "age groups");
assert(!JSON.stringify(o.data).includes("-01-01"), "birthdays are not sent, only the age group");
assert(o.data.apps.google === 2 && o.data.apps.slack === 1 && bo.apps.length === 2, "connected apps");
assert(o.data.people[0].id === "o2", "newest sign-in first");
assert(o.data.nebula.v === "402 out_of_credit" && o.data.answered.v === "workers-ai", "how Nebulux AI last answered Orbit, and which AI answered");
const missing = await call(orbitFn, { DB: db(true) });
assert(missing.status === 200 && missing.data.totals.declined === 0 && missing.data.nebula === null, "a table Orbit hasn't made yet just counts as empty");
assert(wrote === 0, "Monitor only reads");
me = { id: "u1", role: "user" };
assert((await call(liveFn, { DB: db() })).status === 403 && (await call(orbitFn, { DB: db() })).status === 403, "only admins can see either");
const stripeSrc = readFileSync(new URL("../cloudflare-lib/stripe.js", import.meta.url), "utf8");
assert((stripeSrc.match(/livemode: s\.livemode === true/g) || []).length === 3, "plans, Orbit plans and one-time purchases all save whether the payment was real");

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
