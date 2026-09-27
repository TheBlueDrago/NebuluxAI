// Plans and credit packs can't be bought for now ("coming soon in later updates", owner,
// 2026-09-27). The Shop and Billing show them greyed out with a note. Checkout refuses too
// (SALES_OPEN in base44/functions/create-checkout). Set both to true to open buying again.
export const SALES_OPEN = false;
export const COMING_SOON = "These plans will be coming soon in later updates.";
