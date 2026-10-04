// Serves published website/game HTML out of the PUBLISHED_HTML KV namespace.
// The Base44 PublishedSite/PublishedGame `html` field points here (see
// cloudflare-lib/published.js), and Base44's get-site-html/get-game-html fetch it.
import { ENTITY, findByName, kvKey } from "../../../cloudflare-lib/published.js";
import { isBlocked } from "../../../cloudflare-lib/reports.js";
import { HEADERS, removedPage, preparePage } from "../../../cloudflare-lib/pageserve.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const kind = String(params.kind || "");
  const name = String(params.name || "").toLowerCase();
  if (!ENTITY[kind] || !name || !env.PUBLISHED_HTML) return new Response("Not found", { status: 404 });

  const kv = env.PUBLISHED_HTML;
  const stored = kv.getWithMetadata
    ? await kv.getWithMetadata(kvKey(kind, name)).catch(() => ({ value: null, metadata: null }))
    : { value: await kv.get(kvKey(kind, name)), metadata: null };
  let badge = false;
  try {
    // Only serve pages whose record still exists, so deleting a site/game takes it offline.
    // When publish() recorded the owner, it must be the owner's record: someone else's
    // record with the same name (written straight into Base44) doesn't keep it online.
    const rows = await findByName(null, kind, name);
    const owner = stored && stored.metadata && stored.metadata.owner;
    if (!rows.length || (owner && !rows.some((r) => r.created_by_id === owner))) return new Response("Not found", { status: 404 });
    const rec = (owner && rows.find((r) => r.created_by_id === owner)) || rows[0];
    badge = rec.showBadge === true;
  } catch {
    // If Base44 is unreachable, still serve what's stored rather than failing the page.
  }

  if (await isBlocked(env.PUBLISHED_HTML, kind, name)) {
    // Status 200 on purpose: Base44's get-site-html passes the body on to the subdomain
    // Worker whatever the status, and the visitor should see why the page is gone.
    return new Response(removedPage(kind), { headers: HEADERS });
  }

  const html = stored && stored.value;
  if (html == null) return new Response("Not found", { status: 404 });
  return new Response(preparePage(html, kind, name, { badge }), { headers: HEADERS });
}
