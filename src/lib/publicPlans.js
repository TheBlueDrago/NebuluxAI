// Plans as the public pages describe them. Keep in step with the usage limits in
// cloudflare-lib/creditSession.js (POOL_LIMITS, like Claude: every AI shares them), src/lib/publishLimits.js (sites and games)
// and the prices in base44/functions/create-checkout. Enterprise has no public price: it's
// $30 a seat a month ($25 from 10 seats, $20 from 25) (cloudflare-lib/enterprise.js), quoted after an application.
// Yearly billing: a small discount on paying for 12 months at once (2026-10-17).
// Free's limits (owner, 2026-11-03). The paid plans' limits are for the owner to set; until then their
// cards just say they're higher.
export const FREE_USAGE = "100,000 tokens every 5 hours and 1,000,000 a week, shared by every AI";
export const YEARLY_OFF = 10; // percent
const yearly = (monthly) => {
  const year = Math.round(monthly * 12 * (1 - YEARLY_OFF / 100));
  return { price: "$" + year, period: "/year", perMonth: "$" + (year / 12).toFixed(2) };
};

export const PUBLIC_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    blurb: "Try everything and publish your first site and game.",
    features: [FREE_USAGE.charAt(0).toUpperCase() + FREE_USAGE.slice(1), "3 published websites", "Unlimited games", "ZIP download, two-way GitHub sync and custom domains", "Free web address"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    yearly: yearly(15),
    blurb: "Higher usage limits, all 4 AI models and your code to keep. Coming soon in a later update.",
    features: [
      "Higher usage limits than Free, shared by every AI",
      "10 published websites",
      "Unlimited games",
      "Download a ZIP, two-way GitHub sync allowed",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$20",
    period: "/month",
    yearly: yearly(20),
    blurb: "Build with up to 2 friends or coworkers.",
    features: [
      "Up to 3 people",
      "Higher usage limits than Pro, shared by every AI",
      "10 published websites, unlimited games",
      "Download a ZIP, two-way GitHub sync allowed",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For registered businesses and organizations of any size.",
    features: [
      "As many seats as you need",
      "Usage limits for every seat, shared by every AI",
      "Add and remove people yourself",
      "10 published websites, unlimited games",
      "Price based on your number of seats",
    ],
  },
];
