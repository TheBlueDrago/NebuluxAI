// Admin only: Nebulux Orbit in Monitor. Orbit keeps its records in this same database (orbit_* tables,
// written by the nebulux-orbit project), so this only reads them. The numbers match Orbit's own
// Monitor (Settings there), which also has the buttons to sign someone out or reset a session.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

const SESSION_LIMIT = 50, SESSION_MS = 5 * 3600e3, PLAN_LIMITS = { free: 50, "orbit-starter": 150, "orbit-expert": 400 }; // backend/session.js in nebulux-orbit
const yearsOld = (birth, now) => {
  const d = new Date(birth + "T00:00:00Z"), n = new Date(now);
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
};

export async function onRequestPost({ request, env }) {
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: "Please sign in." }, 401);
    if (me.role !== "admin") return json({ error: "Admins only." }, 403);
    const now = Date.now();
    // A table Orbit hasn't made yet counts as empty.
    const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results || []).catch(() => []);
    const [names, sessions, terms, conns, ages, devices, synced, notes, paid] = await Promise.all([
      q("SELECT user_id, name, MAX(at) AS at FROM orbit_tokens GROUP BY user_id"),
      q("SELECT user_id, start, used FROM orbit_session_work WHERE start > ?", now - SESSION_MS),
      q("SELECT user_id, version, at FROM orbit_terms"),
      q("SELECT user_id, provider FROM orbit_connections"),
      q("SELECT user_id, birth FROM orbit_ages"),
      q("SELECT COUNT(*) AS n FROM orbit_tokens"),
      q("SELECT user_id, LENGTH(data) AS size, at FROM orbit_data"),
      q("SELECT k, v, at FROM orbit_kv WHERE k IN ('nebula', 'answered')"),
      q("SELECT json_extract(data, '$.appUserId') AS user_id, json_extract(data, '$.productId') AS plan FROM rows WHERE entity = 'Base44Purchase' AND json_extract(data, '$.status') = 'paid' AND json_extract(data, '$.productId') LIKE 'orbit-%'"),
    ]);
    const by = (rows) => Object.fromEntries(rows.map((r) => [r.user_id, r]));
    const planOf = {}; for (const r of paid) if (r.plan === "orbit-expert" || !planOf[r.user_id]) planOf[r.user_id] = r.plan;
    const N = by(names), S = by(sessions), T = by(terms), A = by(ages);
    const apps = {}, C = {};
    for (const c of conns) {
      (C[c.user_id] ||= []).push(c.provider);
      apps[c.provider] = (apps[c.provider] || 0) + 1;
    }
    const people = [...new Set([...names, ...sessions, ...terms, ...ages, ...synced].map((r) => r.user_id))]
      .map((id) => {
        const s = S[id], t = T[id];
        return {
          id,
          name: (N[id] && N[id].name) || "",
          lastSignIn: (N[id] && N[id].at) || 0,
          plan: (planOf[id] || "free").replace("orbit-", ""),
          limit: PLAN_LIMITS[planOf[id] || "free"],
          used: s ? Number(s.used) / 10 : 0,
          resetAt: s ? Number(s.start) + SESSION_MS : 0,
          terms: !t ? "not yet" : t.version === "declined" ? "declined" : "accepted",
          termsVersion: t && t.version !== "declined" ? t.version : null,
          // Only the age group: the birthday itself stays out of Monitor.
          age: !A[id] ? "not set" : yearsOld(A[id].birth, now) < 13 ? "under 13" : "13+",
          apps: C[id] || [],
        };
      })
      .sort((a, b) => b.lastSignIn - a.lastSignIn);
    const note = Object.fromEntries(notes.map((x) => [x.k, { v: x.v, at: x.at }]));
    return json({
      totals: {
        people: people.length,
        devices: (devices[0] && devices[0].n) || 0,
        activeNow: sessions.length,
        creditsNow: Math.round(people.reduce((n, p) => n + p.used, 0) * 10) / 10,
        accepted: people.filter((p) => p.terms === "accepted").length,
        declined: people.filter((p) => p.terms === "declined").length,
        under13: people.filter((p) => p.age === "under 13").length,
      },
      sessionLimit: SESSION_LIMIT,
      apps,
      people,
      nebula: note.nebula || null,
      answered: note.answered || null,
      at: new Date(now).toISOString(),
    });
  } catch (err) {
    return json({ error: "Couldn't load Orbit.", detail: String((err && err.message) || err) }, 500);
  }
}
