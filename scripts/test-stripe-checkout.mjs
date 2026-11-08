// Offline test of Stripe checkout for Pro and Team (cloudflare-lib/stripe.js, create-checkout, the webhook):
// the right price for every plan and billing period, the server's price and not the browser's, the full
// address, safe return paths, only signed webhooks give a plan, and bank payments wait until they clear.
// Run: node scripts/test-stripe-checkout.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
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
const DB = new Map(), BAL = new Map(), APIBAL = new Map(), AGREED = new Set(), LEDGER = [], HAND = new Map();
const balance = (id) => (BAL.get(id) || 0) / 100000;
const prepare = (sql) => ({
  run: async () => ({}),
  bind: (...a) => ({
    all: async () => ({ results: /FROM api_balance/.test(sql) ? [...APIBAL].filter(([k]) => k.startsWith(a[0] + "/")).map(([k, v]) => ({ model: k.split("/")[1], balance: v, funded: 1 })) : /FROM api_ledger/.test(sql) ? [] : [...DB.values()].filter((r) => r.entity === a[0]) }),
    first: async () => (/checkout_handoff/.test(sql) ? (() => { const r = HAND.get(a[0]) || null; HAND.delete(a[0]); return r; })() : /FROM api_account/.test(sql) ? (AGREED.has(a[0]) ? { use_api: 1, agreed_at: "2026-11-01" } : null) : /usage_credits/.test(sql) ? (BAL.has(a[0]) ? { balance: BAL.get(a[0]), daily_limit: null, day: null, spent_today: 0 } : null) : DB.get(a[0] + "/" + a[1]) || null),
    run: async () => {
      if (/api_(account|balance|ledger)/.test(sql)) {
        if (/INSERT INTO api_balance/.test(sql)) APIBAL.set(a[0] + "/" + a[1], (APIBAL.get(a[0] + "/" + a[1]) || 0) + a[2]);
        if (/INSERT INTO api_ledger/.test(sql)) LEDGER.push(a);
        if (/UPDATE api_account SET agreed_at/.test(sql)) AGREED.add(a[1]);
      } else if (/usage_credits/.test(sql)) {
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

// ---- API funds (the Nebulux Platform's Billing, Nebulux Orbit's API too) ----
{
  const { onRequestPost: billing } = await load(FN + "api-billing.js");
  const bill = async (body, env = ENV) => {
    sent = [];
    const r = await billing({ request: new Request("https://nebuluxai.com/x", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) }), env });
    return [r.status, await r.json().catch(() => ({})), sent[0] && sent[0].form];
  };
  cache.clear(); // the hourly checkout limit, used up by the tests above
  const apiUser = (m) => APIBAL.get("u1/" + m) || 0;
  const [a0, b0, f0] = await bill({ action: "topup", model: "galaxy", dollars: 10 });
  assert(a0 === 400 && /Agree/.test(b0.error) && !f0, "API funds: agreeing to API billing comes first");
  await bill({ action: "agree" });
  for (const [model, name, cents] of [["nebulux-ai", "Nebulux AI API Funds", "1000"], ["galaxy", "Galaxy API Funds", "1000"], ["space", "Space API Funds", "1000"], ["nebula", "Nebula API Funds", "1000"], ["orbit", "Nebulux Orbit API Funds", "1000"]]) {
    const [s, b, f] = await bill({ action: "topup", model, dollars: 10, from: "/api?tab=billing", back: "/api?tab=billing", price: 1, unit_amount: 1 });
    assert(s === 200 && b.redirectUrl.startsWith("https://checkout.stripe.com/"), `${name}: sends you to Stripe`);
    assert(f.mode === "payment" && f["line_items[0][price_data][unit_amount]"] === cents && f["line_items[0][price_data][product_data][name]"] === name, `${name}: the amount and the name, whatever the browser sends`);
    assert(f["metadata[kind]"] === "api" && f["metadata[model]"] === model && f["metadata[amount]"] === "10" && f.client_reference_id === "u1", `${name}: says whose it is and which balance`);
    assert(f.billing_address_collection === "required" && !Object.keys(f).some((k) => k.startsWith("payment_method_types")), `${name}: the full address, and every payment option Stripe offers`);
    assert(f.success_url === `https://nebuluxai.com/ThankYou?api=10&model=${model}&from=%2Fapi%3Ftab%3Dbilling&session_id={CHECKOUT_SESSION_ID}` && f.cancel_url === "https://nebuluxai.com/api?tab=billing", `${name}: comes back to the page they were on`);
  }
  for (const [model, dollars, why] of [["galaxy", 2, "under that AI's smallest amount"], ["nebulux-ai", 501, "over $500"], ["nebulux-ai", 2.5, "not whole dollars"], ["constructor", 10, "not an AI"], ["orbit", 1, "under Orbit's smallest amount"]]) {
    const [s, , f] = await bill({ action: "topup", model, dollars });
    assert(s === 400 && !f, `API funds: refused when ${why}`);
  }
  const [s1, b1, f1] = await bill({ action: "topup", model: "galaxy", dollars: 10, from: "//evil.com", back: "https://evil.com" });
  assert(s1 === 200 && f1.success_url.includes("from=%2Fapi&") && f1.cancel_url === "https://nebuluxai.com/api", "API funds: a return path can't leave the site");
  const [s2, b2, f2] = await bill({ action: "topup", model: "galaxy", dollars: 10 }, { PUBLISHED_HTML: kv, DB: db });
  assert(s2 === 503 && b2.soon === true && !f2, "API funds: no Stripe key, nothing is charged");
  store.set("site-status", JSON.stringify({ paymentsPaused: true }));
  const [s3, b3] = await bill({ action: "topup", model: "galaxy", dollars: 10 });
  store.delete("site-status");
  assert(s3 === 403 && /paused/.test(b3.error), "API funds: the admin pause switch stops buying");
  stripeFails = true;
  const [s4, b4] = await bill({ action: "topup", model: "galaxy", dollars: 10 });
  stripeFails = false;
  assert(s4 === 502 && /Nothing was charged/.test(b4.error), "API funds: if Stripe fails it says nothing was charged");

  const pay = (over = {}) => ({ id: "cs_api_1", mode: "payment", customer: "cus_1", client_reference_id: "u1", payment_status: "paid", amount_total: 2500, currency: "usd", livemode: false, metadata: { source: "nebulux", kind: "api", model: "galaxy", amount: "25", userId: "u1" }, ...over });
  const send = async (type, o) => { const b = event(type, o); return post(b, await signed(b)); };
  const fake = event("checkout.session.completed", pay({ id: "cs_api_x" }));
  assert((await post(fake, await signed(fake, "whsec_wrong"))) === 400 && apiUser("galaxy") === 0, "API funds: an unsigned event adds nothing");
  assert((await send("checkout.session.completed", pay({ amount_total: 100, id: "cs_api_low" }))) === 200 && apiUser("galaxy") === 0, "API funds: a payment for less than it says adds nothing");
  assert((await send("checkout.session.completed", pay())) === 200 && apiUser("galaxy") === 2500000, "API funds: a signed payment adds $25 to that AI's balance");
  assert(apiUser("space") === 0 && apiUser("nebulux-ai") === 0, "API funds: and only that AI's");
  await send("checkout.session.completed", pay());
  assert(apiUser("galaxy") === 2500000, "API funds: the same event twice adds it once");
  const row = rows().find((r) => r.id === "stripe_cs_api_1");
  assert(row.productId === "api-credits" && row.productName === "$25 Galaxy API funds" && row.apiModel === "galaxy" && row.credited === true && row.livemode === false && row.amountCents === 2500, "API funds: the purchase is on record");
  assert(LEDGER.some((l) => l[0] === "u1" && l[2] === "topup" && l[3] === "galaxy" && l[4] === 2500000), "API funds: it's in the account's history");
  const bank = pay({ id: "cs_api_bank", payment_status: "unpaid", metadata: { source: "nebulux", kind: "api", model: "orbit", amount: "25", userId: "u1" } });
  await send("checkout.session.completed", bank);
  assert(apiUser("orbit") === 0 && rows().find((r) => r.id === "stripe_cs_api_bank").status === "processing", "API funds: a bank payment adds nothing until it clears");
  await send("checkout.session.async_payment_succeeded", { ...bank, payment_status: "paid" });
  assert(apiUser("orbit") === 2500000, "API funds: then it's added");
  const failed = pay({ id: "cs_api_fail", payment_status: "unpaid", metadata: { source: "nebulux", kind: "api", model: "space", amount: "25", userId: "u1" } });
  await send("checkout.session.completed", failed);
  await send("checkout.session.async_payment_failed", failed);
  assert(apiUser("space") === 0 && rows().find((r) => r.id === "stripe_cs_api_fail").status === "failed", "API funds: a bank payment that fails adds nothing");
  const wrong = pay({ id: "cs_api_bad", metadata: { source: "nebulux", kind: "api", model: "constructor", amount: "25", userId: "u1" } });
  assert((await send("checkout.session.completed", wrong)) === 200 && !rows().find((r) => r.id === "stripe_cs_api_bad"), "API funds: a made-up AI is ignored");
  const P2 = await load("cloudflare-lib/monitorLive.js");
  const sold = P2.purchaseSummary(rows()).sales.find((x) => x.id === "stripe_cs_api_1");
  assert(sold.kind === "api" && sold.plan === null && !P2.purchaseSummary(rows().filter((r) => r.productId === "api-credits")).plans.u1, "API funds: Monitor lists them as API funds, not as a plan");
}

// ---- API funds started from Nebulux Orbit: a one-time code in the shared database becomes Stripe's checkout ----
{
  const { onRequestGet: pay } = await load("functions/v1/pay.js");
  const mw = readFileSync(R + "functions/_middleware.js", "utf8");
  assert(/ALLOWED = \[[^\]]*v1\\\/pay/.test(mw), "Orbit: the handoff works during maintenance");
  cache.clear();
  AGREED.add("u1");
  DB.set("User/u1", { entity: "User", id: "u1", created_by_id: "u1", created_date: "2026-01-01T00:00:00Z", updated_date: "2026-01-01T00:00:00Z", data: JSON.stringify({ email: "a@b.co", full_name: "Ann", role: "user" }) });
  const code = (c) => c.repeat(48);
  const hand = (c, over = {}) => HAND.set(code(c), { user_id: "u1", model: "orbit", amount: 25, exp: Date.now() + 60000, ...over });
  const go = async (c, env = ENV, q = "") => {
    sent = [];
    const r = await pay({ request: new Request("https://nebuluxai.pages.dev/v1/pay?code=" + (c.length === 1 ? code(c) : c) + q), env });
    return [r.status, r.headers.get("location"), sent[0] && sent[0].form];
  };
  hand("a");
  const [s, loc, f] = await go("a", ENV, "&amount=1&userId=u9&model=galaxy");
  assert(s === 303 && loc.startsWith("https://checkout.stripe.com/"), "Orbit: a good code goes straight to Stripe");
  assert(f["line_items[0][price_data][unit_amount]"] === "2500" && f["line_items[0][price_data][product_data][name]"] === "Nebulux Orbit API Funds", "Orbit: the amount is the saved one, not what's in the address");
  assert(f["metadata[kind]"] === "api" && f["metadata[model]"] === "orbit" && f["metadata[userId]"] === "u1" && f.client_reference_id === "u1" && f.customer_email === "a@b.co", "Orbit: it's for the person who pressed Add funds, on the Orbit balance");
  assert(f.billing_address_collection === "required", "Orbit: the full address");
  assert(f.success_url === "https://nebuluxorbit.thebluedragonstriker.workers.dev/?api_paid=25" && f.cancel_url === "https://nebuluxorbit.thebluedragonstriker.workers.dev/?api_canceled=1", "Orbit: comes back to Orbit");
  assert((await go("a"))[0] === 410, "Orbit: a code works once");
  assert((await go("zz"))[0] === 400 && (await go("b"))[0] === 410, "Orbit: a made-up code is refused");
  hand("c", { exp: Date.now() - 1 });
  assert((await go("c"))[0] === 410, "Orbit: an old code is refused");
  hand("d", { model: "nebula" });
  assert((await go("d"))[0] === 410, "Orbit: only Orbit's balance can be paid this way");
  hand("e", { amount: 1 });
  assert((await go("e"))[0] === 410, "Orbit: an amount under the smallest is refused");
  hand("f");
  const noStripe = await go("f", { PUBLISHED_HTML: kv, DB: db });
  assert(noStripe[0] === 503 && !noStripe[2] && HAND.has(code("f")), "Orbit: no Stripe key, nothing is charged and the code isn't used up");
  hand("1");
  AGREED.delete("u1");
  assert((await go("1"))[0] === 403, "Orbit: agreeing comes first");
  AGREED.add("u1");
  hand("2");
  store.set("site-status", JSON.stringify({ paymentsPaused: true }));
  const paused = await go("2");
  store.delete("site-status");
  assert(paused[0] === 403 && !paused[2], "Orbit: the admin pause switch stops it");
  hand("3");
  stripeFails = true;
  const failedStripe = await go("3");
  stripeFails = false;
  assert(failedStripe[0] === 502, "Orbit: if Stripe fails it says nothing was charged");
}
