// Usage credits, like Claude's extra usage (owner, 2026-11-03): money you add that keeps every AI going
// after you hit your 5-hour or weekly limit (cloudflare-lib/creditSession.js). You pick a dollar amount
// (no packs, no per-AI credits): at least $5, at most $500, $100 recommended. They can't be bought yet
// (lib/salesOpen.js); the checkout for them comes with the payment provider.
export const USAGE_MIN = 5;
export const USAGE_MAX = 500;
export const USAGE_RECOMMENDED = 100;
export const USAGE_PRESETS = [10, 25, 50, 100, 250];
// Their own switch: there's no checkout for them yet, so they stay "coming soon" even once plans can be
// bought (lib/salesOpen.js). Turn on when create-checkout sells them and chatCompletion spends them.
export const USAGE_CREDITS_ON_SALE = false;

// A typed amount -> whole dollars, or null when it isn't between the minimum and maximum.
export function usageAmount(v) {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n !== Math.floor(n)) return null;
  return n >= USAGE_MIN && n <= USAGE_MAX ? n : null;
}

// Opens the Buy usage credits window (BuyUsageCredits.jsx) from anywhere in the app.
export const BUY_USAGE_EVENT = "nx-buy-usage-credits";
export function openBuyUsage() {
  try {
    window.dispatchEvent(new CustomEvent(BUY_USAGE_EVENT));
  } catch {
    /* not in a browser */
  }
}
