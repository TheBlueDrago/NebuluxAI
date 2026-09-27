// Plans as the public pages describe them. Keep in step with PLAN_TOTALS in
// cloudflare-lib/credits.js (monthly credits), src/lib/publishLimits.js (sites and games)
// and the prices in base44/functions/create-checkout. Enterprise has no public price: it's
// $30 a seat a month ($25 from 10 seats, $20 from 25) (cloudflare-lib/enterprise.js), quoted after an application.
export const PUBLIC_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    blurb: "Try everything and publish your first site and game.",
    features: ["50 Nebulux AI credits every month", "1 published website", "1 new game a month", "Free web address"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    blurb: "More credits, all 4 AI models and your code to keep. New accounts get a free week (ZIP and GitHub come with the paid plan).",
    features: [
      "100 Nebulux AI credits a month",
      "50 each of Code, Galaxy and Space credits",
      "3 published websites",
      "3 new games a month",
      "Download a ZIP or push to GitHub",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$20",
    period: "/month",
    blurb: "Build with up to 2 friends or coworkers.",
    features: [
      "Up to 3 people, one shared pool of credits",
      "150 Nebulux AI credits a month",
      "100 each of Code, Galaxy and Space credits",
      "3 published websites, 5 new games a month",
      "Download a ZIP or push to GitHub",
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
      "One shared pool: each seat adds 100 AI, 75 Code, 50 Galaxy and 25 Space credits a month",
      "Add and remove people yourself",
      "10 published websites, 10 new games a month",
      "Price based on your number of seats",
    ],
  },
];
