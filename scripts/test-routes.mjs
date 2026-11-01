// Offline test for public/_routes.json: plain files skip the server code (so they don't use the free plan's
// 100,000 requests a day), while pages, the API and everything in functions/ still go through it.
// Run: node scripts/test-routes.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const spec = JSON.parse(readFileSync(join(root, "public/_routes.json"), "utf8"));
const rx = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const goesToServer = (path) => spec.include.some((p) => rx(p).test(path)) && !spec.exclude.some((p) => rx(p).test(path));

assert(spec.version === 1 && Array.isArray(spec.include) && Array.isArray(spec.exclude) && spec.include.length + spec.exclude.length <= 100, "the routes file is Cloudflare's version 1, with at most 100 rules");
assert(spec.include.includes("/*"), "everything goes to the server code unless it's left out");

// every left-out path is a real file or folder the site serves (assets/ comes from the build)
const missing = spec.exclude.filter((p) => p !== "/assets/*" && !existsSync(join(root, "public", p.replace(/\/\*$/, "").slice(1))));
assert(!missing.length, "every left-out path is a plain file in public/ (" + missing.join(", ") + ")");

// nothing in functions/ is left out
const fnRoutes = [];
const walk = (dir, base) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, base + "/" + f);
    else if (f.endsWith(".js") && !f.startsWith("_")) fnRoutes.push((base + "/" + f.replace(/\.js$/, "")).replace(/\/index$/, "").replace(/\[\[?[^\]]+\]\]?/g, "x"));
  }
};
walk(join(root, "functions"), "");
const skipped = fnRoutes.filter((r) => !goesToServer(r || "/"));
assert(fnRoutes.length > 20 && !skipped.length, "every route in functions/ still reaches the server code (" + skipped.join(", ") + ")");

assert(["/", "/chat", "/chat/settings", "/about", "/guides/zoom", "/play/veck", "/api/apps/x/functions/credits", "/v1/connect", "/site-auth/x", "/robots.txt", "/sitemap.xml"].every(goesToServer), "pages, the API, sign-in and the crawler files still go through the server");
assert(["/assets/index-abc123.js", "/assets/index-abc123.css", "/logos/slack.svg", "/game-thumbs/veck.jpg", "/og-image.jpg", "/nebulux-reel.mp4", "/sw.js"].every((p) => !goesToServer(p)), "the app's code, pictures, logos and videos are served without it");
