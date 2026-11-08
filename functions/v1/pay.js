// Paying through Nebulux AI's Stripe account from Nebulux Orbit (API funds, a plan, or managing that plan), so the Stripe keys live in one place.
// Orbit's server saves a one-time code in the shared database (checkout_handoff) and sends the person
// here; this turns it into Stripe's checkout, and the usual signed webhook adds the money. Who it's for
// and how much come from the saved row, never from the address. Open during maintenance (_middleware.js).
import { getRow } from "../../cloudflare-lib/db.js";
import { stripeReady, stripePost, apiFields, orbitPlanFields, activeOrbitRow } from "../../cloudflare-lib/stripe.js";
import { apiDollars, ORBIT_PLANS, isOrbitPlan } from "../../cloudflare-lib/planPrices.js";
import { account } from "../../cloudflare-lib/apibilling.js";
import { accountBlocked, BLOCKED_MESSAGE } from "../../cloudflare-lib/bans.js";

const ORBIT = "https://nebuluxorbit.thebluedragonstriker.workers.dev";
const EXPIRED = "That payment link has expired. Go back to Orbit and press Add funds again. Nothing was charged.";

const page = (text, status) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Nebulux</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a12;color:#f2f0fa;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}main{max-width:420px}a{display:inline-block;margin-top:16px;padding:10px 20px;border-radius:999px;background:#f2f0fa;color:#0b0a12;text-decoration:none;font-weight:600}</style></head><body><main><p>${text}</p><a href="${ORBIT}">Back to Orbit</a></main></body></html>`,
    { status, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" } }
  );

export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!/^[a-f0-9]{48}$/.test(code)) return page(EXPIRED, 400);
  if (!env.DB) return page("Checkout isn't available right now. Nothing was charged.", 503);
  if (!stripeReady(env)) return page("Checkout isn't connected yet. Nothing was charged.", 503);
  // One use only, even if the page is opened twice.
  const row = await env.DB.prepare("DELETE FROM checkout_handoff WHERE code = ? RETURNING user_id, model, amount, exp").bind(code).first().catch(() => null);
  if (!row || row.exp < Date.now()) return page(EXPIRED, 410);
  const funds = row.model === "orbit", plan = isOrbitPlan(row.model), portal = row.model === "orbit-portal";
  if (!funds && !plan && !portal) return page(EXPIRED, 410);
  const amount = funds ? apiDollars(row.model, row.amount) : 0;
  const user = await getRow(env.DB, "User", row.user_id);
  if (amount === null || !user) return page(EXPIRED, 410);
  if (funds && !(await account(env.DB, user.id)).agreedAt) return page("Agree to API billing in Orbit first. Nothing was charged.", 403);
  if (portal) {
    const sub = await activeOrbitRow(env.DB, user.id);
    if (!sub || !sub.customerId) return page("We couldn't find an Orbit plan on this account.", 404);
    try {
      const s = await stripePost(env, "billing_portal/sessions", { customer: sub.customerId, return_url: ORBIT + "/" });
      return Response.redirect(s.url, 303);
    } catch {
      return page("That page couldn't open. Please contact us and we'll sort it out.", 502);
    }
  }
  if (plan && (await activeOrbitRow(env.DB, user.id))) return page("You already have an Orbit plan. Nothing was charged.", 409);
  const kv = env.PUBLISHED_HTML;
  if (await accountBlocked(kv, user)) return page(BLOCKED_MESSAGE, 403);
  const site = await kv.get("site-status", "json").catch(() => null);
  if (site && site.paymentsPaused) return page("Buying is paused for now. Nothing was charged.", 403);
  try {
    const fields = plan ? orbitPlanFields({ plan: row.model, user, returnTo: { success: `${ORBIT}/?plan_paid=${ORBIT_PLANS[row.model].back}`, cancel: `${ORBIT}/` } }) : apiFields({ model: row.model, amount, user, origin: ORBIT, from: "/", back: "/", returnTo: { success: `${ORBIT}/?api_paid=${amount}`, cancel: `${ORBIT}/?api_canceled=1` } });
    const session = await stripePost(env, "checkout/sessions", fields);
    if (!session.url) throw new Error("no checkout address");
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error("v1/pay:", (err && err.message) || err);
    return page("Checkout couldn't start. Nothing was charged. Please try again.", 502);
  }
}
