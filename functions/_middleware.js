// Maintenance for the Pages address (nebuluxai.pages.dev), which doesn't go through the site
// router Worker that shows "temporarily down" on nebuluxai.com (workers/nebulux-site-router,
// MAINTENANCE there). Only the background calls other parts of the site make here keep working:
// the support email's AI reply and the router looking up published pages.
import { useOwnDb } from "../cloudflare-lib/published.js";
import { logError } from "../cloudflare-lib/errorlog.js";

const ALLOWED = [/^\/api\/support-reply$/, /^\/api\/apps\/[^/]+\/functions\/get-(site|game)-html$/];
const MAINTENANCE = true;

const DOWN_PAGE =
  "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex'><title>Nebulux AI</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:22px;font-weight:600;max-width:420px;line-height:1.4}</style></head><body><h1>Sorry, Nebulux AI is down for maintenance right now. Come back soon!</h1></body></html>";

export async function onRequest(context) {
  useOwnDb(context.env && context.env.DB);
  const url = new URL(context.request.url);
  if (MAINTENANCE && url.hostname.endsWith(".pages.dev") && !ALLOWED.some((r) => r.test(url.pathname))) {
    return new Response(DOWN_PAGE, { status: 503, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  // A crash in any server code is recorded for Monitor → Errors, and people get a plain error
  // instead of Cloudflare's "Worker threw exception" page.
  try {
    return await context.next();
  } catch (err) {
    context.waitUntil(logError(context.env && context.env.DB, { kind: "server", message: (err && err.message) || String(err), stack: err && err.stack, path: url.pathname }).catch(() => {}));
    return new Response(JSON.stringify({ error: "Something went wrong on our side. Please try again." }), { status: 500, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
}
