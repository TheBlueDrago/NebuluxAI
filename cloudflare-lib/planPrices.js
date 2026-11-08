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

// API funds (the Nebulux Platform): each AI has its own balance and its own smallest amount.
// orbit: Nebulux Orbit's API (its keys are made in Orbit's Settings). apiDollars -> the amount, or null.
export const API_ID = "api-credits";
export const API_MIN = { "nebulux-ai": 2, galaxy: 3, space: 4, nebula: 5, orbit: 2 };
export const API_NAMES = { "nebulux-ai": "Nebulux AI", galaxy: "Galaxy", space: "Space", nebula: "Nebula", orbit: "Nebulux Orbit" };
export const API_MAX = 500;
export function apiDollars(model, v) {
  if (!Object.prototype.hasOwnProperty.call(API_MIN, model)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= API_MIN[model] && n <= API_MAX ? n : null;
}
