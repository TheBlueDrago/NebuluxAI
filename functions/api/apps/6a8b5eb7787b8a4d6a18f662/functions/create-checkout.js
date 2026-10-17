// Buying plans and credit packs (src/pages/Billing.jsx). It used to start a Base44 Payments
// checkout (base44/functions/create-checkout); paid plans are "coming soon" (src/lib/salesOpen.js)
// and will come back with a new payment provider. Until then this answers instead of Base44,
// and the owner is emailed who wanted to buy what (cloudflare-lib/ownerAlerts.js).
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { alertOwner, placeOf } from "../../../../../cloudflare-lib/ownerAlerts.js";

export const PLANS_SOON = "These plans will be coming soon in later updates. Nothing was charged.";

export async function onRequestPost({ request, env, waitUntil }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in first." }, 401);
  const body = await request.json().catch(() => ({}));
  const what = String(body.productId || body.product || body.plan || "a plan").slice(0, 60);
  const send = alertOwner(env, {
    key: `wants:${user.id}:${what}`,
    subject: `Someone wants to buy: ${what}`,
    lines: [`User: ${user.full_name || "(no name)"} <${user.email || "?"}>`, `Product: ${what}${body.billing ? ` (${String(body.billing).slice(0, 20)})` : ""}`, `From: ${placeOf(request)}`, "Plans aren't on sale yet, so nothing was charged."],
  });
  if (waitUntil) waitUntil(send);
  else await send;
  return json({ error: PLANS_SOON, soon: true }, 403);
}
