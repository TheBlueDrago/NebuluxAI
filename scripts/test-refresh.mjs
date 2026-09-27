// Offline test for the out-of-credits card's choices (src/lib/creditRefresh.js): which plan
// to upgrade to and for how much, and when the monthly credits come back.
// Run: node scripts/test-refresh.mjs
const R = new URL("../", import.meta.url).pathname;
const { outOfCreditsOptions, nextRefresh, waitText } = await import(R + "src/lib/creditRefresh.js");
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const now = Date.parse("2026-09-24T19:30:00Z");
const oct1 = Date.parse("2026-10-01T00:00:00Z");

assert(nextRefresh(now) === oct1, "credits come back at midnight UTC on the 1st");
assert(nextRefresh(Date.parse("2026-12-31T23:59:00Z")) === Date.parse("2027-01-01T00:00:00Z"), "December rolls over to January");
assert(waitText(oct1 - now) === "6 days 4 hours", "wait shown in days and hours");
assert(waitText(3 * 3600000 + 12 * 60000) === "3 hours 12 minutes" && waitText(5 * 60000) === "5 minutes" && waitText(1000) === "1 minute", "shorter waits");

let o = outOfCreditsOptions("ai", { plan: "free" }, now);
assert(o.upgrade === null && o.pack === null && o.refresh.amount === 100, "plans and packs coming soon: nothing to buy, Free's 100 come back on the 1st");
o = outOfCreditsOptions("ai", { plan: "free" }, now, true);
assert(o.upgrade.id === "team" && o.upgrade.price === 20 && o.upgrade.extra === 50 && !o.upgrade.salePrice, "(when buying opens) Free, Nebulux AI: Team for $20, 50 more now");
assert(o.refresh.at === oct1 && o.refresh.amount === 100, "Free, Nebulux AI: 100 come back on the 1st");

o = outOfCreditsOptions("galaxy5", { plan: "free" }, now, true);
assert(o.upgrade.id === "team" && o.upgrade.extra === 50 && o.refresh.amount === 50, "Free has 50 Galaxy: Team for more, or wait for 50");

o = outOfCreditsOptions("space5", { plan: "pro", planSource: "paid" }, now, true);
assert(o.upgrade.id === "team" && o.upgrade.price === 20 && o.upgrade.extra === 50 && o.refresh.amount === 50, "Pro: Team for $20, or wait for 50");

o = outOfCreditsOptions("ai", { plan: "free", offer: { discountAvailable: true, discountPct: 30 } }, now, true);
assert(o.upgrade.salePrice === "14.00", "a member offer: Team shown at $14.00 (30% off $20)");

o = outOfCreditsOptions("ai", { plan: "pro", planSource: "grant", planEndsAt: "2026-09-28T00:00:00Z" }, now, true);
assert(o.upgrade.id === "team" && o.refresh.amount === 100, "a plan ending before the 1st: Free's 100 come back");

o = outOfCreditsOptions("aiCode", { plan: "team" }, now);
assert(o.upgrade === null && o.refresh.amount === 100, "Team: nothing to upgrade to, just wait");

o = outOfCreditsOptions("space5", { plan: "enterprise", shared: true, seats: 4 }, now);
assert(o.upgrade === null && o.refresh.amount === 100, "Enterprise: the pool refills 25 Space per seat");

o = outOfCreditsOptions("ai", { plan: "free" }, now, true);
assert(o.pack && o.pack.id === "credits-ai-25" && o.pack.min === 25 && o.pack.max === 100 && Number(o.pack.from) === 0.99, "Nebulux AI packs of 25-100 credits, from $0.99, starting on 25");
o = outOfCreditsOptions("space5", { plan: "team" }, now, true);
assert(o.upgrade === null && o.pack.id === "credits-space-25", "Team, nothing to upgrade to: can still buy a Space pack");
o = outOfCreditsOptions("galaxy5", { plan: "free" }, now, true);
assert(o.pack.id === "credits-galaxy-25", "Free can buy Galaxy packs without a plan");
const P = await import(R + "cloudflare-lib/creditPacks.js");
const ids = Object.keys(P.CREDIT_PACKS);
assert(ids.length === 12 && ["ai", "code", "galaxy", "space"].every((a) => [25, 50, 100].every((n) => P.CREDIT_PACKS[`credits-${a}-${n}`])), "every AI has packs of 25, 50 and 100");
assert(Object.values(P.CREDIT_PACKS).every((p) => Number(p.price) >= 0.5), "no pack is under the $0.50 payment minimum");
const price = (id) => P.CREDIT_PACKS[id].price;
assert(["ai", "code", "galaxy", "space"].map((a) => price(`credits-${a}-50`)).join() === "1.79,2.69,2.99,3.39", "50 credits: AI $1.79, Code $2.69, Galaxy $2.99, Space $3.39");
assert(["ai", "code", "galaxy", "space"].every((a) => Number(price(`credits-${a}-50`)) < 15), "every 50-credit pack costs less than Pro ($15)");
assert(["ai", "code", "galaxy", "space"].every((a) => Number(price(`credits-${a}-25`)) / 25 > Number(price(`credits-${a}-50`)) / 50 && Number(price(`credits-${a}-50`)) / 50 > Number(price(`credits-${a}-100`)) / 100), "bigger packs cost less per credit");
{
  // Pro's credits bought as packs: 100 AI + 50 each of the others (about $12; Pro adds features).
  const asPacks = Number(price("credits-ai-100")) + ["code", "galaxy", "space"].reduce((n, a) => n + Number(price(`credits-${a}-50`)), 0);
  assert(asPacks > 10 && asPacks < 3 * 15, `Pro's credits as packs cost $${asPacks.toFixed(2)}: a plan is the better deal, packs still make sense`);
}
