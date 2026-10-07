// Monitor → Waitlist (cloudflare-lib/waitlist.js). Admins only.
//   { action: "list" }            -> { people: [{ email, joined_at }] }
//   { action: "remove", email }   -> { people }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { listWaitlist, removeFromWaitlist } from "../../../../../cloudflare-lib/waitlist.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (user.role !== "admin") return json({ error: "Admins only." }, 403);
  if (!env.DB) return json({ people: [] });
  const body = await request.json().catch(() => ({}));
  if (body.action === "remove") await removeFromWaitlist(env.DB, body.email);
  return json({ people: await listWaitlist(env.DB) });
}
