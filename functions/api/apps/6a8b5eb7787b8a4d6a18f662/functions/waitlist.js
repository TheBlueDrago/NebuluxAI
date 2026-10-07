// Monitor → Waitlist (cloudflare-lib/waitlist.js). Admins only (admin accounts use two-step sign-in).
// Emails are shown partly hidden; the full list only comes out through "export" (Download CSV),
// at most 5 times an hour, and every export is written to the admin log (who, when, where).
//   { action: "list" }           -> { people: [{ key, email: "ja***@gmail.com", joined_at }] }
//   { action: "export" }         -> { people: [{ email, joined_at }] }   (full emails)
//   { action: "remove", key }    -> { people }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";
import { logAdmin } from "../../../../../cloudflare-lib/audit.js";
import { listWaitlist, removeFromWaitlist } from "../../../../../cloudflare-lib/waitlist.js";

export const maskEmail = (e) => {
  const [name, domain] = String(e).split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(3, name.length - 2))}@${domain || ""}`;
};
const keyOf = async (e) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e)))].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
const masked = async (rows) => Promise.all(rows.map(async (r) => ({ key: await keyOf(r.email), email: maskEmail(r.email), joined_at: r.joined_at })));

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (user.role !== "admin") return json({ error: "Admins only." }, 403);
  if (!env.DB) return json({ people: [] });
  const body = await request.json().catch(() => ({}));

  if (body.action === "export") {
    if (!(await allow(`waitlist-export:${user.id}`, 5, 3600))) return json({ error: "You can download the waitlist up to 5 times an hour." }, 429);
    const people = await listWaitlist(env.DB);
    await logAdmin(env.PUBLISHED_HTML, user, "waitlist-export", { count: people.length }, request).catch(() => {});
    return json({ people });
  }
  if (body.action === "remove" && body.key) {
    for (const r of await listWaitlist(env.DB)) if ((await keyOf(r.email)) === body.key) await removeFromWaitlist(env.DB, r.email);
  }
  return json({ people: await masked(await listWaitlist(env.DB)) });
}
