// Stripe for the Pro and Team plans. The secret key and the webhook secret live only in Cloudflare
// (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET; docs/stripe-setup.md). Prices come from planPrices.js
// on the server, never from the browser.
//
// A paid plan is a Base44Purchase row with status "paid" (credits.js paidPlan reads those). Only the
// webhook writes them, after Stripe has signed the event, so coming back to the thank-you page
// doesn't give anyone a plan.
import { all, create, update, getRow } from "./db.js";
import { isPlan, planDollars, planLabel, usageDollars, USAGE_ID, apiDollars, API_ID, API_NAMES } from "./planPrices.js";
import { addUsageCredits } from "./usageCredits.js";
import { addFunds, toMc } from "./apibilling.js";
import { discountedPrice } from "./discounts.js";

export const stripeReady = (env) => !!(env && env.STRIPE_SECRET_KEY);
const API = "https://api.stripe.com/v1/";
const headers = (env) => ({ Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2026-10-28.endive" });

async function answer(r) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Stripe answered ${r.status}`);
  return j;
}
export const stripePost = async (env, path, fields) =>
  answer(await fetch(API + path, { method: "POST", headers: { ...headers(env), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) }));
export const stripeGet = async (env, path) => answer(await fetch(API + path, { headers: headers(env) }));

// A path on this site, or the fallback: the same rule as src/lib/authReturnTo.js, so a crafted
// link can't send someone to another website after they pay.
export function safePath(raw, origin, fallback = "/chat") {
  if (!raw) return fallback;
  try {
    const url = new URL(String(raw), origin);
    if (url.origin !== origin) return fallback;
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
  } catch {
    return fallback;
  }
}

// The Checkout Session for one plan. payment_method_types is left out on purpose: Stripe then offers
// every method turned on in the Dashboard (card, Cash App Pay, Klarna, bank) that suits the price.
export function checkoutFields({ plan, billing, user, origin, from, back, pct = 0, tag = "" }) {
  const yearly = billing === "yearly";
  const cents = Math.round(discountedPrice(planDollars(plan, billing), pct) * 100);
  const meta = { source: "nebulux", userId: user.id, plan, billing, tag };
  const fields = {
    mode: "subscription",
    ui_mode: "hosted_page",
    success_url: `${origin}/ThankYou?plan=${plan}&billing=${billing}&from=${encodeURIComponent(from)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: origin + back,
    client_reference_id: user.id,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": planLabel(plan, billing),
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][recurring][interval]": yearly ? "year" : "month",
    "line_items[0][quantity]": "1",
    billing_address_collection: "required", // the full street address, not just country and ZIP
    payment_method_collection: "always",
    allow_promotion_codes: "false",
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
  };
  if (user.email) fields.customer_email = user.email;
  for (const [k, v] of Object.entries(meta)) {
    fields[`metadata[${k}]`] = v;
    fields[`subscription_data[metadata][${k}]`] = v;
  }
  return fields;
}

