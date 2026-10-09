// Replaces Base44's hosted get-site-html (this exact path takes precedence over the
// catch-all proxy). The subdomain router Worker asks this for every page it serves on
// name.nebuluxai.com, and the Website Designer uses it to open a site for
// editing. Same contract: { name } -> { html, id, name, ownerName }.
//
// Base44's version returned whatever the PublishedSite record held, so a site written
// straight into the record (skipping publish-site) avoided the phishing check, the
// Report link, and even an admin take-down. Here every page goes through the same
// checks, wherever its HTML is kept (KV, inline in the record, or an older file URL).
import { json } from "../../../../../cloudflare-lib/published.js";
import { isBlocked } from "../../../../../cloudflare-lib/reports.js";
import { pageFor } from "../../../../../cloudflare-lib/pagesource.js";
import { removedPage, preparePage } from "../../../../../cloudflare-lib/pageserve.js";
import { readVars, withSiteVars } from "../../../../../cloudflare-lib/sitevars.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").toLowerCase();
    if (!name) return json({ error: "name required" }, 400);
    // The right copy and record for this name (copycat records are ignored; see pagesource.js).
    const page = await pageFor(request, kv, "site", name);
    if (!page) return json({ error: "not found" }, 404);
    const site = page.rec;
    const reply = (html) => json({ html, id: site.id, name: site.name, ownerName: site.ownerName });

    if (kv && (await isBlocked(kv, "site", name))) return reply(removedPage("site"));
    if (page.removed) return reply(removedPage("site", page.removed));
    let out = preparePage(page.html, "site", name, { badge: site.showBadge === true });
    // Served to visitors (the site router asks with serve: true): fill in the site's text
    // variables and add NebuluxFetch (Dashboard → Variables). The editor gets the page as written.
    if (body.serve && kv) {
      const vars = await readVars(kv, name);
      if (vars.length) out = withSiteVars(out, name, vars, "https://nebuluxai.com");
    }
    return reply(out);
  } catch (err) {
    return json({ error: (err && err.message) || "Could not load the site." }, 500);
  }
}
