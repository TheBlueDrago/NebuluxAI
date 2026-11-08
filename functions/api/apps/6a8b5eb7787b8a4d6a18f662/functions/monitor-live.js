// Admin only: the part of Monitor that reloads every 30 seconds. Who bought which plan and the sales
// behind them. Only reads the database, which has plenty of free reads.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { liveSummary } from "../../../../../cloudflare-lib/monitorLive.js";

export async function onRequestPost({ request, env }) {
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: "Please sign in." }, 401);
    if (me.role !== "admin") return json({ error: "Admins only." }, 403);
    return json(await liveSummary(env.DB, env));
  } catch (err) {
    return json({ error: "Couldn't load Monitor.", detail: String((err && err.message) || err) }, 500);
  }
}
