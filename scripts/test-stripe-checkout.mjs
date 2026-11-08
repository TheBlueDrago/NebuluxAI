// Offline test of Stripe checkout for Pro and Team (cloudflare-lib/stripe.js, create-checkout, the webhook):
// the right price for every plan and billing period, the server's price and not the browser's, the full
// address, safe return paths, only signed webhooks give a plan, and bank payments wait until they clear.
// Run: node scripts/test-stripe-checkout.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const load = (p) => import(pathToFileURL(R + p).href);
const FN = "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/";
const P = await load("cloudflare-lib/planPrices.js");
const S = await load("cloudflare-lib/stripe.js");
const { PUBLIC_PLANS } = await load("src/lib/publicPlans.js");

// ---- prices ----
assert(P.YEARLY_OFF === 20, "yearly is 20% off");
assert(P.yearlyTotal(15) === 144 && P.yearlyTotal(20) === 192, "twelve months less 20%: Pro $144, Team $192");
assert(P.yearlyPerMonth(15) === 12 && P.yearlyPerMonth(20) === 16, "that's $12 and $16 a month");
assert(P.yearlyPerMonth(15.87) === Math.round((P.yearlyTotal(15.87)) / 12) && Number.isInteger(P.yearlyTotal(15.87)), "a price that isn't whole gets rounded");
assert(P.planLabel("team", "monthly") === "Team Plan Monthly" && P.planLabel("pro", "yearly") === "Pro Plan Yearly", "the names Stripe shows");
for (const [id, y, m] of [["pro", "$144", "$12"], ["team", "$192", "$16"]]) {
  const p = PUBLIC_PLANS.find((x) => x.id === id);
  assert(p.yearly.price === y && p.yearly.perMonth === m, `the ${id} card shows ${m} a month, ${y} a year`);
}
assert(!P.isPlan("enterprise") && !P.isPlan("constructor") && !P.isPlan("free"), "only Pro and Team can be bought here");

