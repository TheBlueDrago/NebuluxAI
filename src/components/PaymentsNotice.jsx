import React, { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Asked once per visit and shared by the Shop and checkout.
let pending = null;
export function paymentsStatus() {
  if (!pending) pending = base44.functions.invoke("site-status", {}).then((r) => r.data || {}, () => ({}));
  return pending;
}

// Shown on the Shop and checkout while an admin has marked buying as paused (Monitor), so
// people know before they press Buy that nothing will be charged.
export default function PaymentsNotice({ className = "" }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let alive = true;
    paymentsStatus().then((s) => alive && setPaused(s.paymentsPaused === true));
    return () => {
      alive = false;
    };
  }, []);
  if (!paused) return null;
  return (
    <div role="status" className={`w-full max-w-2xl flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left ${className}`}>
      <PauseCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-100">
        <b>Buying is paused for a little while.</b> Our payment provider is having a break, so plans and usage credits can't be bought right now, and nobody is
        being charged. Your plan and credits keep working as normal. Please check back soon.
      </p>
    </div>
  );
}
