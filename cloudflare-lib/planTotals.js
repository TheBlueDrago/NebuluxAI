// The credit allowances, with nothing else in the file, so both the Cloudflare functions
// (credits.js) and the app (src/lib/creditRefresh.js) can import them.
export const TIERS = ["ai", "aiCode", "galaxy5", "space5"];
export const TIER_OF_MODEL = { automatic: "ai", claude_sonnet_4_6: "aiCode", claude_opus_4_8: "galaxy5", "claude-sonnet-5": "space5" };
export const TIER_NAMES = { ai: "Nebulux AI", aiCode: "Galaxy", galaxy5: "Space", space5: "Nebula" };

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
