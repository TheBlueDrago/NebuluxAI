// Buying Pro, Team or usage credits: starts a Stripe Checkout and answers { redirectUrl }. Until the owner
// adds STRIPE_SECRET_KEY in Cloudflare (docs/stripe-setup.md) it says checkout isn't connected, and the
// owner is emailed who wanted to buy what (cloudflare-lib/ownerAlerts.js).
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { alertOwner, placeOf } from "../../../../../cloudflare-lib/ownerAlerts.js";
import { accountBlocked, BLOCKED_MESSAGE } from "../../../../../cloudflare-lib/bans.js";
import { checkDiscount } from "../../../../../cloudflare-lib/promos.js";
import { promoTag } from "../../../../../cloudflare-lib/discounts.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { isPlan, usageDollars, USAGE_ID, USAGE_MIN, USAGE_MAX } from "../../../../../cloudflare-lib/planPrices.js";
import { stripeReady, stripePost, safePath, checkoutFields, usageFields, activeStripeRow } from "../../../../../cloudflare-lib/stripe.js";

export const PLANS_SOON = "These plans will be coming soon in later updates. Nothing was charged.";
const NOT_CONNECTED = "Checkout isn't connected yet. Nothing was charged.";

export async function onRequestPost({ request, env, waitUntil }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in first." }, 401);
  const body = await request.json().catch(() => ({}));
  const plan = String(body.productId || "");
  const usage = plan === USAGE_ID ? usageDollars(body.amount) : null;
  if (plan === USAGE_ID && usage === null) return json({ error: `Choose a whole-dollar amount from $${USAGE_MIN} to $${USAGE_MAX}.` }, 400);

  if (!stripeReady(env) || !(isPlan(plan) || usage)) {
    const what = String(body.productId || body.product || body.plan || "a plan").slice(0, 60);
    const send = alertOwner(env, {
      key: `wants:${user.id}:${what}`,
      subject: `Someone wants to buy: ${what}`,
      lines: [`User: ${user.full_name || "(no name)"} <${user.email || "?"}>`, `Product: ${what}${body.billing ? ` (${String(body.billing).slice(0, 20)})` : ""}`, `From: ${placeOf(request)}`, "Nothing was charged."],
    });
    if (waitUntil) waitUntil(send);
    else await send;
    return json({ error: isPlan(plan) || usage ? NOT_CONNECTED : PLANS_SOON, soon: true }, 403);
  }

  const kv = env.PUBLISHED_HTML;
  if (await accountBlocked(kv, user)) return json({ error: BLOCKED_MESSAGE }, 403);
  if (!(await allow(`create-checkout:${user.id}`, 20, 3600))) return json({ error: TOO_MANY }, 429);
  const status = await kv.get("site-status", "json").catch(() => null);
  if (status && status.paymentsPaused) return json({ error: "Buying is paused for now. Nothing was charged." }, 403);
  if (!usage && env.DB && (await activeStripeRow(env.DB, user.id))) return json({ error: "You already have a subscription. To change it, open Subscriptions in your settings." }, 409);

  const billing = body.billing === "yearly" ? "yearly" : "monthly";
  let pct = 0;
  let tag = "";
  if (body.promoCode && !usage) {
    try {
      const d = await checkDiscount(kv, request, user, body.promoCode, plan, { claim: true });
      pct = Math.trunc(Number(d.pct)) || 0;
      tag = promoTag(d.code);
    } catch (err) {
      return json({ error: (err && err.message) || "That promo code can't be used for this." }, 400);
    }
  }

  const origin = new URL(request.url).origin;
  const from = safePath(body.from, origin);
  const back = safePath(body.back, origin, "/chat/shop");
  try {
    const session = await stripePost(env, "checkout/sessions", usage ? usageFields({ amount: usage, user, origin, from, back }) : checkoutFields({ plan, billing, user, origin, from, back, pct, tag }));
    if (!session.url) throw new Error("no checkout address");
    return json({ redirectUrl: session.url });
  } catch (err) {
    console.error("create-checkout:", (err && err.message) || err);
    return json({ error: "Checkout couldn't start. Nothing was charged. Please try again." }, 502);
  }
}
