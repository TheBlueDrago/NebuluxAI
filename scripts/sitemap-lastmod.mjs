// Adds <lastmod> dates to public/sitemap.xml from each page's last real content change in git:
// the page's own source file (src/pages/<Page>.jsx), the guides content (cloudflare-lib/guides.js)
// and the game files (games/<name>.html). A page whose source isn't in this repo (games stored
// only in the database) gets no date rather than a made-up one.
// Run: node scripts/sitemap-lastmod.mjs   (then commit public/sitemap.xml)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const file = new URL("public/sitemap.xml", ROOT);
const PAGES = { "": "Home", arcade: "Arcade", templates: "Templates", business: "Business", pricing: "Pricing", enterprise: "Enterprise", about: "About", status: "Status", showcase: "Showcase", guides: "Guides", "whats-new": "WhatsNew", ideas: "Ideas", register: "Register", safety: "Safety", terms: "Legal", privacy: "Legal", contact: "Contact" };

const sourceOf = (path) => {
  const [first, second] = path.replace(/^\//, "").split("/");
  if (first === "guides" && second) return "cloudflare-lib/guides.js";
  if (first === "play" && second) return `games/${second}.html`;
  if (first in PAGES) return `src/pages/${PAGES[first]}.jsx`;
  return null;
};
const lastChange = (rel) => {
  if (!rel || !existsSync(new URL(rel, ROOT))) return null;
  const d = execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: new URL(".", ROOT), encoding: "utf8" }).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

let xml = readFileSync(file, "utf8");
let dated = 0, undated = [];
xml = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>[^<]*<\/lastmod>)?\s*<\/url>/g, (_, loc) => {
  const day = lastChange(sourceOf(new URL(loc).pathname));
  if (day) dated++; else undated.push(loc);
  return `<url><loc>${loc}</loc>${day ? `<lastmod>${day}</lastmod>` : ""}</url>`;
});
writeFileSync(file, xml);
console.log(`${dated} URLs dated` + (undated.length ? `; no source in this repo for: ${undated.join(", ")}` : ""));