// ---- a fake Stripe, sign-in and database ----
const DB = new Map(), BAL = new Map();
const balance = (id) => (BAL.get(id) || 0) / 100000;
const prepare = (sql) => ({
  run: async () => ({}),
  bind: (...a) => ({
    all: async () => ({ results: [...DB.values()].filter((r) => r.entity === a[0]) }),
    first: async () => (/usage_credits/.test(sql) ? (BAL.has(a[0]) ? { balance: BAL.get(a[0]), daily_limit: null, day: null, spent_today: 0 } : null) : DB.get(a[0] + "/" + a[1]) || null),
    run: async () => {
      if (/usage_credits/.test(sql)) {
        if (/^INSERT/.test(sql)) BAL.set(a[0], (BAL.get(a[0]) || 0) + a[1]);
      } else if (/^INSERT/.test(sql)) {
        const k = a[0] + "/" + a[1];
        if (DB.has(k)) throw new Error("UNIQUE constraint failed");
        DB.set(k, { entity: a[0], id: a[1], created_by_id: a[2], created_date: a[3], updated_date: a[4], data: a[5] });
      } else if (/^UPDATE/.test(sql)) {
        const r = DB.get(a[2] + "/" + a[3]);
        r.data = a[0];
        r.updated_date = a[1];
      } else throw new Error("unexpected SQL " + sql);
      return {};
    },
  }),
});
const db = { prepare };
const rows = () => [...DB.values()].filter((r) => r.entity === "Base44Purchase").map((r) => ({ id: r.id, by: r.created_by_id, ...JSON.parse(r.data) }));
let sent = [], stripeFails = false;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("/entities/User/me")) return new Response(JSON.stringify({ id: "u1", email: "a@b.co", full_name: "Ann", role: "user", created_date: "2026-01-01T00:00:00Z" }));
  if (u.startsWith("https://api.stripe.com/")) {
    if (stripeFails) return new Response('{"error":{"message":"nope"}}', { status: 400 });
    sent.push({ url: u, auth: init.headers.Authorization, form: Object.fromEntries(new URLSearchParams(init.body || "")) });
    return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1", id: "cs_test_1" }));
  }
  return new Response("{}");
};
const cache = new Map();
globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
const store = new Map();
const kv = { get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : null), put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) };
const ENV = { PUBLISHED_HTML: kv, DB: db, STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };
const { onRequestPost: checkout } = await load(FN + "create-checkout.js");
const call = async (body, env = ENV, auth = "Bearer t") => {
  sent = [];
  const r = await checkout({ request: new Request("https://nebuluxai.com/x", { method: "POST", headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" }, body: JSON.stringify(body) }), env, waitUntil: () => {} });
  return [r.status, await r.json().catch(() => ({})), sent[0] && sent[0].form];
};

// ---- every plan ----
for (const [plan, billing, cents, name, interval] of [["pro", "monthly", "1500", "Pro Plan Monthly", "month"], ["pro", "yearly", "14400", "Pro Plan Yearly", "year"], ["team", "monthly", "2000", "Team Plan Monthly", "month"], ["team", "yearly", "19200", "Team Plan Yearly", "year"]]) {
  const [s, b, f] = await call({ productId: plan, billing, from: "/chat/designer", back: "/chat/shop" });
  assert(s === 200 && b.redirectUrl.startsWith("https://checkout.stripe.com/"), `${name}: sends you to Stripe`);
  assert(f["line_items[0][price_data][unit_amount]"] === cents && f["line_items[0][price_data][recurring][interval]"] === interval && f["line_items[0][price_data][product_data][name]"] === name && f["line_items[0][price_data][currency]"] === "usd", `${name}: charges ${Number(cents) / 100} dollars every ${interval}`);
  assert(f.billing_address_collection === "required", `${name}: asks for the full address`);
  assert(!Object.keys(f).some((k) => k.startsWith("payment_method_types")), `${name}: leaves card, Cash App Pay, Klarna and bank to Stripe's settings`);
  assert(f.client_reference_id === "u1" && f["metadata[plan]"] === plan && f["subscription_data[metadata][billing]"] === billing && f.customer_email === "a@b.co", `${name}: says whose it is`);
  assert(f.success_url === `https://nebuluxai.com/ThankYou?plan=${plan}&billing=${billing}&from=%2Fchat%2Fdesigner&session_id={CHECKOUT_SESSION_ID}` && f.cancel_url === "https://nebuluxai.com/chat/shop", `${name}: comes back to the right pages`);
  assert(!("automatic_tax[enabled]" in f), `${name}: adds no tax`);
}
assert(sent[0].auth === "Bearer sk_test_x", "the key goes to Stripe only in the header");

// ---- what a browser can't change ----
{
  const [s, , f] = await call({ productId: "team", billing: "yearly", price: 1, amount: 1, unit_amount: 1, cents: 1 });
  assert(s === 200 && f["line_items[0][price_data][unit_amount]"] === "19200", "a price sent from the browser is ignored");
  const [, , g] = await call({ productId: "pro", billing: "weekly" });
  assert(g["line_items[0][price_data][recurring][interval]"] === "month", "an unknown billing period is monthly");
  for (const bad of ["//evil.com", "https://evil.com/x", "/\\evil.com", "javascript:alert(1)"]) {
    const [, , h] = await call({ productId: "pro", from: bad, back: bad });
    assert(h.success_url.includes("from=%2Fchat&") && h.cancel_url === "https://nebuluxai.com/chat/shop", `a return path of ${bad} stays on the site`);
  }
  const [s2] = await call({ productId: "enterprise" });
  assert(s2 === 403, "Enterprise can't be bought here yet");
  const [s3, b3] = await call({ productId: "pro" }, ENV, null);
  assert(s3 === 401 && /sign in/i.test(b3.error), "you have to be signed in");
  const [s4, b4, f4] = await call({ productId: "pro" }, { PUBLISHED_HTML: kv });
  assert(s4 === 403 && b4.soon === true && !f4, "with no Stripe key it says coming soon and contacts nobody");
  stripeFails = true;
  const [s5, b5] = await call({ productId: "pro" });
  stripeFails = false;
  assert(s5 === 502 && /Nothing was charged/.test(b5.error) && !/nope/.test(b5.error), "if Stripe fails, it says nothing was charged");
  store.set("site-status", JSON.stringify({ paymentsPaused: true }));
  const [s6, b6] = await call({ productId: "pro" });
  store.delete("site-status");
  assert(s6 === 403 && /paused/.test(b6.error), "the admin pause switch stops buying");
}

// ---- the webhook ----
const { onRequestPost: hook } = await load("functions/api/stripe-webhook.js");
const session = (over = {}) => ({ mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "u1", payment_status: "paid", amount_total: 19200, currency: "usd", metadata: { source: "nebulux", plan: "team", billing: "yearly", userId: "u1", tag: "" }, ...over });
const event = (type, object) => JSON.stringify({ id: "evt_" + Math.random(), type, data: { object } });
const post = async (body, sig, env = ENV) => {
  const r = await hook({ request: new Request("https://x/api/stripe-webhook", { method: "POST", headers: sig ? { "stripe-signature": sig } : {}, body }), env });
  return r.status;
};
const signed = async (body, secret = "whsec_x", t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${await S.signStripe(body, secret, t)}`;
{
  const b = event("checkout.session.completed", session());
  assert((await post(b, null)) === 400 && rows().length === 0, "no signature: no plan");
  assert((await post(b, "t=1,v1=abc")) === 400 && rows().length === 0, "a made-up signature: no plan");
  assert((await post(b, await signed(b, "whsec_wrong"))) === 400 && rows().length === 0, "signed with the wrong secret: no plan");
  assert((await post(b, await signed(b, "whsec_x", Math.floor(Date.now() / 1000) - 900))) === 400 && rows().length === 0, "an old replayed event: no plan");
  assert((await post(b.replace("19200", "1"), await signed(b))) === 400 && rows().length === 0, "a changed body: no plan");
  assert((await post(b, await signed(b))) === 200, "a signed event is accepted");
  const r = rows();
  assert(r.length === 1 && r[0].status === "paid" && r[0].productId === "team" && r[0].appUserId === "u1" && r[0].by === "u1" && r[0].billing === "yearly" && r[0].customerId === "cus_1", "a signed payment gives the plan, in the row credits.js reads");
  assert((await post(b, await signed(b))) === 200 && rows().length === 1, "the same event twice doesn't count twice");
  const [s, a] = await call({ productId: "pro" });
  assert(s === 409 && /already have/.test(a.error), "someone already subscribed can't start a second subscription");
  const up = event("customer.subscription.updated", { id: "sub_1", status: "past_due" });
  await post(up, await signed(up));
  assert(rows()[0].status === "paid", "a failed card keeps the plan while Stripe retries");
  const un = event("customer.subscription.updated", { id: "sub_1", status: "unpaid" });
  await post(un, await signed(un));
  assert(rows()[0].status === "unpaid", "unpaid in the end: the plan stops");
  const ok = event("customer.subscription.updated", { id: "sub_1", status: "active" });
  await post(ok, await signed(ok));
  assert(rows()[0].status === "paid", "paying up brings it back");
  const del = event("customer.subscription.deleted", { id: "sub_1", status: "canceled" });
  await post(del, await signed(del));
  assert(rows()[0].status === "canceled", "canceling ends the plan");
  await post(b, await signed(b));
  assert(rows()[0].status === "canceled", "a late event can't bring a canceled plan back");
}
{
  const b = event("checkout.session.completed", session({ subscription: "sub_2", payment_status: "unpaid", metadata: { source: "nebulux", plan: "pro", billing: "monthly", userId: "u2", tag: "" }, client_reference_id: "u2" }));
  await post(b, await signed(b));
  const row = () => rows().find((r) => r.subscriptionId === "sub_2");
  assert(row().status === "processing", "a bank payment waits: no plan yet");
  const ok = event("checkout.session.async_payment_succeeded", session({ subscription: "sub_2", client_reference_id: "u2", metadata: { source: "nebulux", plan: "pro", billing: "monthly", userId: "u2", tag: "" } }));
  await post(ok, await signed(ok));
  assert(row().status === "paid", "the plan starts when the bank clears it");
  const c = event("checkout.session.completed", session({ subscription: "sub_3", payment_status: "unpaid", client_reference_id: "u3", metadata: { source: "nebulux", plan: "pro", billing: "monthly", userId: "u3", tag: "" } }));
  await post(c, await signed(c));
  const fail = event("checkout.session.async_payment_failed", session({ subscription: "sub_3", client_reference_id: "u3", metadata: { source: "nebulux", plan: "pro", billing: "monthly", userId: "u3", tag: "" } }));
  await post(fail, await signed(fail));
  assert(rows().find((r) => r.subscriptionId === "sub_3").status === "failed", "a bank payment that fails gives no plan");
  const n = rows().length;
  for (const bad of [session({ subscription: "sub_x", metadata: { source: "nebulux", plan: "enterprise", userId: "u1" } }), session({ subscription: "sub_y", metadata: { plan: "team", userId: "u1" } }), session({ subscription: "sub_z", mode: "payment" })]) {
    const e = event("checkout.session.completed", bad);
    await post(e, await signed(e));
  }
  assert(rows().length === n, "other payments on the Stripe account give no plan");
}

// ---- usage credits ----
{
  const [s1, b1, f1] = await call({ productId: "usage-credits", amount: 25, from: "/chat", back: "/chat/shop" });
  assert(s1 === 200 && b1.redirectUrl && f1.mode === "payment", "usage credits: a one-time checkout");
  assert(f1["line_items[0][price_data][unit_amount]"] === "2500" && f1["line_items[0][price_data][product_data][name]"] === "Usage Credits" && !("line_items[0][price_data][recurring][interval]" in f1), "usage credits: $25 is charged once");
  assert(f1.billing_address_collection === "required" && f1.success_url.includes("/ThankYou?usage=25&from=%2Fchat&"), "usage credits: full address, and back to the right page");
  for (const bad of [4, 501, 2.5, "lots", null, -5]) {
    const [st, , fb] = await call({ productId: "usage-credits", amount: bad });
    assert(st === 400 && !fb, `usage credits: an amount of ${bad} is refused`);
  }
  const [s2] = await call({ productId: "usage-credits", amount: 500 });
  assert(s2 === 200, "usage credits: $500 is allowed");
  const [s3, b3] = await call({ productId: "usage-credits", amount: 25 }, { PUBLISHED_HTML: kv });
  assert(s3 === 403 && /isn't connected/.test(b3.error), "usage credits: with no Stripe key, nothing starts");
  const [s4] = await call({ productId: "usage-credits", amount: 25 });
  assert(s4 === 200, "someone with a subscription can still buy usage credits");

  const pay = (id, over = {}) => ({ id, mode: "payment", customer: "cus_9", client_reference_id: "u9", payment_status: "paid", amount_total: 2500, currency: "usd", metadata: { source: "nebulux", kind: "usage", userId: "u9", amount: "25" }, ...over });
  const b = event("checkout.session.completed", pay("cs_a"));
  assert((await post(b, "t=1,v1=abc")) === 400 && balance("u9") === 0, "usage credits: a made-up signature adds nothing");
  assert((await post(b, await signed(b))) === 200 && balance("u9") === 25, "usage credits: a signed payment adds $25");
  await post(b, await signed(b));
  assert(balance("u9") === 25, "usage credits: the same event twice adds it once");
  const row = rows().find((r) => r.id === "stripe_cs_a");
  assert(row.productId === "usage-credits" && row.status === "paid" && row.credited === true, "usage credits: the purchase is recorded");
  const low = event("checkout.session.completed", pay("cs_b", { amount_total: 100 }));
  await post(low, await signed(low));
  assert(balance("u9") === 25, "usage credits: a total that doesn't match adds nothing");
  const bank = event("checkout.session.completed", pay("cs_c", { payment_status: "unpaid" }));
  await post(bank, await signed(bank));
  assert(balance("u9") === 25, "usage credits: a bank payment adds nothing until it clears");
  const clear = event("checkout.session.async_payment_succeeded", pay("cs_c"));
  await post(clear, await signed(clear));
  await post(clear, await signed(clear));
  assert(balance("u9") === 50, "usage credits: when it clears they're added, once");
  const bank2 = event("checkout.session.completed", pay("cs_d", { payment_status: "unpaid" }));
  await post(bank2, await signed(bank2));
  const fail = event("checkout.session.async_payment_failed", pay("cs_d", { payment_status: "unpaid" }));
  await post(fail, await signed(fail));
  assert(balance("u9") === 50 && rows().find((r) => r.id === "stripe_cs_d").status === "failed", "usage credits: a failed bank payment adds nothing");
  const forged = event("checkout.session.completed", pay("cs_e", { metadata: { kind: "usage", userId: "u9", amount: "25" } }));
  await post(forged, await signed(forged));
  assert(balance("u9") === 50, "usage credits: other payments on the Stripe account add nothing");
  assert(!(await S.activeStripeRow(db, "u9")), "buying usage credits doesn't count as having a subscription");
}
