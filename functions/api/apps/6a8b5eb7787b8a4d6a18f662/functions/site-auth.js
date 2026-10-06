// The Website Designer dashboard's "Sign in" section (cloudflare-lib/siteauth.js). Owner (or admin) only.
//   { action: "users", site }                         -> { users: [{ email, name, picture, first_at, last_at, count }] }
//   { action: "remove", site, email }                 -> { users }
//   { action: "config", site }                        -> { own: bool, clientId, canOwn: bool }
//   { action: "set-config", site, clientId, clientSecret } -> { own: true, clientId }  (Pro and up)
//   { action: "clear-config", site }                  -> { own: false }
// The client secret is kept on the server and never sent back.
import { json, badName, ownerOf } from "../../../../../cloudflare-lib/published.js";
import { currentUser, entitlement } from "../../../../../cloudflare-lib/credits.js";
import { listVisitors, removeVisitor, configKey, OWN_SCREEN_PLANS } from "../../../../../cloudflare-lib/siteauth.js";

export async function onRequestPost({ request, env }) {
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const body = await request.json().catch(() => ({}));
    const site = String(body.site || "").trim().toLowerCase();
    if (!site || badName("site", site)) return json({ error: "Unknown site." }, 400);
    const owner = await ownerOf(request, kv, "site", site);
    if (owner !== user.id && user.role !== "admin") return json({ error: "Only the site's owner can see this. Publish the site first." }, 403);
    const action = String(body.action || "users");

    if (action === "users") return json({ users: env.DB ? await listVisitors(env.DB, site) : [] });
    if (action === "remove") {
      if (env.DB) await removeVisitor(env.DB, site, body.email);
      return json({ users: env.DB ? await listVisitors(env.DB, site) : [] });
    }
    const plan = (await entitlement(kv, request, user)).plan;
    const canOwn = OWN_SCREEN_PLANS.includes(plan);
    if (action === "config") {
      const c = await kv.get(configKey(site), "json").catch(() => null);
      return json({ own: !!(c && c.clientId), clientId: (c && c.clientId) || "", canOwn });
    }
    if (action === "set-config") {
      if (!canOwn) return json({ error: "Your own Google sign-in screen needs Pro or higher." }, 403);
      const clientId = String(body.clientId || "").trim();
      const clientSecret = String(body.clientSecret || "").trim();
      if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) return json({ error: "That doesn't look like a Google client ID (it ends in .apps.googleusercontent.com)." }, 400);
      if (clientSecret.length < 10 || clientSecret.length > 200) return json({ error: "Paste the client secret from Google." }, 400);
      await kv.put(configKey(site), JSON.stringify({ clientId, clientSecret, by: user.id, at: new Date().toISOString() }));
      return json({ own: true, clientId, canOwn });
    }
    if (action === "clear-config") {
      await kv.delete(configKey(site));
      return json({ own: false, clientId: "", canOwn });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