// A one-time Checkout Session for usage credits. The amount was checked on the server (usageDollars).
export function usageFields({ amount, user, origin, from, back }) {
  const fields = {
    mode: "payment",
    ui_mode: "hosted_page",
    success_url: `${origin}/ThankYou?usage=${amount}&from=${encodeURIComponent(from)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: origin + back,
    client_reference_id: user.id,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Usage Credits",
    "line_items[0][price_data][unit_amount]": String(amount * 100),
    "line_items[0][quantity]": "1",
    billing_address_collection: "required",
    allow_promotion_codes: "false",
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    "metadata[source]": "nebulux",
    "metadata[kind]": "usage",
    "metadata[userId]": user.id,
    "metadata[amount]": String(amount),
  };
  if (user.email) fields.customer_email = user.email;
  return fields;
}

// API funds for one AI: the same one-time checkout, marked so the webhook adds it to that AI's balance.
// returnTo { success, cancel }: another Nebulux website to come back to (v1/pay.js).
export function apiFields({ model, amount, user, origin, from, back, returnTo }) {
  return {
    ...usageFields({ amount, user, origin, from, back }),
    success_url: returnTo ? returnTo.success : `${origin}/ThankYou?api=${amount}&model=${encodeURIComponent(model)}&from=${encodeURIComponent(from)}&session_id={CHECKOUT_SESSION_ID}`,
    ...(returnTo ? { cancel_url: returnTo.cancel } : {}),
    "line_items[0][price_data][product_data][name]": `${API_NAMES[model]} API Funds`,
    "metadata[kind]": "api",
    "metadata[model]": model,
  };
}

// Stripe signs each webhook: header "t=<seconds>,v1=<hex>[,v1=...]", HMAC-SHA256 of "<t>.<body>".
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function signStripe(body, secret, t) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
}
export async function verifyStripe(body, header, secret, now = Date.now(), toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = String(header).split(",").map((p) => p.trim().split("="));
  const t = Number((parts.find((p) => p[0] === "t") || [])[1]);
  const sigs = parts.filter((p) => p[0] === "v1").map((p) => p[1] || "");
  if (!Number.isFinite(t) || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const want = await signStripe(body, secret, t);
  return sigs.some((s) => s.length === want.length && [...s].reduce((bad, c, i) => bad | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0);
}

const SYSTEM = { system: true };
const rowId = (subscription) => `stripe_${subscription}`;

async function recordSession(db, s, status) {
  const meta = s.metadata || {};
  const userId = s.client_reference_id || meta.userId;
  if (s.mode !== "subscription" || !s.subscription || !userId || !isPlan(meta.plan) || meta.source !== "nebulux") return "ignored";
  const billing = meta.billing === "yearly" ? "yearly" : "monthly";
  const id = rowId(s.subscription);
  const found = await getRow(db, "Base44Purchase", id);
  if (found) {
    // A repeat, or a bank payment clearing. A canceled plan never comes back from a late event.
    if (found.status !== "canceled" && found.status !== "paid" && found.status !== status) await update(db, "Base44Purchase", SYSTEM, id, { status });
    return found.status;
  }
  await create(
    db,
    "Base44Purchase",
    SYSTEM,
    {
      appUserId: userId,
      productId: meta.plan,
      productName: `${planLabel(meta.plan, billing)}${meta.tag ? ` (${meta.tag})` : ""}`,
      status,
      provider: "stripe",
      livemode: s.livemode === true,
      billing,
      subscriptionId: s.subscription,
      customerId: s.customer || null,
      amountCents: s.amount_total ?? null,
      currency: s.currency || "usd",
    },
    { id, created_by_id: userId }
  );
  return status;
}

// One-time purchases (usage credits, API funds): the money is added once, when the payment is really
// in (a bank payment clears later). add() puts it on the account.
async function recordOneTime(db, s, status, userId, amount, fields, add) {
  if (status === "paid" && s.amount_total !== amount * 100) return "ignored";
  const id = `stripe_${s.id}`;
  let row = await getRow(db, "Base44Purchase", id);
  if (!row) row = await create(db, "Base44Purchase", SYSTEM, { appUserId: userId, ...fields, status, provider: "stripe", livemode: s.livemode === true, customerId: s.customer || null, amountCents: amount * 100, currency: s.currency || "usd" }, { id, created_by_id: userId });
  else if (row.status !== status && row.status !== "paid") row = await update(db, "Base44Purchase", SYSTEM, id, { status });
  if (row.status !== "paid" || row.credited) return row.status;
  await add();
  await update(db, "Base44Purchase", SYSTEM, id, { credited: true });
  return "paid";
}
function recordUsage(db, s, status) {
  const meta = s.metadata || {}, userId = s.client_reference_id || meta.userId, amount = usageDollars(meta.amount);
  if (s.mode !== "payment" || !s.id || !userId || amount === null || meta.source !== "nebulux") return "ignored";
  return recordOneTime(db, s, status, userId, amount, { productId: USAGE_ID, productName: `$${amount} usage credits` }, () => addUsageCredits(db, userId, amount));
}
function recordApi(db, s, status) {
  const meta = s.metadata || {}, userId = s.client_reference_id || meta.userId, model = String(meta.model || ""), amount = apiDollars(model, meta.amount);
  if (s.mode !== "payment" || !s.id || !userId || amount === null || meta.source !== "nebulux") return "ignored";
  return recordOneTime(db, s, status, userId, amount, { productId: API_ID, productName: `$${amount} ${API_NAMES[model]} API funds`, apiModel: model }, () => addFunds(db, userId, model, toMc(amount), "topup", "Stripe payment"));
}
const recordAny = (db, s, status) => {
  const kind = s.metadata && s.metadata.kind;
  return (kind === "usage" ? recordUsage : kind === "api" ? recordApi : recordSession)(db, s, status);
};

async function subscriptionChanged(db, sub, deleted) {
  const row = await getRow(db, "Base44Purchase", rowId(sub.id));
  if (!row || row.status === "canceled") return "ignored";
  // past_due is left alone: Stripe is still retrying the card, and ends it if that fails.
  const next = deleted || sub.status === "canceled" || sub.status === "incomplete_expired" ? "canceled" : sub.status === "unpaid" ? "unpaid" : sub.status === "active" && row.status === "unpaid" ? "paid" : null;
  if (next && next !== row.status) await update(db, "Base44Purchase", SYSTEM, row.id, { status: next });
  return next || row.status;
}

// One signed event from Stripe. Bank payments take a few days: the session completes as unpaid
// (status "processing", no plan yet) and async_payment_succeeded gives the plan.
export async function handleStripeEvent(db, ev) {
  const o = ev && ev.data && ev.data.object;
  if (!o) return "ignored";
  if (ev.type === "checkout.session.completed") return recordAny(db, o, o.payment_status === "paid" || o.payment_status === "no_payment_required" ? "paid" : "processing");
  if (ev.type === "checkout.session.async_payment_succeeded") return recordAny(db, o, "paid");
  if (ev.type === "checkout.session.async_payment_failed") return recordAny(db, o, "failed");
  if (ev.type === "customer.subscription.deleted") return subscriptionChanged(db, o, true);
  if (ev.type === "customer.subscription.updated") return subscriptionChanged(db, o, false);
  return "ignored";
}

// This person's live Stripe subscription, if they have one.
export const activeStripeRow = async (db, userId) => (await all(db, "Base44Purchase")).find((p) => p.appUserId === userId && p.provider === "stripe" && p.subscriptionId && (p.status === "paid" || p.status === "processing" || p.status === "unpaid")) || null;
