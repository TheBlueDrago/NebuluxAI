// Maintenance for the Pages address (nebuluxai.pages.dev), which doesn't go through the site
// router Worker that shows "temporarily down" on nebuluxai.com (workers/nebulux-site-router,
// MAINTENANCE there). Only the background calls other parts of the site make here keep working:
// the support email's AI reply and the router looking up published pages.
const ALLOWED = [/^\/api\/support-reply$/, /^\/api\/apps\/[^/]+\/functions\/get-(site|game)-html$/];
const MAINTENANCE = true;

const DOWN_PAGE =
  "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex'><title>Nebulux AI</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:22px;font-weight:600;max-width:420px;line-height:1.4}</style></head><body><h1>Sorry, this website is temporarily down. Come back later.</h1></body></html>";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (MAINTENANCE && url.hostname.endsWith(".pages.dev") && !ALLOWED.some((r) => r.test(url.pathname))) {
    return new Response(DOWN_PAGE, { status: 503, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  return context.next();
}
