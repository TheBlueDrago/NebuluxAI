import React, { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";
import { USAGE_MIN, USAGE_MAX, USAGE_RECOMMENDED, USAGE_PRESETS, USAGE_CREDITS_ON_SALE, usageAmount, BUY_USAGE_EVENT } from "@/lib/usageCredits";

// "Buy usage credits", like Claude's extra usage: pick how much money to add ($5 to $500, $100
// recommended). They extend the 5-hour limit once it runs out (never the weekly one, and what they pay
// for still counts toward the week). Opened from anywhere with openBuyUsage() (lib/usageCredits.js).
// Not on sale yet (USAGE_CREDITS_ON_SALE): the button says Coming soon.
export default function BuyUsageCredits() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(USAGE_RECOMMENDED));
  useEffect(() => {
    const show = () => {
      setAmount(String(USAGE_RECOMMENDED));
      setOpen(true);
    };
    window.addEventListener(BUY_USAGE_EVENT, show);
    return () => window.removeEventListener(BUY_USAGE_EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;
  const n = usageAmount(amount);
  const typed = String(amount).trim() !== "";
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="buy-usage-title" className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[var(--cl-card,#1e1e24)] border border-[var(--cl-border,#33333b)] p-6 shadow-2xl text-[var(--cl-text,#f4f4f5)]">
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-full text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 id="buy-usage-title" className="text-lg font-semibold">Buy usage credits</h2>
        </div>
        <p className="mt-2 text-[13.5px] text-[var(--cl-muted)]">
          Keep going when you hit your 5-hour limit: usage credits let every AI carry on until it resets. They don't extend your weekly limit, and what they pay for still counts toward it.
        </p>
        <p className="mt-4 text-[13px] font-medium">How much would you like to add?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {USAGE_PRESETS.map((v) => {
            const on = n === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                aria-pressed={on}
                className={`relative rounded-xl border px-2 py-3 text-center text-[15px] font-semibold ${on ? "border-blue-500 bg-blue-500/10" : "border-[var(--cl-border)] hover:bg-[var(--cl-hover)]"}`}
              >
                ${v}
                {v === USAGE_RECOMMENDED && <span className="block text-[10.5px] font-medium text-blue-400">Recommended</span>}
              </button>
            );
          })}
          <label className="relative rounded-xl border border-[var(--cl-border)] px-2 py-1.5 flex items-center gap-1 focus-within:border-blue-500">
            <span className="text-[var(--cl-muted)]">$</span>
            <input
              inputMode="numeric"
              value={USAGE_PRESETS.includes(n) ? "" : amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Other"
              aria-label={`Other amount, $${USAGE_MIN} to $${USAGE_MAX}`}
              className="w-full min-w-0 bg-transparent text-[15px] font-semibold outline-none"
            />
          </label>
        </div>
        <p className={`mt-2 text-[12.5px] ${typed && n === null ? "text-amber-400" : "text-[var(--cl-muted)]"}`}>
          From ${USAGE_MIN} to ${USAGE_MAX}. ${USAGE_RECOMMENDED} is recommended.
        </p>
        <button
          type="button"
          disabled={!USAGE_CREDITS_ON_SALE || n === null}
          className="mt-4 w-full rounded-xl bg-[var(--cl-text)] text-[var(--cl-bg)] py-2.5 text-[14px] font-semibold disabled:opacity-50"
        >
          {USAGE_CREDITS_ON_SALE ? (n === null ? "Choose an amount" : `Add $${n}`) : "Coming soon"}
        </button>
        {!USAGE_CREDITS_ON_SALE && <p className="mt-2 text-center text-[12.5px] text-[var(--cl-muted)]">Buying usage credits is coming soon. Set how much they can spend a day in Settings, Usage.</p>}
      </div>
    </div>
  );
}
