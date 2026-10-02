// The credit allowances, with nothing else in the file, so both the Cloudflare functions
// (credits.js) and the app (src/lib/creditRefresh.js) can import them.
export const TIERS = ["ai", "aiCode", "galaxy5", "space5"];
export const TIER_OF_MODEL = { automatic: "ai", claude_sonnet_4_6: "aiCode", claude_opus_4_8: "galaxy5", "claude-sonnet-5": "space5" };
export const TIER_NAMES = { ai: "Nebulux AI", aiCode: "Nebulux Code", galaxy5: "Galaxy", space5: "Space" };

// Monthly allowance per plan (same numbers the app has always shown). Enterprise is per
// seat: each seat adds these to one pool the whole organization shares, and the org pays
// $30 a seat a month, $25 from 10 seats, $20 from 25.
// Secret can no longer be bought; accounts that already have it keep it.
export const PLAN_TOTALS = {
  free: { ai: 100, aiCode: 75, galaxy5: 50, space5: 25 }, // 2026-09-27: plans are "coming soon", Free is generous
  pro: { ai: 100, aiCode: 50, galaxy5: 50, space5: 50 },
  team: { ai: 150, aiCode: 100, galaxy5: 100, space5: 100 },
  secret: { ai: 150, aiCode: 100, galaxy5: 100, space5: 100 },
  enterprise: { ai: 100, aiCode: 75, galaxy5: 50, space5: 25 },
  admin: { ai: 150, aiCode: 100, galaxy5: 100, space5: 100 },
};

// Since 2026-10-02 every AI draws from ONE pool of credits (like Claude), with two limits: what
// you can use in any 2-hour window, and in a week. Stronger AIs and longer chats cost more of it.
// Bonus credits (promo codes, packs, referrals) are spent once a limit is reached.
export const PLAN_LIMITS = {
  free: { window: 40, week: 300 },
  pro: { window: 120, week: 1000 },
  team: { window: 160, week: 1400 },
  secret: { window: 160, week: 1400 },
  enterprise: { window: 100, week: 800 }, // per seat, shared by the organization
  admin: { window: 100000, week: 1000000 },
};
// Credits per 10,000 characters of reply, per AI (times the effort level).
export const MODEL_WEIGHT = { ai: 1, aiCode: 2, galaxy5: 3, space5: 4 };
// The context window: everything the AI reads for one answer (the chat so far, files, page code).
export const CONTEXT_TOKENS = 1000000;
// Reading the chat costs 1 credit per 50,000 tokens after the first 50,000.
export const TOKENS_PER_CONTEXT_CREDIT = 50000;
export const contextCredits = (chars) => Math.floor(Math.max(0, Number(chars) || 0) / 4 / TOKENS_PER_CONTEXT_CREDIT);
export const WINDOW_MS = 2 * 3600 * 1000;
export const WEEK_MS = 7 * 24 * 3600 * 1000;
