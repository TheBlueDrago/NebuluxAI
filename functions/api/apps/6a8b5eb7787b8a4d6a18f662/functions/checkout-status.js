// The thank-you page asks whether a checkout is paid, or still waiting on a bank (which takes a few
// days). { sessionId } -> { status: "paid" | "processing" }. Only for the person who made that checkout.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { stripeReady, stripeGet } from "../../../../../cloudflare-lib/stripe.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in first." }, 401);
  if (!stripeReady(env)) return json({ error: "Not set up." }, 503);
  const body = await request.json().catch(() => ({}));
  const id = String(body.sessionId || "");
  if (!/^cs_[A-Za-z0-9_]{5,200}$/.test(id)) return json({ error: "Unknown checkout." }, 400);
  try {
    const s = await stripeGet(env, `checkout/sessions/${id}`);
    if (s.client_reference_id !== user.id) return json({ error: "Unknown checkout." }, 404);
    return json({ status: s.payment_status === "unpaid" ? "processing" : "paid" });
  } catch {
    return json({ error: "Couldn't check that checkout." }, 502);
  }
}
