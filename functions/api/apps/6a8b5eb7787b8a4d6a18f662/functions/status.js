// The public status page (/status): is the AI answering? Totals only (no one's questions or
// accounts), from the same daily counts as Monitor → AI health (cloudflare-lib/aihealth.js).
//   {} -> { state: "ok" | "slow" | "down" | "unknown", days: [{ day, ok, problems }], checkedAt }
import { json } from "../../../../../cloudflare-lib/published.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";
import { aiDays } from "../../../../../cloudflare-lib/aihealth.js";

// Today's share of replies that hit "busy" or failed -> how it's going right now.
export function stateOf(day) {
  if (!day) return "unknown";
  const all = day.ok + day.problems;
  if (all < 5) return day.ok > 0 || all === 0 ? "ok" : "slow";
  const bad = day.problems / all;
  return bad >= 0.6 ? "down" : bad >= 0.2 ? "slow" : "ok";
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await allow(`status:${ip}`, 30, 60))) return json({ error: "Too many requests." }, 429);
  if (!env.DB) return json({ state: "unknown", days: [] });
  const byDay = new Map();
  for (const { day, kind, n } of await aiDays(env.DB, 14)) {
    const d = byDay.get(day) || { day, ok: 0, problems: 0 };
    if (kind === "ok") d.ok += n;
    else if (kind === "busy" || kind === "fail") d.problems += n;
    byDay.set(day, d);
  }
  const days = [...byDay.values()];
  const today = new Date().toISOString().slice(0, 10);
  return json({ state: stateOf(byDay.get(today)), days, checkedAt: new Date().toISOString() });
}
