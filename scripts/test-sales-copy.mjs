// Offline test: while paid plans and credit packs can't be bought (SALES_OPEN in src/lib/salesOpen.js), the
// public pages say they're coming soon instead of offering them: the Pro and Team cards say Coming soon,
// the pricing page's first line and credits answer say so, and the home page doesn't send people to a
// credit packs section that isn't there. Run: node scripts/test-sales-copy.mjs
import { readFileSync } from "node:fs";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const open = /export const SALES_OPEN = true/.test(read("lib/salesOpen.js"));
const cards = read("components/landing/PricingCards.jsx"), pricing = read("pages/Pricing.jsx"), landing = read("pages/Landing.jsx");
assert(/import \{ SALES_OPEN \} from "@\/lib\/salesOpen"/.test(cards) && /!SALES_OPEN && \(p\.id === "pro" \|\| p\.id === "team"\)[\s\S]{0,300}Coming soon/.test(cards), "the Pro and Team cards say Coming soon while sales are closed");
assert(/SALES_OPEN\s*\?\s*"Start free\. Pro is[^"]*"\s*:\s*"Start free\. Paid plans are coming soon/.test(pricing), "the pricing page's first line says paid plans are coming soon while sales are closed");
assert(/SALES_OPEN \? ", and paid plans get higher limits\." : "\. Paid plans with higher limits are coming soon\."/.test(pricing), "the usage limits answer says paid plans are coming soon while sales are closed");
assert(/SALES_OPEN \? "Just need a few more credits\?[^"]*" : "[^"]*coming soon too\."/.test(landing), "the home page says packs are coming soon too while sales are closed");
// Links to a section of another page only where that section exists.
const all = cards + pricing + landing;
assert(!/to="\/pricing#/.test(all) || /id="packs"/.test(pricing), "no link to a pricing page section that isn't there");
console.log(open ? "(sales are open now)" : "(sales are closed now)");
// What search engines and link previews show for /pricing says the same.
const { PAGES } = await import("../cloudflare-lib/pagemeta.js");
assert(open ? /credit packs start/.test(PAGES.pricing.description) : /coming soon/i.test(PAGES.pricing.description) && !/packs start at/.test(PAGES.pricing.description), "the pricing page's search description follows SALES_OPEN too");
