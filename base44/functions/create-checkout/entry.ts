// Base44 Payments checkout starter — base44/functions/create-checkout/entry.ts
//
// Provided by the platform. Do NOT rewrite the plumbing (session construct + persisting the
// join key + return-URL resolution). Edit only the region marked `// ===== APP-SPECIFIC =====`
// to resolve — SERVER-SIDE — what the buyer is purchasing and its price.
//
// PUBLIC by default: a buyer does NOT need to be logged in to check out. Backend function routes
// are callable anonymously, and storefront buyers often have no account — requiring login here is
// what blocks real purchases. If a buyer IS signed in we record their app-user id as the
// fulfillment target; otherwise the webhook grants by the buyer's email. Never 401 here.
//
// CRITICAL: Wix's checkout has NO custom-metadata field, so the returned `checkoutSession.id` is
// the ONLY thing that ties this payment back to this purchase. We persist it on a pending
// Base44Purchase BEFORE redirecting; the webhook resolves the purchase by that same id
// (order.checkoutId === checkoutSession.id). Skipping this write makes fulfillment impossible.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CONSTRUCT_URL = "https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct";
// Discount promo codes live in the Cloudflare app (cloudflare-lib/promos.js). This asks it, as the
// buyer, what a code takes off. The pages.dev origin: nebuluxai.com's bot protection
// challenges server-side requests. A fixed constant, never caller-controlled.
const PROMO_CHECK_URL = "https://nebuluxai.pages.dev/api/apps/6a8b5eb7787b8a4d6a18f662/functions/promo-discount";

