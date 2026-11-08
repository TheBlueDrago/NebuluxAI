// Stripe tells us here when someone has paid, or their subscription ends. Only events Stripe has
// signed count (STRIPE_WEBHOOK_SECRET, docs/stripe-setup.md); this is what gives or removes a plan.
import { verifyStripe, handleStripeEvent } from "../../cloudflare-lib/stripe.js";

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.DB) return reply({ error: "Not set up." }, 503);
  const body = await request.text();
  if (!(await verifyStripe(body, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) return reply({ error: "Bad signature." }, 400);
  let ev;
  try {
    ev = JSON.parse(body);
  } catch {
    return reply({ error: "Bad body." }, 400);
  }
  // A failure answers 500 so Stripe sends the event again.
  try {
    return reply({ received: true, result: await handleStripeEvent(env.DB, ev) });
  } catch (err) {
    console.error("stripe-webhook:", (err && err.message) || err);
    return reply({ error: "Try again." }, 500);
  }
}
