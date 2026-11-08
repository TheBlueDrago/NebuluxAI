// What Monitor shows about purchases. A Stripe purchase is a Base44Purchase row (stripe.js); it never
// touches the plan field on the User row, so Monitor has to read the rows to know who bought what.
import { all } from "./db.js";
import { RANK } from "./credits.js";
import { USAGE_ID, API_ID } from "./planPrices.js";

// Both kinds of key, restricted ones too. Anything else counts as test, so sandbox money is never shown as real.
export const stripeIsLive = (env) => /^(sk|rk)_live_/.test(String((env && env.STRIPE_SECRET_KEY) || ""));

export function purchaseSummary(rows) {
  // Same rule as credits.js paidPlan: a row marked paid gives its plan, and the highest plan wins.
  const plans = {};
  for (const p of rows) {
    if (p.status !== "paid" || !p.appUserId || !(RANK[p.productId] > 0)) continue;
    const had = plans[p.appUserId];
    if (!had || RANK[p.productId] > RANK[had.plan]) plans[p.appUserId] = { plan: p.productId, name: p.productName || p.productId, test: p.provider === "stripe" && p.livemode !== true };
  }
  const sales = rows
    .filter((p) => p.provider === "stripe")
    .map((p) => ({
      id: p.id,
      userId: p.appUserId,
      name: p.productName || p.productId,
      kind: p.productId === USAGE_ID ? "usage" : p.productId === API_ID ? "api" : "plan",
      plan: p.productId === USAGE_ID || p.productId === API_ID ? null : p.productId,
      billing: p.billing || null,
      status: p.status,
      cents: Number(p.amountCents) || 0,
      // Rows from before this field existed were all made with the sandbox keys.
      live: p.livemode === true,
      at: p.created_date,
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { plans, sales };
}

export const liveSummary = async (db, env) => ({
  ...purchaseSummary(await all(db, "Base44Purchase")),
  stripe: { ready: !!(env && env.STRIPE_SECRET_KEY), live: stripeIsLive(env) },
  at: new Date().toISOString(),
});
