// Discount promo codes: what they can apply to and how they change a price. No imports, so
// the app (Shop, Billing, the admin Promo Codes page) and the server (promos.js) share it.
// Base44's create-checkout repeats the price rule; keep it in step.

// What a discount code can make cheaper. Credit packs are "credits-<ai>-<size>".
export const DISCOUNT_TARGETS = [
  { id: "all", label: "Everything (plans and credits)" },
  { id: "plans", label: "All plans" },
  { id: "pro", label: "Pro plan" },
  { id: "team", label: "Team plan" },
  { id: "credits", label: "All credit packs" },
  { id: "credits-ai", label: "Nebulux AI credit packs" },
  { id: "credits-code", label: "Nebulux Code credit packs" },
  { id: "credits-galaxy", label: "Space credit packs" },
  { id: "credits-space", label: "Nebula credit packs" },
];
const PLAN_IDS = ["pro", "team"];

export const targetLabel = (id) => (DISCOUNT_TARGETS.find((t) => t.id === id) || DISCOUNT_TARGETS[0]).label;

// Does a code for `target` apply to this product?
export function discountApplies(target, productId) {
  const id = String(productId || "");
  const isPack = id.startsWith("credits-");
  if (target === "all") return PLAN_IDS.includes(id) || isPack;
  if (target === "plans") return PLAN_IDS.includes(id);
  if (target === "credits") return isPack;
  if (target && target.startsWith("credits-")) return id.startsWith(`${target}-`);
  return target === id;
}

// Payments can't be under $0.50, so no discount takes a price below that.
export const MIN_PRICE = 0.5;
export const discountedPrice = (price, pct) =>
  pct > 0 ? Math.max(MIN_PRICE, Math.round(Number(price) * (100 - pct)) / 100) : Number(price);

// Checkout adds this to the name of a purchase made with a code, so each person uses it once.
export const promoTag = (code) => `promo ${String(code || "").toUpperCase()}`;
