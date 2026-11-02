// Offline test: what search engines read on the home page. Its structured data is valid JSON and names
// the site (Google shows that name above its results), and its title says what Nebulux AI is, not just
// the name. Run: node scripts/test-seo.mjs
import { readFileSync } from "node:fs";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let ld = null;
try { ld = JSON.parse((html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1]); } catch {}
const graph = (ld && ld["@graph"]) || [];
assert(graph.some((x) => x["@type"] === "WebSite" && x.name === "Nebulux AI" && x.url === "https://nebuluxai.com/"), "the home page's structured data names the site Nebulux AI");
assert(graph.some((x) => x["@type"] === "WebApplication" && x.offers && x.offers.price === "0"), "and describes the app as free to start");
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
assert(/^Nebulux AI: /.test(title) && title.length <= 60, `the home page's title says what it is and fits in search results ("${title}")`);
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const home = (sitemap.match(/<loc>https:\/\/nebuluxai\.com\/<\/loc><lastmod>([^<]+)/) || [])[1];
assert(home && home >= "2026-11-01", "the sitemap's date for the home page counts changes to its sections too (" + home + ")");
