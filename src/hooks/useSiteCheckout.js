import { useEffect } from "react";
import { showNotice } from "@/lib/dialogs";
import { base44 } from "@/api/base44Client";
import { paymentError } from "@/lib/paymentError";

// Published sites run in a sandboxed iframe, so their buy buttons ask the host page to start
// checkout: parent.postMessage({ type: 'nebulux-checkout', productId, quantity }, '*').
export default function useSiteCheckout(siteName) {
  useEffect(() => {
    if (!siteName) return;
    const handler = async (e) => {
      const d = e.data;
      if (!d || !/^(nebulux|blackhole)-checkout$/.test(d.type || "")) return; // older sites still send blackhole-checkout
      try {
        const res = await base44.functions.invoke("site-checkout", {
          siteName,
          productId: String(d.productId || ""),
          quantity: Number(d.quantity || 1),
        });
        if (res.data?.redirectUrl) window.location.href = res.data.redirectUrl;
        else showNotice(res.data?.error || "Checkout is unavailable right now.");
      } catch (err) {
        showNotice(paymentError(err, "Checkout is unavailable right now."));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [siteName]);
}