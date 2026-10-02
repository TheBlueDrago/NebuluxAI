// Offline test for refer-a-friend (cloudflare-lib/referrals.js through the referrals
// function), with Base44 (fetch) and the KV namespace faked. Run: node scripts/test-referrals.mjs
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
let me = null;
globalThis.fetch = async (url) => {
  const p = new URL(String(url)).pathname;
  if (p.endsWith("/entities/User/me")) return new Response(JSON.stringify(me));
  if (p.endsWith("/functions/my-team")) return new Response("{}");
  return new Response("[]");
};

const { onRequestPost } = await import(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/referrals.js");
const { revokeReferral } = await import(R + "cloudflare-lib/referrals.js");
const C = await import(R + "cloudflare-lib/credits.js");
const req = new Request("https://x/", { headers: { authorization: "Bearer t" } });
const call = async (user, body, ip = "1.2.3.4") => {
  me = user;
  const r = await onRequestPost({
    request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "cf-connecting-ip": ip }, body: JSON.stringify(body) }),
    env: { PUBLISHED_HTML: kv },
  });
  return [r.status, await r.json()];
};
const bonusAi = async (id) => (await C.creditStatus(kv, await C.entitlement(kv, req, { id }))).tiers;

const now = new Date().toISOString();
const referrer = { id: "ref", email: "ref@x.com", created_date: "2020-01-01T00:00:00Z" };
const newbie = { id: "new1", email: "new1@x.com", full_name: "New One", created_date: now };

let [s, b] = await call(referrer, { action: "get" });
const code = b.code;
assert(s === 200 && /^[a-z0-9]{4,16}$/.test(code) && b.link.includes(`ref=${code}`), "referrer gets a code and link");
[, b] = await call(referrer, { action: "get" });
assert(b.code === code, "the code is permanent");

[s] = await call(referrer, { action: "join", code });
assert(s === 400, "can't refer yourself");
[s] = await call({ id: "old", email: "old@x.com", created_date: "2020-01-01T00:00:00Z" }, { action: "join", code });
assert(s === 400, "old accounts can't join through a link");
[s] = await call(newbie, { action: "join", code: "nope1234" });
assert(s === 400, "unknown code refused");
[s, b] = await call(newbie, { action: "join", code });
assert(s === 200 && b.ok, "a brand-new account joins");
[s] = await call(newbie, { action: "join", code });
assert(s === 400, "can't join twice");
[s] = await call({ id: "new2", email: "NEW1@x.com", created_date: now }, { action: "join", code });
assert(s === 400, "an email that was already referred can't be reused");

[s, b] = await call(referrer, { action: "claim", referredId: "new1", tier: "ai" });
assert(s === 200 && b.referrals[0].reward.amount === 25 && (await bonusAi("ref")).ai.total === 20 + 25, "referrer claims 25 AI credits");
[s] = await call(referrer, { action: "claim", referredId: "new1", tier: "space5" });
assert(s === 400, "a referral's reward can be claimed only once");
[s, b] = await call(newbie, { action: "claim-welcome", tier: "aiCode" });
assert(s === 200 && (await bonusAi("new1")).aiCode.total === 20 + 15, "the new user claims a welcome bonus");
[s] = await call(newbie, { action: "claim-welcome", tier: "ai" });
assert(s === 400, "the welcome bonus is claimed once");

await revokeReferral(kv, req, { id: "ref" }, "new1");
const [refT, newT] = [await bonusAi("ref"), await bonusAi("new1")];
assert(refT.ai.total === 20 && newT.aiCode.total === 20, "taking a referral back removes both rewards");
[, b] = await call(referrer, { action: "get" });
assert(b.referrals[0].revoked === true && !("net" in b.referrals[0]), "referrer sees it as taken back (and no network fingerprint)");

// Claiming the same bonus many times at once still pays it once (adjustBonus "once" keys).
{
  const C = await import(R + "cloudflare-lib/credits.js");
  const u = { id: "race1" };
  await Promise.all(Array.from({ length: 10 }, () => C.adjustBonus(kv, req, u, "ai", 25, "welcome")));
  await C.adjustBonus(kv, req, u, "ai", 25, "welcome");
  const b = JSON.parse(store.get("bonus:race1"));
  assert(b.pool === 25, "the same one-time grant lands once, even when sent many times at once: " + b.pool);
  await C.adjustBonus(kv, req, u, "ai", 5, "referral:x");
  await C.adjustBonus(kv, req, u, "ai", 5);
  await C.adjustBonus(kv, req, u, "ai", 5);
  assert(JSON.parse(store.get("bonus:race1")).pool === 40, "different grants and plain admin changes still add up");
}
