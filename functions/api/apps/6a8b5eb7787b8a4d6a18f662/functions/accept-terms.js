// The user agreement (components/TermsGate.jsx). Everyone accepts it once before using the app;
// after that they are not asked again (unless TERMS_VERSION is changed on purpose for a big
// change to the Terms). An account that never accepted within 30 days counts as inactive: it's listed for
// admins in Monitor (action "overdue") to delete. Nothing is deleted automatically.
//
// { action: "get" }               -> { accepted, version, returning, deadline }
// { action: "accept", version }   -> { accepted: true }
// { action: "overdue" } (admins)  -> { users: [{ id, email, name, lastAccepted, created }] }
//
// KV (PUBLISHED_HTML): terms:<userId> = { version, at } (the latest acceptance).
import { json, base44 } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

// Accepted once, kept: this only changes when the owner wants everyone to accept again.
export const TERMS_VERSION = "2026-09-27"; // new wording (full responsibility); everyone asked again
export const termsVersion = () => TERMS_VERSION;
// The owner's own accounts: not asked again and never listed as inactive (owner's request).
export const EXEMPT = new Set(["thebluedragonstriker@gmail.com", "hiuhinarra@gmail.com", "narra.vidish@gmail.com"]);
const exempt = (u) => EXEMPT.has(String((u && u.email) || "").trim().toLowerCase());
export const GRACE_DAYS = 30;
// Nobody is counted overdue before 30 days after this version went out.
export const STARTED = Date.parse("2026-09-27T00:00:00Z");
const DAY = 86400000;
const parse = (s) => {
  const t = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(s || "")) ? s : `${s}Z`);
  return Number.isNaN(t) ? 0 : t;
};

// Overdue: never accepted, the account is over 30 days old, and the
// agreement has existed for 30 days.
export function isOverdue(rec, createdAt, now = Date.now()) {
  if (now - STARTED < GRACE_DAYS * DAY) return false;
  if (createdAt && now - createdAt < GRACE_DAYS * DAY) return false;
  return !rec || rec.version !== TERMS_VERSION; // never accepted this version
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  const version = termsVersion();
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const body = await request.json().catch(() => ({}));
    const key = `terms:${user.id}`;

    if (body.action === "overdue") {
      if (user.role !== "admin") return json({ error: "Admins only." }, 403);
      const users = (await base44(request, "GET", "entities/User?limit=5000").catch(() => [])) || [];
      // Accounts already removed in Monitor don't count (they're gone), nor admins or the owner's own.
      const removed = new Set(((await kv.get("removed-users", "json")) || []).map((r) => r.userId));
      const out = [];
      let checked = 0;
      for (const u of users) {
        if (!u || !u.id || u.role === "admin" || exempt(u) || u.removed === true || removed.has(u.id)) continue;
        checked++;
        const rec = await kv.get(`terms:${u.id}`, "json");
        if (isOverdue(rec, parse(u.created_date))) out.push({ id: u.id, email: u.email || "", name: u.full_name || "", lastAccepted: (rec && rec.at) || null, created: u.created_date || null });
      }
      return json({ users: out, checked });
    }

    if (body.action === "accept") {
      if (body.version !== version) return json({ error: "The terms were just updated. Reload the page and read them again.", version }, 409);
      const prev = await kv.get(key, "json");
      if (!prev || prev.version !== version) await kv.put(key, JSON.stringify({ version, at: new Date().toISOString() }));
      return json({ accepted: true, version });
    }

    if (exempt(user)) return json({ accepted: true, version });
    const rec = await kv.get(key, "json");
    // 30 days from when this version went out (or from signing up, for newer accounts).
    const since = Math.max(parse(user.created_date), STARTED);
    return json({
      accepted: !!rec && rec.version === version,
      version,
      returning: !!rec,
      deadline: new Date(since + GRACE_DAYS * DAY).toISOString(),
    });
  } catch {
    // The check failed: ask them to accept (the app remembers an earlier yes on the device).
    return json({ accepted: false, version, unknown: true });
  }
}
