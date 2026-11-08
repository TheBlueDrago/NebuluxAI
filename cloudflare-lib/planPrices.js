// What Pro and Team cost, in one place (owner, 2026-11-08). No imports, so the app and the server
// share it. Yearly is twelve months less YEARLY_OFF, in whole dollars, paid once at checkout.
export const MONTHLY = { pro: 15, team: 20 };
export const YEARLY_OFF = 20; // percent

export const isPlan = (id) => Object.prototype.hasOwnProperty.call(MONTHLY, id);
export const yearlyTotal = (monthly) => Math.round(monthly * 12 * (1 - YEARLY_OFF / 100));
export const yearlyPerMonth = (monthly) => Math.round(yearlyTotal(monthly) / 12);

// What one checkout charges, in dollars, and what Stripe calls it ("Subscribe to Team Plan Monthly").
export const planDollars = (id, billing) => (billing === "yearly" ? yearlyTotal(MONTHLY[id]) : MONTHLY[id]);
export const planLabel = (id, billing) => `${id === "team" ? "Team" : "Pro"} Plan ${billing === "yearly" ? "Yearly" : "Monthly"}`;

// Usage credits: any whole number of dollars in this range. usageDollars -> the amount, or null.
export const USAGE_ID = "usage-credits";
export const USAGE_MIN = 5;
export const USAGE_MAX = 500;
export function usageDollars(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= USAGE_MIN && n <= USAGE_MAX ? n : null;
}
