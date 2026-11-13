// The public site gallery (see cloudflare-lib/showcase.js).
// Body: { action: "list" }                     -> { sites: [{ name, title, added }] }  (anyone)
//       { action: "set", name, on, title?, remix? } -> { ok, sites }  (the site's owner or an admin)
// remix: false means the owner doesn't want a Remix button on it in the gallery (it's on unless they say no).
import { json, findByName, ownerOf } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { isBlocked } from "../../../../../cloudflare-lib/reports.js";
import { readShowcase, setShowcase, MAX_SHOWCASE } from "../../../../../cloudflare-lib/showcase.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { accountBlocked, BLOCKED_MESSAGE } from "../../../../../cloudflare-lib/bans.js";

const list = async (kv) =>
  Object.entries(await readShowcase(kv))
    .map(([name, e]) => ({ name, title: e.title || "", added: e.added, remix: !e.noRemix }))
    .sort((a, b) => String(b.added).localeCompare(String(a.added)));

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    if (!kv) return json({ sites: [] });
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    if (body.action !== "set") return json({ sites: await list(kv) });

    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    if (!(await allow(`showcase:${user.id}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
    if (await accountBlocked(kv, user)) return json({ error: BLOCKED_MESSAGE }, 403);
    const name = String(body.name || "").toLowerCase();
    const rows = await findByName(request, "site", name);
    if (!rows.length) return json({ error: "Site not found." }, 404);
    // The real owner's row (see ownerOf): a copycat row with the same name doesn't count.
    const owner = await ownerOf(request, kv, "site", name, rows);
    const site = rows.find((r) => r.created_by_id === owner) || rows[0];
    if (owner !== user.id && user.role !== "admin") return json({ error: "Only the site's owner can do that." }, 403);

    if (body.on) {
      if (site.hidden || (await isBlocked(kv, "site", name))) {
        return json({ error: "Publish the site (make it visible) before adding it to the gallery." }, 400);
      }
      const title = String(body.title || "").trim().slice(0, 60);
      if (!(await setShowcase(kv, name, { owner: site.created_by_id, title, ...(body.remix === false ? { noRemix: true } : {}) }))) {
        return json({ error: `The gallery is full (${MAX_SHOWCASE} sites).` }, 409);
      }
    } else {
      await setShowcase(kv, name, null);
    }
    return json({ ok: true, sites: await list(kv) });
  } catch (err) {
    return json({ error: (err && err.message) || "Could not update the gallery." }, 500);
  }
}
