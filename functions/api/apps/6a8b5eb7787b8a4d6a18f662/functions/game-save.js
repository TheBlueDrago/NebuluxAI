// Game progress saved to the player's Nebulux account, for every published game. A game's own
// saved data (its localStorage, see lib/previewShim.js) is sent here when it changes and handed
// back to the game the next time the player opens it, on any device. Kept until the player
// deletes it (the "Delete my progress" button on the game page) or deletes their account.
// { action: "get", name }        -> { data }   (an object of saved keys, {} when none)
// { action: "set", name, data }  -> { ok }
// { action: "delete", name }     -> { ok }
// KV (PUBLISHED_HTML): gamesave:<userId>:<game name>
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

const MAX_BYTES = 512 * 1024;

export function cleanSave(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const out = {};
  for (const [k, v] of Object.entries(data)) out[String(k).slice(0, 200)] = String(v);
  return JSON.stringify(out).length > MAX_BYTES ? null : out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Sign in to save your progress." }, 401);
    const kv = env.PUBLISHED_HTML;
    const body = await request.json().catch(() => ({}));
    // Every game this account has progress in ("Download my data", src/lib/myData.js).
    if (body.action === "list") {
      const list = await kv.list({ prefix: `gamesave:${user.id}:` });
      const saves = {};
      for (const k of list.keys || []) saves[k.name.slice(`gamesave:${user.id}:`.length)] = await kv.get(k.name, "json");
      return json({ saves });
    }
    const name = String(body.name || "").toLowerCase();
    if (!/^[a-z0-9-]{1,63}$/.test(name)) return json({ error: "Which game?" }, 400);
    const key = `gamesave:${user.id}:${name}`;

    if (body.action === "get") return json({ data: (await kv.get(key, "json")) || {} });
    if (body.action === "set") {
      if (!(await allow(`gamesave:${user.id}`, 120, 60))) return json({ error: TOO_MANY }, 429);
      const data = cleanSave(body.data);
      if (!data) return json({ error: "That save is too big (512 KB at most)." }, 413);
      await kv.put(key, JSON.stringify(data));
      return json({ ok: true });
    }
    if (body.action === "delete") {
      await kv.delete(key);
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
