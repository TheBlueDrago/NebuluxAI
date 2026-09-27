// One-time credit packs: bought instead of a plan (whatever the plan), added to the buyer's
// bonus balance (credits.js), and never reset at the end of the month. Every AI comes in
// the same sizes. The Base44 create-checkout function holds the authoritative prices, so keep
// PACK_PRICES in step with its copy.
//
// Priced against the plans (2026-09-27: Pro $15, Team $20): buying Pro's credits (100 AI + 50 each of
// Code, Galaxy and Space) as packs costs about $20, and Team's about $35, so a plan is the better
// deal and packs are for topping up. Bigger packs cost less per credit. The smallest pack is
// 25 credits, so every sale is well above what card payments take in fees (about 30¢ each).
export const PACK_SIZES = [25, 50, 100];
export const PACK_PRICES = {
  ai: { 25: "1.49", 50: "2.79", 100: "4.99" },
  aiCode: { 25: "2.39", 50: "4.49", 100: "7.99" },
  galaxy5: { 25: "2.69", 50: "4.99", 100: "8.99" },
  space5: { 25: "2.99", 50: "5.49", 100: "9.99" },
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
