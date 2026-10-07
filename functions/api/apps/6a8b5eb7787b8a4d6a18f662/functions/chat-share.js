// Shared chats (cloudflare-lib/shares.js). Signed-in only.
//   { action: "create", kind: "chat"|"code", title, messages } -> { id, url }
//   { action: "view", id }  -> { share, own, rewarded } | { locked, kind, title, owner_name, reward_ends_at } (402)
//   { action: "mine" }      -> { shares }
//   { action: "delete", id } -> { shares }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser, entitlement, giveBonusTo } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { createShare, viewShare, myShares, deleteShare } from "../../../../../cloudflare-lib/shares.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Sign in or make an account to open this chat.", needs: "signin" }, 401);
  if (!env.DB) return json({ error: "Sharing isn't available right now." }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "view");

  if (action === "create") {
    if (!(await allow(`share-new:${user.id}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
    const r = await createShare(env.DB, user, body);
    if (r.error) return json(r, 400);
    return json({ id: r.id, url: `https://nebuluxai.com/share/${r.id}` });
  }
  if (action === "mine") return json({ shares: await myShares(env.DB, user.id) });
  if (action === "delete") {
    await deleteShare(env.DB, user.id, body.id);
    return json({ shares: await myShares(env.DB, user.id) });
  }

  if (!(await allow(`share-view:${user.id}`, 120, 600))) return json({ error: TOO_MANY }, 429);
  const ent = await entitlement(env.PUBLISHED_HTML, request, user);
  const r = await viewShare(env.DB, user, ent.plan, body.id, (ownerId, amounts, once) => giveBonusTo(env.PUBLISHED_HTML, ownerId, amounts, once));
  if (r.missing) return json({ error: "This shared chat doesn't exist anymore." }, 404);
  if (r.locked) return json(r, 402);
  return json(r);
}
