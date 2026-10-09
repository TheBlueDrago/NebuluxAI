// Monitor → Nebulux Sites orders. The Nebulux Sites Worker copies each new order into this
// database (table site_orders). Admins only; manage orders on the Nebulux Sites admin page.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (user.role !== "admin") return json({ error: "Admins only." }, 403);
  if (!env.DB) return json({ orders: [] });
  const r = await env.DB.prepare("SELECT * FROM site_orders WHERE status IS NULL OR status != 'cancelled' ORDER BY created_at DESC LIMIT 50").all().catch(() => ({ results: [] }));
  return json({ orders: r.results || [] });
}
