// Plans as the public pages describe them. Keep in step with PLAN_TOTALS in
// cloudflare-lib/credits.js (monthly credits), src/lib/publishLimits.js (sites and games)
// and the prices in base44/functions/create-checkout. Enterprise has no public price: it's
// $30 a seat a month ($25 from 10 seats, $20 from 25) (cloudflare-lib/enterprise.js), quoted after an application.
// Yearly billing: a small discount on paying for 12 months at once (2026-10-17).
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
    features: ["100 Nebulux AI, 75 Galaxy, 50 Space and 25 Nebula credits every month", "3 published websites", "Unlimited games", "ZIP download, two-way GitHub sync and custom domains", "Free web address"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    yearly: yearly(15),
    blurb: "More credits, all 4 AI models and your code to keep. Coming soon in a later update.",
    features: [
      "300 Nebulux AI credits a month",
      "150 Galaxy, 100 Space and 75 Nebula credits",
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
      "Up to 3 people, one shared pool of credits",
      "500 Nebulux AI credits a month",
      "250 Galaxy, 150 Space and 100 Nebula credits",
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
      "One shared pool: each seat adds 100 AI, 75 Galaxy, 50 Space and 25 Nebula credits a month",
      "Add and remove people yourself",
      "10 published websites, unlimited games",
      "Price based on your number of seats",
    ],
  },
];
