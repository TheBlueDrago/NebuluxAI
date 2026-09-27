// Offline test for the how-to guides (cloudflare-lib/guides.js, functions/guides/*).
// Run: node scripts/test-guides.mjs
import fs from "node:fs";
import { GUIDES, guideBySlug, guideHtml, guideJsonLd, guidesListHtml } from "../cloudflare-lib/guides.js";
import { withMeta, PAGES } from "../cloudflare-lib/pagemeta.js";
import { withGameMeta } from "../cloudflare-lib/playmeta.js";
import { onRequestGet as serveGuide } from "../functions/guides/[slug].js";
import { onRequestGet as serveList } from "../functions/guides/index.js";

let failed = 0;
const assert = (c, m) => {
  console.log((c ? "ok " : "FAIL ") + m);
  if (!c) failed++;
};

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

// The guides themselves.
const slugs = GUIDES.map((g) => g.slug);
assert(GUIDES.length >= 5 && new Set(slugs).size === slugs.length, "at least 5 guides, each with its own address");
for (const g of GUIDES) {
  assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug), `${g.slug}: a clean address`);
  assert(g.title.length <= 60 && g.description.length >= 100 && g.description.length <= 160, `${g.slug}: title and description fit in search results`);
  assert(g.intro && g.sections.length >= 3 && g.sections.every((s) => s.heading && (s.paragraphs?.length || s.list?.length)), `${g.slug}: an intro and real sections`);
  assert(g.cta?.to?.startsWith("/") && (!g.more || g.more.to.startsWith("/")), `${g.slug}: its buttons stay on the site`);
  assert((g.related || []).every((r) => r !== g.slug && guideBySlug(r)), `${g.slug}: related guides exist`);
  assert(sitemap.includes(`https://nebuluxai.com/guides/${g.slug}</loc>`), `${g.slug}: in the sitemap`);
  const words = JSON.stringify(g);
  assert(!/\$\d+ ?(a|per) seat/.test(words), `${g.slug}: doesn't show the Enterprise price`);
}
assert(sitemap.includes("https://nebuluxai.com/guides</loc>") && PAGES.guides?.path === "/guides", "the guide list is in the sitemap and has a preview");
assert(app.includes('path="/guides"') && app.includes('path="/guides/:slug"'), "the app has both guide pages");
assert(guideBySlug("nope") === null && guideBySlug("__proto__") === null, "unknown addresses find nothing");

// Text is escaped, and structured data can't end its <script> tag early.
{
  const evil = { ...GUIDES[0], title: "<script>alert(1)</script>", intro: 'a "quote" & <b>', sections: [{ heading: "</h2><img src=x onerror=1>", list: ["<i>"] }] };
  const html = guideHtml(evil);
  assert(!html.includes("<script>") && !html.includes("<img") && !html.includes("<i>") && html.includes("&lt;script&gt;"), "guide text is escaped");
  const ld = guideJsonLd({ ...evil, description: "</script><script>alert(1)</script>" }, "https://nebuluxai.com");
  assert((ld.match(/<\/script>/g) || []).length === 1, "structured data can't close its script tag early");
  const data = JSON.parse(ld.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
  assert(data["@type"] === "Article" && data.description.includes("</script>"), "structured data is still valid and complete");
  assert(!guidesListHtml().includes("undefined") && GUIDES.every((g) => guidesListHtml().includes(`/guides/${g.slug}"`)), "the list links every guide");
}

// "$1" in a description or game name is kept as written (it used to be read as a code).
{
  const out = withMeta(index, PAGES.pricing);
  assert(out.includes('content="Free to start. Pro is $15 a month') && (out.match(/<meta name="description"/g) || []).length === 1, "Pricing's description keeps \"$1 a month\"");
  const game = withGameMeta(index, { title: "Win $1 & $& $$ prizes" });
  assert(game.includes("<title>Win $1 &amp; $&amp; $$ prizes · Nebulux AI</title>") && game.includes('content="Play Win $1 &amp; $&amp; $$ prizes"'), "a game name with $ signs stays intact");
  assert((out.match(/rel="canonical"/g) || []).length === 1 && out.includes('<link rel="canonical" href="https://nebuluxai.com/pricing" />'), "pages name their one true address");
}

// The server pages.
{
  const env = { ASSETS: { fetch: async () => new Response(index, { headers: { "content-type": "text/html" } }) } };
  const g = GUIDES[0];
  const res = await serveGuide({ request: new Request(`https://nebuluxai.com/guides/${g.slug}`), env, params: { slug: g.slug } });
  const html = await res.text();
  assert(res.status === 200 && html.includes(`<title>${g.title} · Nebulux AI</title>`), "a guide is served with its own title");
  assert(html.includes(`<div id="root"><article`) && html.includes(g.sections[1].heading.replace(/&/g, "&amp;")), "its full text is in the page before the app loads");
  assert(html.includes('"@type":"Article"') && html.includes(`<link rel="canonical" href="https://nebuluxai.com/guides/${g.slug}" />`), "it has Article data and its own address");
  assert(res.headers.get("x-frame-options") === "SAMEORIGIN", "it has the security headers");
  const miss = await serveGuide({ request: new Request("https://nebuluxai.com/guides/nope"), env, params: { slug: "nope" } });
  assert(miss.status === 404 && !(await miss.text()).includes("<article"), "an unknown guide is a 404");
  const list = await serveList({ request: new Request("https://nebuluxai.com/guides"), env });
  const listHtml = await list.text();
  assert(list.status === 200 && listHtml.includes("<title>Guides · Nebulux AI</title>") && listHtml.includes(`/guides/${GUIDES[1].slug}`), "the guide list is served with its links");
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
