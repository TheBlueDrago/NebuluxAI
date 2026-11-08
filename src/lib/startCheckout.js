import { base44 } from "@/api/base44Client";

// Sends someone to Stripe's checkout for Pro or Team. Prices are set on the server; this only says
// which plan. After paying they come back to the page they were on before the Shop (see ThankYou).
const SHOP = /^\/(chat\/(shop|plans)|plans|billing)(\/|$|\?)/;
const KEY = "nx-last-page";

export function rememberPage(path) {
  if (SHOP.test(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage blocked: they come back to the chat instead.
  }
}

function pageBefore(here) {
  if (!SHOP.test(here)) return here;
  try {
    return sessionStorage.getItem(KEY) || "/chat";
  } catch {
    return "/chat";
  }
}

export async function startUsageCheckout(amount) {
  const here = window.location.pathname + window.location.search;
  const res = await base44.functions.invoke("create-checkout", { productId: "usage-credits", amount, from: pageBefore(here), back: here });
  const url = res.data?.redirectUrl;
  if (!url) throw new Error("No checkout URL");
  window.location.href = url;
}

export async function startCheckout(plan, yearly, promoCode) {
  const here = window.location.pathname + window.location.search;
  const res = await base44.functions.invoke("create-checkout", { productId: plan, billing: yearly ? "yearly" : "monthly", from: pageBefore(here), back: here, ...(promoCode ? { promoCode } : {}) });
  const url = res.data?.redirectUrl;
  if (!url) throw new Error("No checkout URL");
  window.location.href = url;
}
