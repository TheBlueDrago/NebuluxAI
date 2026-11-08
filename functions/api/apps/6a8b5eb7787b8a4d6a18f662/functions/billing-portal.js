// "Manage or cancel": opens Stripe's own page for changing the card or canceling. { from } -> { url }.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { stripeReady, stripePost, safePath, activeStripeRow } from "../../../../../cloudflare-lib/stripe.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in first." }, 401);
  if (!stripeReady(env) || !env.DB) return json({ error: "Please contact us to change your subscription." }, 503);
  const row = await activeStripeRow(env.DB, user.id);
  if (!row || !row.customerId) return json({ error: "We couldn't find a subscription on this account." }, 404);
  const body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;
  try {
    const s = await stripePost(env, "billing_portal/sessions", { customer: row.customerId, return_url: origin + safePath(body.from, origin) });
    return json({ url: s.url });
  } catch (err) {
    console.error("billing-portal:", (err && err.message) || err);
    return json({ error: "That page couldn't open. Please contact us and we'll sort it out." }, 502);
  }
}
