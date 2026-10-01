// Buying plans and credit packs (src/pages/Billing.jsx). It used to start a Base44 Payments
// checkout (base44/functions/create-checkout); paid plans are "coming soon" (src/lib/salesOpen.js)
// and will come back with a new payment provider. Until then this answers instead of Base44.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

export const PLANS_SOON = "These plans will be coming soon in later updates. Nothing was charged.";

export async function onRequestPost({ request }) {
  if (!(await currentUser(request))) return json({ error: "Please sign in first." }, 401);
  return json({ error: PLANS_SOON, soon: true }, 403);
}
