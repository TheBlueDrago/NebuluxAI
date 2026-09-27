// Admins only: one email to every active account (signed in and confirmed, not removed, not
// banned or blocked), sent with Resend from support@nebuluxai.com (RESEND_API_KEY secret).
// { action: "preview", id }            -> { count, sample }  (who would get it; nothing sent)
// { action: "send", id, subject, text } -> { sent, failed }  (each address gets announcement `id` once)
// KV (PUBLISHED_HTML): announce:<id>:<userId> = 1 once sent, so running it again never repeats.
import { json, base44 } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { blockedBy, unverified } from "../../../../../cloudflare-lib/bans.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function recipients(request, kv) {
  const users = (await base44(request, "GET", "entities/User?limit=5000").catch(() => [])) || [];
  const removed = new Set(((await kv.get("removed-users", "json")) || []).map((r) => r.userId));
  const out = [];
  const seen = new Set();
  for (const u of users) {
    const email = String((u && u.email) || "").trim().toLowerCase();
    if (!u || !u.id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    if (u.removed === true || removed.has(u.id) || unverified(u)) continue;
    const grant = await kv.get(`grant:${u.id}`, "json").catch(() => null);
    if (blockedBy(u, grant) || (grant && grant.removed)) continue;
    if (await kv.get(`removed-email:${email}`)) continue;
    seen.add(email);
    out.push({ id: u.id, email });
  }
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user || user.role !== "admin") return json({ error: "Admins only." }, 403);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
    if (!id) return json({ error: "Give the announcement an id." }, 400);
    const list = await recipients(request, kv);

    if (body.action === "preview") {
      let already = 0;
      for (const r of list) if (await kv.get(`announce:${id}:${r.id}`)) already++;
      return json({ count: list.length, alreadySent: already, sample: list.slice(0, 5).map((r) => r.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")) });
    }

    if (body.action === "send") {
      if (!env.RESEND_API_KEY) return json({ error: "Email isn't set up (RESEND_API_KEY)." }, 503);
      const subject = String(body.subject || "").slice(0, 150);
      const text = String(body.text || "").slice(0, 5000);
      if (!subject || !text) return json({ error: "Subject and text are needed." }, 400);
      let sent = 0;
      let failed = 0;
      for (const r of list) {
        const key = `announce:${id}:${r.id}`;
        if (await kv.get(key)) continue;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ from: "Nebulux AI <support@nebuluxai.com>", to: [r.email], subject, text: `${text}\n\nNebulux AI` }),
        }).catch(() => null);
        if (res && res.ok) {
          sent++;
          await kv.put(key, "1");
        } else failed++;
        await wait(600); // Resend allows about 2 emails a second
      }
      return json({ sent, failed, total: list.length });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
