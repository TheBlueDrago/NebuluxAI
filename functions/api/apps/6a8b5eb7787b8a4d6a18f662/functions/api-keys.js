// The Nebulux Platform page (/chat/platform): your API keys (cloudflare-lib/apikeys.js).
//   { action: "list" }               -> { keys: [{ id, name, prefix, created_at, last_used, uses }] }
//   { action: "create", name }       -> { key, keys }   (the full key, shown once)
//   { action: "revoke", id }         -> { keys }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { listKeys, createKey, revokeKey, setLimit } from "../../../../../cloudflare-lib/apikeys.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { account } from "../../../../../cloudflare-lib/apibilling.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (!env.DB) return json({ error: "API keys aren't available right now." }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "list");
  if (action === "create") {
    if (!(await allow(`apikey-new:${user.id}`, 10, 3600))) return json({ error: TOO_MANY }, 429);
    // A key needs the API billing agreement and money added first (prepaid; every request is charged).
    const a = await account(env.DB, user.id);
    if (!a.agreedAt) return json({ error: "Agree to API billing first.", needs: "agree" }, 400);
    if (!a.funded || !Object.values(a.balances).some((v) => v > 0)) return json({ error: "Add funds to at least one AI's balance first. Every request is paid from it.", needs: "funds" }, 400);
    const r = await createKey(env.DB, user.id, body.name);
    if (r.error) return json(r, 400);
    return json({ key: r.key, keys: await listKeys(env.DB, user.id) });
  }
  // { action: "limit", id, dollars }: a monthly spending limit for the key (dollars null = none).
  if (action === "limit") {
    await setLimit(env.DB, user.id, body.id, body.dollars);
    return json({ keys: await listKeys(env.DB, user.id) });
  }
  if (action === "revoke") {
    await revokeKey(env.DB, user.id, body.id);
    return json({ keys: await listKeys(env.DB, user.id) });
  }
  return json({ keys: await listKeys(env.DB, user.id) });
}
