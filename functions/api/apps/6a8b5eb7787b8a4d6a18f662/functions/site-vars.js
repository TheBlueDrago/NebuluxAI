// Website Designer → Dashboard → Variables (cloudflare-lib/sitevars.js). Owner (or admin) only.
//   { site }                                        -> { vars: [{ name, type, value }] }  (secrets hidden)
//   { site, action: "set", name, type, value }      -> same (adds or replaces one)
//   { site, action: "delete", name }                -> same
// A secret's value is never sent back, not even to its owner: it can only be replaced.
import { json, badName, ownerOf } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { readVars, varsKey, VAR_NAME, MAX_VARS } from "../../../../../cloudflare-lib/sitevars.js";

const shown = (vars) => vars.map((v) => ({ name: v.name, type: v.type, value: v.type === "secret" ? "" : v.value, set: !!v.value }));

export async function onRequestPost({ request, env }) {
  const kv = env.PUBLISHED_HTML;
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  const body = await request.json().catch(() => ({}));
  const site = String(body.site || "").trim().toLowerCase();
  if (!site || badName("site", site)) return json({ error: "Unknown site." }, 400);
  const owner = await ownerOf(request, kv, "site", site);
  if (owner !== user.id && user.role !== "admin") return json({ error: "Publish the site first. Only its owner can change this." }, 403);
  let vars = await readVars(kv, site);
  if (body.action === "set") {
    const name = String(body.name || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!VAR_NAME.test(name)) return json({ error: "Names start with a letter and use only A-Z, 0-9 and _ (like API_KEY)." }, 400);
    const type = body.type === "secret" ? "secret" : "text";
    const value = String(body.value ?? "");
    if (value.length > 4000) return json({ error: "That value is too long (4,000 characters max)." }, 400);
    if (!value && type === "secret") return json({ error: "Type the secret's value." }, 400);
    const rest = vars.filter((v) => v.name !== name);
    if (rest.length >= MAX_VARS) return json({ error: `A site can have up to ${MAX_VARS} variables.` }, 400);
    vars = [...rest, { name, type, value }].sort((a, b) => a.name.localeCompare(b.name));
    await kv.put(varsKey(site), JSON.stringify({ vars, at: new Date().toISOString() }));
  } else if (body.action === "delete") {
    vars = vars.filter((v) => v.name !== String(body.name || ""));
    await kv.put(varsKey(site), JSON.stringify({ vars, at: new Date().toISOString() }));
  }
  return json({ vars: shown(vars) });
}
