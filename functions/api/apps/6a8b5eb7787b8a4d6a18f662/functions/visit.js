// Visit counts (cloudflare-lib/visits.js): numbers only, nothing about a person.
//   { p: "/pricing", f: true }   anyone: this page was opened (f: it's the first page of this visit)
//   { p: "@signup-open" }        anyone: a step was taken
//   { action: "stats" }          admins -> { ai, orbit } for Monitor's Visitors card
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";
import { recordHit, hitStats } from "../../../../../cloudflare-lib/visits.js";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|monitor/i;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });
  const body = await request.json().catch(() => ({}));
  if (body.action === "stats") {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    if (user.role !== "admin") return json({ error: "Admins only." }, 403);
    const [ai, orbit] = await Promise.all([hitStats(env.DB, "ai"), hitStats(env.DB, "orbit")]);
    return json({ ai, orbit });
  }
  // Crawlers aren't visitors; and one browser in a loop can't fill the table.
  if (BOT.test(request.headers.get("user-agent") || "")) return json({ ok: true });
  const ip = request.headers.get("cf-connecting-ip") || "unknown"; // only for the throttle; never stored
  if (!(await allow(`visit:${ip}`, 90, 60))) return json({ ok: true });
  await recordHit(env.DB, "ai", body.p, body.f === true).catch(() => {});
  return json({ ok: true });
}
