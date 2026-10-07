// Admins: how the free AI held up over the last 14 days (cloudflare-lib/aihealth.js).
// {} -> { days: [{ day, ok, busy, fail, models: { name: n } }], keys }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { aiDays } from "../../../../../cloudflare-lib/aihealth.js";
import { geminiKeys } from "./chatCompletion.js";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (user.role !== "admin") return json({ error: "Admins only." }, 403);
  if (!env.DB) return json({ days: [], keys: geminiKeys(env).length });
  const rows = await aiDays(env.DB, 14);
  const byDay = new Map();
  for (const { day, kind, n } of rows) {
    const d = byDay.get(day) || { day, ok: 0, busy: 0, fail: 0, models: {} };
    if (kind === "ok" || kind === "busy" || kind === "fail") d[kind] += n;
    else if (kind.startsWith("model:")) d.models[kind.slice(6)] = n;
    byDay.set(day, d);
  }
  return json({ days: [...byDay.values()], keys: geminiKeys(env).length });
}
