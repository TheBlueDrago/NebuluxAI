// Promo codes, kept in KV (one "promos" key) instead of Base44's PromoCode table:
// Base44's redeem/manage functions used up the Base44 integration allowance and failed
// once it ran out. The first time an admin opens the list, the old PromoCode rows are
// imported (admins can still read that table directly).
//
// Two kinds:
// - Free credits ({ kind: "credits", aiModel, credits, redeemedBy, redeemedAt }): single-use,
//   redeemed into the bonus balance.
// - Discount ({ kind: "discount", pct, target, maxUses, expiresAt, usedBy: [userId] }): a %
//   off plans and/or credit packs (discounts.js), entered in the Shop or on Billing. Base44's
//   create-checkout asks checkDiscount(..., { claim: true }) for the price, so the browser can't
//   set it. Each person can use a code once (checked against their purchases), and maxUses
//   (0 = no limit) caps how many people can.
// Both share { id, code, active, label, created_date }; old records without `kind` are credits.
import { base44 } from "./published.js";
import { adjustBonus } from "./credits.js";
import { DISCOUNT_TARGETS, discountApplies, targetLabel, promoTag } from "./discounts.js";

export const MODELS = ["ai", "aiCode", "galaxy5", "space5"];
const KEY = "promos";

export async function readPromos(kv) {
  try {
    return await kv.get(KEY, "json");
  } catch {
    return null;
  }
}

async function savePromos(kv, list) {
  await kv.put(KEY, JSON.stringify(list));
}

// Admin: the list, importing Base44's PromoCode rows the first time.
export async function listPromos(kv, request) {
  let list = await readPromos(kv);
  if (list) return list;
  list = [];
  try {
    const rows = (await base44(request, "GET", "entities/PromoCode?sort=-created_date&limit=200")) || [];
    const used = (await base44(request, "GET", "entities/PromoRedemption?limit=500")) || [];
    for (const r of rows) {
      const red = used.find((u) => String(u.code).toUpperCase() === String(r.code).toUpperCase());
      list.push({
        id: r.id,
        code: String(r.code || "").toUpperCase(),
        aiModel: MODELS.includes(r.aiModel) ? r.aiModel : "ai",
        credits: Number(r.credits) || 0,
        active: r.active !== false && !red,
        label: r.label || "",
        created_date: r.created_date || new Date().toISOString(),
        redeemedBy: red ? red.userId : null,
        redeemedAt: red ? red.redeemedAt : null,
      });
    }
  } catch {
    // Couldn't read the old table: start empty.
  }
  await savePromos(kv, list);
  return list;
}

const isDiscount = (rec) => rec && rec.kind === "discount";

// The discount fields from an admin's form, checked.
function discountFields(body, rec = {}) {
  const out = {};
  if (body.pct !== undefined || rec.pct === undefined) {
    const pct = Math.trunc(Number(body.pct));
    if (!(pct >= 1 && pct <= 100)) throw new Error("The discount must be between 1% and 100%.");
    out.pct = pct;
  }
  if (body.target !== undefined || rec.target === undefined) {
    const target = String(body.target || "all");
    if (!DISCOUNT_TARGETS.some((t) => t.id === target)) throw new Error("Pick what the discount is for.");
    out.target = target;
  }
  if (body.maxUses !== undefined) out.maxUses = Math.max(0, Math.trunc(Number(body.maxUses)) || 0);
  if (body.expiresAt !== undefined) {
    const t = body.expiresAt ? Date.parse(body.expiresAt) : NaN;
    if (body.expiresAt && !Number.isFinite(t)) throw new Error("That end date isn't valid.");
    out.expiresAt = body.expiresAt ? new Date(t).toISOString() : null;
  }
  return out;
}

export async function createPromo(kv, request, body) {
  const list = await listPromos(kv, request);
  const code = String(body.code || "").trim().toUpperCase();
  if (!code) throw new Error("Code is required.");
  if (list.some((p) => p.code === code)) throw new Error("That code already exists.");
  // Promo codes only give a percentage off now (owner, 2026-10-08): no free-credit codes.
  if (body.kind !== "discount") throw new Error("Promo codes can only give a percentage off.");
  if (body.kind === "discount") {
    const rec = {
      id: crypto.randomUUID(),
      code,
      kind: "discount",
      maxUses: 0,
      expiresAt: null,
      ...discountFields(body),
      usedBy: [],
      active: body.active !== false,
      label: String(body.label || ""),
      created_date: new Date().toISOString(),
    };
    await savePromos(kv, [rec, ...list]);
    return rec;
  }
  const credits = Number(body.credits) || 0;
  if (credits <= 0) throw new Error("Credits must be greater than 0.");
  const rec = {
    id: crypto.randomUUID(),
    code,
    kind: "credits",
    aiModel: MODELS.includes(String(body.aiModel)) ? String(body.aiModel) : "ai",
    credits,
    active: body.active !== false,
    label: String(body.label || ""),
    created_date: new Date().toISOString(),
    redeemedBy: null,
    redeemedAt: null,
  };
  await savePromos(kv, [rec, ...list]);
  return rec;
}

