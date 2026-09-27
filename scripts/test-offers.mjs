// Offline test for the new-account offer (cloudflare-lib/offers.js): a free week of Pro,
// then 48 hours of 30% off. Run: node scripts/test-offers.mjs
const R = new URL("../", import.meta.url).pathname;
const { offerFor, discounted, OFFER_START, OFFERS_ON } = await import(R + "cloudflare-lib/offers.js");
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const DAY = 86400000;
// Switched off for now (no free week, no new-member discount): nobody gets it.
if (!OFFERS_ON) {
  assert(offerFor({ created_date: new Date().toISOString() }) === null, "the free week and discount are off: new accounts get nothing extra");
  process.exit(process.exitCode || 0);
}
const start = Date.parse(OFFER_START);
const joined = new Date(start + DAY).toISOString().replace("Z", ""); // Base44 style, no time zone

assert(offerFor({ created_date: new Date(start - DAY).toISOString() }) === null, "accounts from before the offer don't get it");
let o = offerFor({ created_date: joined }, start + 3 * DAY);
assert(o.trialActive && o.discountActive, "day 2 of the account: on the free Pro week, and the discount already works");
o = offerFor({ created_date: joined }, start + 9 * DAY);
assert(!o.trialActive && o.discountActive && o.discountPct === 30, "just after the week: 30% off for 48 hours");
o = offerFor({ created_date: joined }, start + 11 * DAY);
assert(!o.trialActive && !o.discountActive, "after the 48 hours: no offer");
assert(o.trialEndsAt === new Date(start + 8 * DAY).toISOString(), "Base44 dates without a time zone are read as UTC");
assert(discounted("1.00") === "0.70" && discounted("5.00") === "3.50" && discounted(12) === "8.40", "30% off: Pro $0.70, Team $3.50, Enterprise $8.40 a seat");
assert(offerFor({}) === null && offerFor(null) === null, "no account date, no offer");
