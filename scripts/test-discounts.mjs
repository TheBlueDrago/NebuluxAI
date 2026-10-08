// Offline test for discount promo codes (cloudflare-lib/promos.js and discounts.js), with
// Base44 (fetch) and the KV namespace faked. Run: node scripts/test-discounts.mjs
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
let purchases = [];
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  const qp = u.searchParams.get("q") ? JSON.parse(u.searchParams.get("q")) : {};
  let body = [];
  if (u.pathname.endsWith("/entities/Base44Purchase")) body = purchases.filter((x) => x.appUserId === qp.appUserId);
  return new Response(JSON.stringify(body), { status: 200 });
};
const P = await import(R + "cloudflare-lib/promos.js");
const D = await import(R + "cloudflare-lib/discounts.js");
const req = new Request("https://x/", { headers: { authorization: "Bearer t" } });
const fails = async (p, text) => {
  try {
    await p;
    return false;
  } catch (e) {
    return !text || String(e.message).includes(text);
  }
};

// Prices
assert(D.discountedPrice(5, 20) === 4 && D.discountedPrice(1, 30) === 0.7, "20% off $5 is $4; 30% off $1 is $0.70");
assert(D.discountedPrice(1, 90) === 0.5 && D.discountedPrice(4, 100) === 0.5, "never below the $0.50 payment minimum");
assert(D.discountApplies("all", "pro") && D.discountApplies("all", "credits-space-50") && !D.discountApplies("all", "enterprise"), "'everything' covers plans and packs");
assert(D.discountApplies("plans", "team") && !D.discountApplies("plans", "credits-ai-10"), "'all plans' is plans only");
assert(D.discountApplies("credits-galaxy", "credits-galaxy-25") && !D.discountApplies("credits-galaxy", "credits-space-25"), "one AI's packs");

// Admin creates codes
store.set("promos", "[]");
await P.createPromo(kv, req, { code: "save20", kind: "discount", pct: 20, target: "plans", maxUses: 2 });
assert(await fails(P.createPromo(kv, req, { code: "FREE10", aiModel: "ai", credits: 10 }), "percentage off"), "free-credit codes can't be made any more");
assert(await fails(P.createPromo(kv, req, { code: "BAD", kind: "discount", pct: 0 }), "between 1% and 100%"), "a 0% discount is refused");
assert(await fails(P.createPromo(kv, req, { code: "BAD2", kind: "discount", pct: 10, target: "nope" })), "an unknown target is refused");

// Checking and claiming
const a = { id: "ua" }, b = { id: "ub" }, c = { id: "uc" };
let d = await P.checkDiscount(kv, req, a, "save20", "pro");
assert(d.pct === 20 && d.target === "plans", "the code is 20% off plans");
assert(await fails(P.checkDiscount(kv, req, a, "SAVE20", "credits-ai-10"), "only for"), "not for credit packs");
const r = await P.redeemPromo(kv, req, a, "save20");
assert(r.kind === "discount" && r.pct === 20, "redeeming a discount code in the Shop just returns the discount");
await P.checkDiscount(kv, req, a, "SAVE20", "pro", { claim: true });
await P.checkDiscount(kv, req, a, "SAVE20", "team", { claim: true });
await P.checkDiscount(kv, req, b, "SAVE20", "pro", { claim: true });
let list = await P.readPromos(kv);
assert(list.find((p) => p.code === "SAVE20").usedBy.length === 2, "claims count people, not tries");
assert(await fails(P.checkDiscount(kv, req, c, "SAVE20", "pro"), "used up"), "a third person can't use a 2-use code");
purchases = [{ appUserId: "ua", status: "paid", productName: "Pro Plan (promo SAVE20)" }];
assert(await fails(P.checkDiscount(kv, req, a, "SAVE20", "team"), "already used"), "someone who paid with the code can't use it again");

// Ending, deactivating, and the free-credit codes still working
await P.createPromo(kv, req, { code: "OLD", kind: "discount", pct: 50, target: "all", expiresAt: "2000-01-01" });
assert(await fails(P.checkDiscount(kv, req, c, "OLD", "pro"), "ended"), "an ended code is refused");
list = await P.readPromos(kv);
await P.updatePromo(kv, req, { id: list.find((p) => p.code === "SAVE20").id, active: false, pct: 30 });
assert(await fails(P.checkDiscount(kv, req, c, "SAVE20", "pro"), "not valid"), "an inactive code is refused");
assert((await P.readPromos(kv)).find((p) => p.code === "SAVE20").pct === 30, "admins can change the %");
assert(await fails(P.checkDiscount(kv, req, c, "FREE10", "pro"), "not valid"), "a free-credit code isn't a discount");
assert(await fails(P.redeemPromo(kv, req, c, "FREE10"), "not valid"), "free-credit codes don't give credits any more");

// Guessing codes with many accounts from one network: only wrong codes count, per network.
{
  // Counted per clock hour: pin the clock just after the hour so the run stays in one.
  const realNow = Date.now;
  const pinned = Math.floor(realNow() / 3600000) * 3600000 + 60000;
  Date.now = () => pinned;
  const cache = new Map();
  globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
  const baseFetch = globalThis.fetch;
  let me = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/entities/User/me")) return new Response(JSON.stringify({ id: `guesser${me}`, role: "user" }));
    return baseFetch(url, init);
  };
  const F = R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/";
  const endpoint = async (name, body, ip = "7.7.7.7") => {
    const { onRequestPost } = await import(F + name + ".js");
    const request = new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body) });
    const res = await onRequestPost({ request, env: { PUBLISHED_HTML: kv } });
    return res.status;
  };
  let last;
  for (let i = 0; i < 30; i++) {
    me = Math.floor(i / 5); // a new account every 5 guesses, under the per-account limit
    last = await endpoint("redeem-promo", { code: `GUESS${i}` });
  }
  assert(last === 400, "30 wrong codes from one network are answered normally");
  me = 99;
  assert((await endpoint("redeem-promo", { code: "GUESS31" })) === 429, "the 31st wrong code from that network is refused, even on a new account");
  assert((await endpoint("redeem-promo", { code: "GUESS32" }, "8.8.8.8")) === 400, "another network isn't affected");

  cache.clear();
  // Credit codes are single-use, so a class shares a discount code.
  await P.createPromo(kv, req, { code: "CLASS10", kind: "discount", pct: 10, target: "all" });
  let ok = 0;
  for (let i = 0; i < 40; i++) {
    me = 200 + i;
    if ((await endpoint("redeem-promo", { code: "CLASS10" })) === 200) ok++;
  }
  assert(ok === 40, "a whole class redeeming the right code from one network isn't limited");

  cache.clear();
  for (let i = 0; i < 30; i++) {
    me = 300 + Math.floor(i / 5);
    await endpoint("promo-discount", { code: `NOPE${i}`, productId: "pro" });
  }
  me = 399;
  assert((await endpoint("promo-discount", { code: "NOPE31", productId: "pro" })) === 429, "the Shop's code check has the same per-network cap");
  let claimStatus = 0;
  for (let i = 0; i < 25; i++) {
    me = 400 + i;
    claimStatus = await endpoint("promo-discount", { code: `CLAIM${i}`, productId: "pro", claim: true });
  }
  assert(claimStatus === 400, "checkout's claims are counted apart, with a higher cap (Base44's servers share one network)");
  globalThis.fetch = baseFetch;
  Date.now = realNow;
}