export async function updatePromo(kv, request, body) {
  const list = await listPromos(kv, request);
  const rec = list.find((p) => p.id === String(body.id || ""));
  if (!rec) throw new Error("Code not found.");
  if (isDiscount(rec)) {
    Object.assign(rec, discountFields(body, rec));
    if (body.active !== undefined) rec.active = !!body.active;
    if (body.label !== undefined) rec.label = String(body.label);
    await savePromos(kv, list);
    return rec;
  }
  if (body.aiModel !== undefined) {
    if (!MODELS.includes(String(body.aiModel))) throw new Error("Invalid AI model.");
    rec.aiModel = String(body.aiModel);
  }
  if (body.credits !== undefined) rec.credits = Number(body.credits) || 0;
  if (body.active !== undefined) rec.active = !!body.active;
  if (body.label !== undefined) rec.label = String(body.label);
  await savePromos(kv, list);
  return rec;
}

export async function deletePromo(kv, request, id) {
  const list = await listPromos(kv, request);
  await savePromos(kv, list.filter((p) => p.id !== String(id || "")));
}

// A signed-in user redeems a code: its credits go into their bonus balance, and the
// code stops working (single use).
export async function redeemPromo(kv, request, user, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw new Error("Enter a promo code.");
  // Until an admin has opened the list once (importing the old codes), there are none.
  const list = (await readPromos(kv)) || [];
  const rec = list.find((p) => p.code === code);
  // A discount code isn't used up here: it's checked and remembered, and applies at checkout.
  if (isDiscount(rec)) {
    const d = await checkDiscount(kv, request, user, code);
    return { kind: "discount", ...d };
  }
  // Old free-credit codes no longer work (owner, 2026-10-08: promo codes are % off only).
  if (!rec || rec.kind !== "discount") throw new Error("That promo code is not valid.");
  if (!rec.active || rec.credits <= 0) {
    if (rec && rec.redeemedBy) throw new Error("This promo code has already been used.");
    throw new Error("That promo code is not valid.");
  }
  rec.active = false;
  rec.redeemedBy = user.id;
  rec.redeemedAt = new Date().toISOString();
  await savePromos(kv, list);
  await adjustBonus(kv, request, user, rec.aiModel, rec.credits, `promo:${rec.id}`);
  return { code, aiModel: rec.aiModel, credits: rec.credits };
}

// Has this person already bought something with the code? (create-checkout tags the purchase.)
async function usedByBuyer(request, user, code) {
  try {
    const rows = (await base44(request, "GET", `entities/Base44Purchase?q=${encodeURIComponent(JSON.stringify({ appUserId: user.id }))}`)) || [];
    const tag = promoTag(code);
    return rows.some((p) => (p.status === "paid" || p.status === "canceled") && String(p.productName || "").includes(tag));
  } catch {
    return false;
  }
}

// Checks a discount code for this person (and, with productId, for that product).
// -> { code, pct, target, label }. With `claim` (only create-checkout does this) the person is
// counted toward maxUses; asking again before paying doesn't count twice.
export async function checkDiscount(kv, request, user, rawCode, productId, { claim = false } = {}) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw new Error("Enter a promo code.");
  const list = (await readPromos(kv)) || [];
  const rec = list.find((p) => p.code === code);
  if (!isDiscount(rec) || !rec.active) throw new Error("That promo code is not valid.");
  if (rec.expiresAt && Date.parse(rec.expiresAt) < Date.now()) throw new Error("This promo code has ended.");
  if (productId && !discountApplies(rec.target, productId)) throw new Error(`This code is only for: ${targetLabel(rec.target).toLowerCase()}.`);
  const usedBy = rec.usedBy || [];
  const already = usedBy.includes(user.id);
  if (!already && rec.maxUses > 0 && usedBy.length >= rec.maxUses) throw new Error("This promo code has been used up.");
  if (await usedByBuyer(request, user, code)) throw new Error("You've already used this promo code.");
  if (claim && !already) {
    rec.usedBy = [...usedBy, user.id];
    await savePromos(kv, list);
  }
  return { code, pct: rec.pct, target: rec.target, label: targetLabel(rec.target) };
}
