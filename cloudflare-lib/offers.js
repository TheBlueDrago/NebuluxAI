// The new-account offer: accounts created from OFFER_START on get a free week of Pro, then
// 48 hours of 30% off every plan (kept for as long as they stay subscribed) or 20% off a credit
// pack; buying either with it uses it up. The credit
// system gives the free week (credits.js); base44/functions/create-checkout applies the
// discount with the same numbers (keep them in step); Enterprise applications sent in the
// window are quoted with it (enterprise.js).
export const OFFER_START = "2026-09-24T00:00:00Z";
export const TRIAL_DAYS = 7;
export const DISCOUNT_HOURS = 48;
export const DISCOUNT_PCT = 30;
// The same offer on a one-time credit pack (checkout keeps its own copy of both numbers).
export const PACK_DISCOUNT_PCT = 20;
// Checkout adds this to the name of a purchase made with the discount, so it's only used once.
export const OFFER_TAG = "new member 30% off";

// Base44 dates can lack a time zone ("2026-09-24T10:00:00.123000"); they're UTC.
const utc = (d) => Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(d || "")) ? d : `${d}Z`);

// -> null for accounts from before the offer, else its dates and what's active now.
// The free week and new-member discount are switched off (owner, 2026-09-27: plans are coming soon).
export const OFFERS_ON = false;

export function offerFor(user, now = Date.now()) {
  if (!OFFERS_ON) return null;
  const created = utc(user && user.created_date);
  if (!Number.isFinite(created) || created < Date.parse(OFFER_START)) return null;
  const trialEnds = created + TRIAL_DAYS * 86400000;
  const discountEnds = trialEnds + DISCOUNT_HOURS * 3600000;
  return {
    trialEndsAt: new Date(trialEnds).toISOString(),
    discountEndsAt: new Date(discountEnds).toISOString(),
    discountPct: DISCOUNT_PCT,
    packDiscountPct: PACK_DISCOUNT_PCT,
    trialActive: now < trialEnds,
    // From sign-up (during the free week too) until 48 hours after it.
    discountActive: now < discountEnds,
  };
}

// A price after the offer's discount, as the "0.70"-style string checkout uses.
export const discounted = (price) => (Math.round(Number(price) * (100 - DISCOUNT_PCT)) / 100).toFixed(2);
