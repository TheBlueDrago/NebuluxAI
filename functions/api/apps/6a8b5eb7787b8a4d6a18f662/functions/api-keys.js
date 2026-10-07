// The Nebulux Platform page (/chat/platform): your API keys (cloudflare-lib/apikeys.js).
//   { action: "list" }               -> { keys: [{ id, name, prefix, created_at, last_used, uses }] }
//   { action: "create", name }       -> { key, keys }   (the full key, shown once)
//   { action: "revoke", id }         -> { keys }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { listKeys, createKey, revokeKey } from "../../../../../cloudflare-lib/apikeys.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (!env.DB) return json({ error: "API keys aren't available right now." }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "list");
  if (action === "create") {
    if (!(await allow(`apikey-new:${user.id}`, 10, 3600))) return json({ error: TOO_MANY }, 429);
    const r = await createKey(env.DB, user.id, body.name);
    if (r.error) return json(r, 400);
    return json({ key: r.key, keys: await listKeys(env.DB, user.id) });
  }
  if (action === "revoke") {
    await revokeKey(env.DB, user.id, body.id);
    return json({ keys: await listKeys(env.DB, user.id) });
  }
  return json({ keys: await listKeys(env.DB, user.id) });
}