// The app's public base URL for the buyer's return links. Use the platform-injected
// `X-Base44-App-Url` header (server-set from app state — correct behind custom domains), then the
// server-owned `WIX_CHECKOUT_APP_URL` secret. We do NOT fall back to the request `Origin`: it's
// caller-controlled, so a spoofed Origin would make Wix send the paid buyer to an attacker page
// (open redirect). Both sources above are always present for a connected payments app.
// The live site is served from Cloudflare at nebuluxai.com, not from the Base44
// host, so buyers are always sent back there. A fixed constant — never caller-controlled.
const PUBLIC_APP_URL = "https://nebuluxai.com";
function resolveAppUrl(_req: Request): string {
  return PUBLIC_APP_URL;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    // Read per request, never at module scope: disconnecting payments blanks these, and a warm
    // isolate that captured them at startup would keep charging with the old credentials.
    const WIX_API_KEY = Deno.env.get("WIX_CHECKOUT_API_KEY");
    const WIX_SITE_ID = Deno.env.get("WIX_CHECKOUT_SITE_ID");
    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error("create-checkout: Wix payment config not set");
      return new Response(JSON.stringify({ error: "Payments not configured" }), { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    if (!appUrl) {
      // Fail closed: with no server-owned app URL (both the X-Base44-App-Url header AND the
      // WIX_CHECKOUT_APP_URL secret are absent — e.g. a slug-less or partially-wired app) we'd build
      // relative return links like `/ThankYou` and strand the paid buyer. Never fall back to the
      // caller-controlled Origin (open redirect). Reconnecting payments repopulates the secret.
      console.error("create-checkout: no app URL (X-Base44-App-Url header and WIX_CHECKOUT_APP_URL both empty)");
      return new Response(JSON.stringify({ error: "Payments not configured" }), { status: 500 });
    }
    const base44 = createClientFromRequest(req);

    // Capture the buyer's app-user id IF signed in — but never REQUIRE it. This is the
    // fulfillment target the webhook grants to; when absent (anonymous buyer) the webhook grants
    // by the email the buyer enters on Wix's checkout page.
    let appUser = null;
    try {
      appUser = await base44.auth.me();
    } catch (_) {
      appUser = null;
    }

    const body = await req.json().catch(() => ({}));

    // ===== APP-SPECIFIC =====
    // Resolve what is being bought AND its price SERVER-SIDE. NEVER trust a price sent by the
    // client — a buyer can tamper the request body and pay any amount. The client sends only a
    // product identifier; look up the authoritative price here (a Product entity, a config map,
    // etc.). For a subscription, set `subscriptionInfo` (frequency/interval/billingCycles).
    const productId = String(body.productId ?? "");
    // Quantity is buyer-controlled, so VALIDATE it server-side. Check the RAW value is a positive
    // integer BEFORE using it — do NOT Math.trunc first, or a fractional POST (e.g. 1.9) silently
    // passes as 1 and charges a quantity the UI never allowed. For a plan / fixed-entitlement product,
    // hard-code `1` and ignore the body; for a genuine multi-unit product, also enforce YOUR own max.
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return new Response(JSON.stringify({ error: "Invalid quantity" }), { status: 400 });
    }
    // Example — replace with your real trusted product source:
    //   const product = (await base44.asServiceRole.entities.Product.filter({ id: productId }))[0];
    //   if (!product) return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
    //   const productName = product.name; const price = String(product.price); const currency = product.currency ?? "USD";
    // Resolve the product and its price SERVER-SIDE. Only a product id comes from the client.
    // (Secret is no longer sold; Enterprise is quoted per seat after an application.)
    const PRODUCTS = {
      pro: {
        name: "Pro Plan",
        price: "10.00",
        currency: "USD",
        subscriptionInfo: {
          subscriptionSettings: { frequency: "MONTH" },
          title: "Pro Plan",
          description: "100 Nebulux AI, 50 Code, 50 Galaxy 5, 50 Space 5 credits, billed monthly",
        },
      },
      team: {
        name: "Team Plan",
        price: "15.00",
        currency: "USD",
        subscriptionInfo: {
          subscriptionSettings: { frequency: "MONTH" },
          title: "Team Plan",
          description: "150 Nebulux AI, 100 Code, 100 Galaxy 5, 100 Space 5 shared credits, and up to 2 members (3 with you), billed monthly",
        },
      },
    };
    // One-time credit packs of 10, 25 or 50 credits for each AI: bought instead of a plan, no
    // subscription, added to the buyer's bonus credits by the credit server. Ids are
    // credits-<ai>-<size>. Keep in step with PACK_PRICES in cloudflare-lib/creditPacks.js.
    const PACK_NAMES: Record<string, string> = { ai: "Nebulux AI", code: "Nebulux Code", galaxy: "Galaxy", space: "Space" };
    const PACK_PRICES: Record<string, Record<number, string>> = {
      ai: { 10: "0.50", 25: "0.69", 50: "0.99" },
      code: { 10: "0.65", 25: "1.09", 50: "1.79" },
      galaxy: { 10: "0.69", 25: "1.39", 50: "2.29" },
      space: { 10: "0.75", 25: "1.49", 50: "2.49" },
    };
    const CREDIT_PACKS: Record<string, { name: string; price: string; currency: string }> = {};
    for (const [slug, sizes] of Object.entries(PACK_PRICES)) {
      for (const [size, price] of Object.entries(sizes)) {
        CREDIT_PACKS[`credits-${slug}-${size}`] = { name: `${size} ${PACK_NAMES[slug]} credits`, price, currency: "USD" };
      }
    }
    const isPack = Object.prototype.hasOwnProperty.call(CREDIT_PACKS, productId);
    // Packs go to an account, so the buyer must be signed in (the credit server finds them by appUserId).
    if (isPack && !appUser?.id) {
      return new Response(JSON.stringify({ error: "Please sign in to buy credits." }), { status: 401 });
    }
    if (isPack && quantity > 10) {
      return new Response(JSON.stringify({ error: "Invalid quantity" }), { status: 400 });
    }
    // A plan is one subscription: more than 1 would charge several times for the same plan.
    if (!isPack && quantity !== 1) {
      return new Response(JSON.stringify({ error: "Invalid quantity" }), { status: 400 });
    }
    const product = isPack ? CREDIT_PACKS[productId] : PRODUCTS[productId];
    if (!product) {
      return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
    }
    // New-account offer (numbers kept in step with cloudflare-lib/offers.js): accounts created
    // from OFFER_START get 30% off any plan from sign-up until 48 hours after their free week of Pro, and
    // keep that price for as long as they stay subscribed. It can be used once: after any
    // purchase at the lower price (still paid or since canceled), plans are full price again,
    // even inside the 48 hours.
    const OFFER_START = Date.parse("2026-09-24T00:00:00Z");
    const TRIAL_MS = 7 * 86400000;
    const DISCOUNT_MS = 48 * 3600000;
    const DISCOUNT_PCT = 30;
    const PACK_DISCOUNT_PCT = 20; // credit packs get less off than plans (cloudflare-lib/offers.js)
    const OFFER_TAG = "new member 30% off";
    let discountPct = 0;
    // Plans and credit packs alike: whichever is bought first with it uses it up.
    if (appUser?.id && appUser.created_date) {
      const raw = String(appUser.created_date);
      const created = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : raw + "Z");
      const now = Date.now();
      if (created >= OFFER_START && now < created + TRIAL_MS + DISCOUNT_MS) {
        const past = await base44.asServiceRole.entities.Base44Purchase.filter({ appUserId: appUser.id });
        const used = (past || []).some((p: any) => (p.status === "paid" || p.status === "canceled") && String(p.productName || "").includes(OFFER_TAG));
        if (!used) discountPct = isPack ? PACK_DISCOUNT_PCT : DISCOUNT_PCT;
      }
    }
    // A discount promo code (optional). Checked and counted by the Cloudflare app with the buyer's
    // own sign-in; its answer is the only source of the percentage. It doesn't stack with the
    // new-member offer: the bigger discount wins, and only that one is tagged as used.
    const promoCode = String(body.promoCode ?? "").trim().toUpperCase();
    let promoPct = 0;
    if (promoCode) {
      if (!appUser?.id) {
        return new Response(JSON.stringify({ error: "Please sign in to use a promo code." }), { status: 401 });
      }
      let check: any = {};
      let checkOk = false;
      try {
        const r = await fetch(PROMO_CHECK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") ?? "" },
          body: JSON.stringify({ code: promoCode, productId, claim: true }),
        });
        checkOk = r.ok;
        check = await r.json().catch(() => ({}));
      } catch (e) {
        console.error("create-checkout: promo check failed", e);
      }
      promoPct = checkOk ? Math.trunc(Number(check.pct)) || 0 : 0;
      if (!(promoPct >= 1 && promoPct <= 100)) {
        return new Response(JSON.stringify({ error: check.error || "That promo code can't be used for this." }), { status: 400 });
      }
    }
    const usePromo = promoPct > discountPct;
    const pct = usePromo ? promoPct : discountPct;
    const tag = usePromo ? `promo ${promoCode}` : OFFER_TAG;
    const productName = pct ? `${product.name} (${tag})` : product.name;
    // Payments can't be under 0.50, so no discount goes below that (same rule as cloudflare-lib/discounts.js).
    const price = pct ? Math.max(0.5, Math.round(parseFloat(product.price) * (100 - pct)) / 100).toFixed(2) : product.price;
    const currency = product.currency;
    const subscriptionInfo = isPack
      ? null
      : pct
        ? { ...product.subscriptionInfo, title: `${product.subscriptionInfo.title} (${tag})` }
        : product.subscriptionInfo;
    // Where Wix returns the buyer. Both MUST be real, PUBLICLY reachable routes.
    const thankYouPath = "/ThankYou";
    const postFlowPath = "/plans";
    // ===== END APP-SPECIFIC =====

    const total = parseFloat(price) * quantity;
    if (!(total >= 0.5)) {
      // Wix rejects charges under 0.50 in the charged currency (major units, not cents).
      return new Response(JSON.stringify({ error: "Amount must be at least 0.50" }), { status: 400 });
    }

    const constructBody = {
      cart: {
        items: [{ name: productName, quantity, price, ...(subscriptionInfo ? { subscriptionInfo } : {}) }],
        // Prefill the signed-in buyer's email if we have one; anonymous buyers enter it on Wix.
        ...(appUser?.email ? { customerInfo: { email: appUser.email } } : {}),
      },
      callbackUrls: {
        thankYouPageUrl: `${appUrl}${thankYouPath}`,
        postFlowUrl: `${appUrl}${postFlowPath}`,
      },
    };

    const wixRes = await fetch(CONSTRUCT_URL, {
      method: "POST",
      headers: {
        "Authorization": WIX_API_KEY,
        "wix-site-id": WIX_SITE_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(constructBody),
    });

    if (!wixRes.ok) {
      const errText = await wixRes.text();
      console.error("create-checkout: Wix construct failed", { status: wixRes.status, errText });
      return new Response(JSON.stringify({ error: "Could not start checkout" }), { status: 502 });
    }

    const { checkoutSession } = await wixRes.json();
    const checkoutSessionId: string = checkoutSession?.id;
    const redirectUrl: string = checkoutSession?.redirectUrl;

    if (!checkoutSessionId || !redirectUrl) {
      console.error("create-checkout: missing checkoutSession id/redirectUrl", checkoutSession);
      return new Response(JSON.stringify({ error: "Could not start checkout" }), { status: 502 });
    }

    // PERSIST THE JOIN KEY (the whole point). Pending until the webhook flips it to "paid".
    // asServiceRole so the row is trustworthy — Base44Purchase RLS blocks client writes, so a buyer
    // can't forge a paid purchase. appUserId is the fulfillment target when known; null for an
    // anonymous buyer (the webhook then grants by buyerEmail).
    await base44.asServiceRole.entities.Base44Purchase.create({
      checkoutSessionId,
      status: "pending",
      appUserId: appUser?.id ?? null,
      buyerEmail: appUser?.email ?? null,
      // The server-resolved product key — the webhook grant reads this to decide what to unlock.
      productId,
      productName,
      // Persist the validated quantity so the webhook's grant can award the RIGHT count
      // (seats/credits/items) for a multi-unit purchase — the grant runs later from this row and has
      // no other authoritative count. (Fixed-entitlement plans keep quantity 1.)
      quantity,
      // Charged total (unit price × quantity), so the record matches what Wix charged.
      amount: total.toFixed(2),
      currency,
    });

    return new Response(JSON.stringify({ redirectUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout: unhandled error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});