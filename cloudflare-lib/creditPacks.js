// One-time credit packs: bought instead of a plan (whatever the plan), added to the buyer's
// bonus balance (credits.js), and never reset at the end of the month. Every AI comes in
// the same sizes. The Base44 create-checkout function holds the authoritative prices, so keep
// PACK_PRICES in step with its copy.
//
// Priced by the owner (2026-09-27; Pro $15, Team $20): Pro's credits (100 AI + 50 each of Code,
// Space and Nebula) as packs cost about $12 and Team's about $20; plans add their features and
// refill every month. Bigger packs cost less per credit. The smallest pack is 25 credits ($0.99+),
// so every sale is above what card payments take in fees (about 30¢ each).
export const PACK_SIZES = [25, 50, 100];
export const PACK_PRICES = {
  ai: { 25: "0.99", 50: "1.79", 100: "2.99" },
  aiCode: { 25: "1.49", 50: "2.69", 100: "4.49" },
  galaxy5: { 25: "1.69", 50: "2.99", 100: "4.99" },
  space5: { 25: "1.89", 50: "3.39", 100: "5.49" },
};
// Product ids: credits-<ai>-<size>, e.g. "credits-galaxy-25".
const SLUG = { ai: "ai", aiCode: "code", galaxy5: "galaxy", space5: "space" };

export const CREDIT_PACKS = {};
for (const [tier, prices] of Object.entries(PACK_PRICES)) {
  for (const size of PACK_SIZES) CREDIT_PACKS[`credits-${SLUG[tier]}-${size}`] = { tier, credits: size, price: prices[size] };
}
// At most this many packs in one purchase.
export const MAX_PACKS = 10;
// The size a pack picker starts on.
export const DEFAULT_PACK_SIZE = 25;

// -> [[productId, pack], ...] for a credit tier, smallest first.
export const packsForTier = (tier) => Object.entries(CREDIT_PACKS).filter(([, p]) => p.tier === tier);
