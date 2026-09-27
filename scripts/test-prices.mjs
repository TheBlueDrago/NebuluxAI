// Offline guard: the price and credits people see are what checkout charges and what the
// credit server gives. Plan prices are written in several places (Base44's create-checkout,
// which charges, and every page that shows them); if one changes without the others, people
// would see one price and pay another. Run: node scripts/test-prices.mjs
import { readFileSync } from "node:fs";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const load = (p) => import(new URL("../" + p, import.meta.url).href);

// What checkout charges (authoritative).
const checkout = read("base44/functions/create-checkout/entry.ts");
const planPrice = (id) => Number((checkout.match(new RegExp(`\\b${id}: \\{\\s*name: "[^"]+",\\s*price: "([\\d.]+)"`)) || [])[1]);
const PRICE = { pro: planPrice("pro"), team: planPrice("team") };
// As prices are written: $15, $10.
const usd = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
assert(PRICE.pro > 0 && PRICE.team > 0, `checkout prices found (Pro $${PRICE.pro}, Team $${PRICE.team})`);

// Every page that shows a plan price.
const { PUBLIC_PLANS } = await load("src/lib/publicPlans.js");
for (const id of ["pro", "team"]) {
  const p = PUBLIC_PLANS.find((x) => x.id === id);
  assert(p && Number(p.price.replace("$", "")) === PRICE[id], `public pricing shows ${id} at checkout's price`);
}
const billing = read("src/pages/Billing.jsx");
for (const id of ["pro", "team"]) {
  const block = billing.slice(billing.indexOf(`    ${id}: {`), billing.indexOf("icon:", billing.indexOf(`    ${id}: {`)));
  const n = PRICE[id];
  assert(block.includes(`amount: ${n},`) && block.includes(`price: "$${usd(n)} / month"`) && block.includes(`Subscribe — $${usd(n)}/mo`), `Billing shows and totals ${id} at $${n}`);
}
const shop = read("src/components/Subscriptions.jsx");
const card = (fn) => shop.slice(shop.indexOf(`function ${fn}`), shop.indexOf("\nfunction ", shop.indexOf(`function ${fn}`) + 1));
assert(card("Plan2Card").includes(`<PriceTag amount={${PRICE.pro}}`), "the Shop's Pro card shows checkout's price");
assert(card("TeamCard").includes(`<PriceTag amount={${PRICE.team}}`), "the Shop's Team card shows checkout's price");
const panel = read("src/components/profile/SubscriptionPanel.jsx");
assert(panel.includes(`pro: { name: "Pro", price: "$${usd(PRICE.pro)} a month" }`) && panel.includes(`team: { name: "Team", price: "$${usd(PRICE.team)} a month" }`), "Settings → Subscriptions shows checkout's prices");
const refresh = read("src/lib/creditRefresh.js");
assert(refresh.includes(`{ id: "pro", name: "Pro", price: ${PRICE.pro} }`) && refresh.includes(`{ id: "team", name: "Team", price: ${PRICE.team} }`), "the out-of-credits Upgrade button uses checkout's prices");

// Credits: what checkout's receipt says, what pages promise, and what the credit server gives.
const { PLAN_TOTALS } = await load("cloudflare-lib/planTotals.js");
for (const id of ["pro", "team"]) {
  const t = PLAN_TOTALS[id];
  const desc = (checkout.match(new RegExp(`${id}: \\{[\\s\\S]*?description: "([^"]+)"`)) || [])[1] || "";
  assert(desc.includes(`${t.ai} Nebulux AI`) && desc.includes(`${t.aiCode} Code`) && desc.includes(`${t.galaxy5} Galaxy`) && desc.includes(`${t.space5} Space`), `checkout's ${id} description matches its monthly credits`);
  const pub = PUBLIC_PLANS.find((x) => x.id === id).features.join(" | ");
  assert(pub.includes(`${t.ai} Nebulux AI credits`) && pub.includes(`${t.aiCode} each of Code, Galaxy and Space`) && t.aiCode === t.galaxy5 && t.galaxy5 === t.space5, `public pricing lists ${id}'s credits`);
}
const pro = card("Plan2Card");
const team = card("TeamCard");
const has = (src, t) => src.includes(`${t.ai} Nebulux AI credits`) && src.includes(`${t.aiCode} Nebulux Code credits`) && src.includes(`${t.galaxy5} Galaxy credits`) && src.includes(`${t.space5} Space credits`);
assert(has(pro, PLAN_TOTALS.pro), "the Shop's Pro card lists the credits Pro gives");
assert(has(team, PLAN_TOTALS.team), "the Shop's Team card lists the credits Team gives");
assert(PUBLIC_PLANS.find((x) => x.id === "free").features.some((f) => f.startsWith(`${PLAN_TOTALS.free.ai} Nebulux AI credits`)), "public pricing lists Free's credits");

// Credit packs: checkout's price table matches the app's.
const { PACK_PRICES } = await load("cloudflare-lib/creditPacks.js");
const SLUG = { ai: "ai", aiCode: "code", galaxy5: "galaxy", space5: "space" };
const rows = Object.fromEntries([...checkout.matchAll(/^\s+(ai|code|galaxy|space): (\{ \d+: [^}]+\}),?$/gm)].map((m) => [m[1], m[2]]));
assert(Object.entries(PACK_PRICES).every(([tier, sizes]) => rows[SLUG[tier]] === `{ ${Object.entries(sizes).map(([n, p]) => `${n}: "${p}"`).join(", ")} }`), `credit-pack prices match checkout (${JSON.stringify(rows)})`);

// Prices written out in words anywhere in the app, link previews and guides ("Pro is $1 a
// month", "$5 a month for the whole team"): each one next to "Pro" or "Team" must be that
// plan's checkout price.
{
  const { readdirSync, statSync } = await import("node:fs");
  const root = new URL("../", import.meta.url);
  const files = [];
  const walk = (rel) => {
    for (const f of readdirSync(new URL(rel, root))) {
      const p = `${rel}${f}`;
      if (statSync(new URL(p, root)).isDirectory()) walk(`${p}/`);
      else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
    }
  };
  walk("src/");
  walk("cloudflare-lib/");
  walk("functions/");
  let checked = 0;
  const wrong = [];
  for (const file of files) {
    const text = read(file);
    for (const m of text.matchAll(/\$(\d+(?:\.\d+)?)(?= ?(?:a |per |\/ ?)(?:month|mo)\b)/g)) {
      const around = text.slice(Math.max(0, m.index - 40), m.index + 40);
      const at = Math.min(40, m.index);
      const near = (re) => {
        let best = Infinity;
        for (const k of around.matchAll(re)) best = Math.min(best, Math.abs(k.index - at));
        return best;
      };
      const dPro = near(/\bPro\b/g);
      const dTeam = near(/\b[Tt]eam\b/g);
      if (dPro === Infinity && dTeam === Infinity) continue;
      const plan = dPro < dTeam ? "pro" : "team";
      checked++;
      if (Number(m[1]) !== PRICE[plan]) wrong.push(`${file}: "${around.replace(/\s+/g, " ").trim()}" (${plan} is $${PRICE[plan]})`);
    }
  }
  assert(checked >= 8 && wrong.length === 0, `every written Pro/Team price matches checkout (${checked} checked)${wrong.length ? ": " + wrong.join(" | ") : ""}`);
}
