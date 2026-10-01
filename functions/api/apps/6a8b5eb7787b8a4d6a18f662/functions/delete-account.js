// Deletes the signed-in user's own account (their record in Nebulux's database, cloudflare-lib/db.js,
// which also removes their sign-in and every signed-in device).
// Also remembers the address as deleted (check-email) and clears the user's KV records.
// The app calls delete-my-content first to remove their sites, games and drafts.
import { json, base44 } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Unauthorized" }, 401);
    if (!(await allow(`delete-account:${user.id}`, 5, 3600))) return json({ error: TOO_MANY }, 429);
    await base44(request, "DELETE", `entities/User/${encodeURIComponent(user.id)}`);
    const email = String(user.email || "").trim().toLowerCase();
    if (email) await kv.put(`deleted:${email}`, new Date().toISOString());
    for (const key of [`bonus:${user.id}`, `grant:${user.id}`, `welcome:${user.id}`, `draft:${user.id}`, `sitedraft:${user.id}`]) await kv.delete(key).catch(() => {});
    // Saved game progress (game-save.js), one key per game.
    const saves = await kv.list({ prefix: `gamesave:${user.id}:` }).catch(() => null);
    for (const k of (saves && saves.keys) || []) await kv.delete(k.name).catch(() => {});
    return json({ success: true });
  } catch (err) {
    return json({ error: (err && err.message) || "Could not delete account" }, 500);
  }
}
