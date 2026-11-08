// Plans can't be bought for now ("coming soon in later updates", owner,
// 2026-09-27). The Shop and Billing show them greyed out with a note. Checkout refuses too
// (SALES_OPEN in base44/functions/create-checkout). Set both to true to open buying again.
export const SALES_OPEN = false;
// Pro and Team can be bought (Stripe, cloudflare-lib/stripe.js); usage credits and Enterprise come later.
// Until STRIPE_SECRET_KEY is in Cloudflare the checkout itself still answers "coming soon".
export const PLANS_OPEN = true;
export const COMING_SOON = "These plans will be coming soon in later updates.";
