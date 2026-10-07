// Website Designer → Dashboard → AI: let visitors of your published site use Nebulux AI, paid
// from your prepaid API balance (functions/v1/site-chat.js). Owner (or admin) only.
//   { site }                                      -> { on, model, instructions, billing: { agreed, useApi, balanceText } }
//   { site, action: "set", on, model, instructions } -> same
import { json, badName, ownerOf } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { account, dollars } from "../../../../../cloudflare-lib/apibilling.js";

const MODELS = ["nebulux-ai", "galaxy", "space", "nebula"];

export async function onRequestPost({ request, env }) {
  const kv = env.PUBLISHED_HTML;
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  const body = await request.json().catch(() => ({}));
  const site = String(body.site || "").trim().toLowerCase();
  if (!site || badName("site", site)) return json({ error: "Unknown site." }, 400);
  const owner = await ownerOf(request, kv, "site", site);
  if (owner !== user.id && user.role !== "admin") return json({ error: "Publish the site first. Only its owner can change this." }, 403);
  const key = `siteai:${site}`;
  let cfg = (await kv.get(key, "json").catch(() => null)) || { on: false, model: "nebulux-ai", instructions: "" };
  if (body.action === "set") {
    const a = env.DB ? await account(env.DB, user.id) : { agreedAt: null };
    if (body.on && !a.agreedAt) return json({ error: "Agree to API billing on the Nebulux Platform (nebuluxai.com/api) first." }, 400);
    cfg = {
      on: !!body.on,
      model: MODELS.includes(body.model) ? body.model : "nebulux-ai",
      instructions: String(body.instructions || "").slice(0, 2000),
      owner: owner || user.id, // the account that pays
      at: new Date().toISOString(),
    };
    await kv.put(key, JSON.stringify(cfg));
  }
  const a = env.DB ? await account(env.DB, user.id) : { balances: {} };
  const m = cfg.model || "nebulux-ai";
  return json({ on: !!cfg.on, model: m, instructions: cfg.instructions || "", billing: { agreed: !!a.agreedAt, useApi: !!a.useApi, balanceText: "$" + dollars((a.balances || {})[m] || 0) } });
}
