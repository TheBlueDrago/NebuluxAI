// "Buy Now" on sites people publish (src/hooks/useSiteCheckout.js, src/pages/Buy.jsx). It used to
// start a Base44 Payments checkout (base44/functions/site-checkout); Nebulux no longer uses Base44,
// and buying comes back with a new payment provider. Until then every buy button gets this answer,
// so nothing is sent to Base44 and nobody is charged.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

export const SHOP_SOON = "Buying on Nebulux AI sites is coming soon. Nothing was charged.";

export async function onRequestPost({ request }) {
  if (!(await currentUser(request))) return json({ error: "Please sign in first." }, 401);
  return json({ error: SHOP_SOON, soon: true }, 503);
}
