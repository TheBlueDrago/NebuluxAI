import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { PUBLIC_PLANS, YEARLY_OFF } from "@/lib/publicPlans";
import { startCheckout } from "@/lib/startCheckout";
import { paymentError } from "@/lib/paymentError";

// "Upgrade plan" (account menu, and every Upgrade button): the four plans in a popup.
// No promo codes here: those only go on the Billing page. Pro and Team go straight to Stripe's
// checkout (lib/startCheckout.js); Enterprise goes to its application page.
const CODE_NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };
const ACTIVE = { pro: ["pro"], team: ["team"], enterprise: ["enterprise"], free: ["free"] };

export default function PlansDialog({ open, onClose, plan, onEnterprise }) {
  const [yearly, setYearly] = useState(false);
  const [buying, setBuying] = useState("");
  const [error, setError] = useState("");
  const buy = async (id) => {
    setError("");
    setBuying(id);
    try {
      await startCheckout(id, yearly);
    } catch (e) {
      setError(paymentError(e));
      setBuying("");
    }
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const current = Object.keys(ACTIVE).find((k) => ACTIVE[k].includes(plan)) || "free";
  return (
    <div className="fixed inset-0 z-[95] flex items-start sm:items-center justify-center overflow-y-auto bg-black/65 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="plans-title" className="relative my-auto w-full max-w-5xl rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-bg)] p-5 sm:p-7 text-[var(--cl-text)] shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-2 text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]"><X className="h-5 w-5" /></button>
        <h2 id="plans-title" className="text-center font-serif text-3xl">Plans</h2>
        <p className="mt-1 text-center text-[14px] text-[var(--cl-muted)]">The plans are here! You're on {CODE_NAMES[current]}. Pick what fits you.</p>
        <div className="mt-4 flex justify-center">
          <div className="inline-flex rounded-full border border-[var(--cl-border)] bg-[var(--cl-card)] p-1" role="group" aria-label="Billing">
            {[[false, "Monthly"], [true, `Yearly · ${YEARLY_OFF}% off`]].map(([v, label]) => (
              <button key={label} type="button" onClick={() => setYearly(v)} aria-pressed={yearly === v} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold ${yearly === v ? "bg-[var(--cl-text)] text-[var(--cl-bg)]" : "text-[var(--cl-muted)] hover:text-[var(--cl-text)]"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_PLANS.map((p) => {
            const mine = p.id === current;
            const y = yearly && p.yearly;
            return (
              <div key={p.id} className={`flex flex-col rounded-xl border p-4 ${p.highlight ? "border-[var(--cl-accent)] bg-[var(--cl-card)]" : "border-[var(--cl-border)] bg-[color-mix(in_srgb,var(--cl-card)_60%,transparent)]"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">{p.name}</p>
                  {p.highlight && <span className="rounded-full bg-[color-mix(in_srgb,var(--cl-accent)_20%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--cl-accent)]">Popular</span>}
                </div>
                <p className="mt-2"><span className="text-3xl font-bold">{y ? y.perMonth : p.price}</span><span className="text-[13px] text-[var(--cl-muted)]">{y ? "/month" : p.period}</span></p>
                {y && <p className="mt-0.5 text-[12.5px] font-medium text-emerald-400">{y.price} billed yearly</p>}
                <p className="mt-2 text-[13px] text-[var(--cl-muted)]">{p.blurb}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{f}</span></li>
                  ))}
                </ul>
                {mine ? (
                  <span className="mt-4 rounded-lg border border-[var(--cl-border)] py-2 text-center text-[14px] text-[var(--cl-muted)]">Your plan</span>
                ) : p.id === "enterprise" ? (
                  <button onClick={() => { onClose(); onEnterprise(); }} className="mt-4 rounded-lg bg-[var(--cl-text)] py-2 text-[14px] font-medium text-[var(--cl-bg)] hover:opacity-90">Contact us</button>
                ) : p.id === "free" ? (
                  <span className="mt-4 rounded-lg border border-[var(--cl-border)] py-2 text-center text-[14px] text-[var(--cl-muted)]">Included</span>
                ) : (
                  <button onClick={() => buy(p.id)} disabled={!!buying} className="mt-4 rounded-lg bg-[var(--cl-text)] py-2 text-[14px] font-medium text-[var(--cl-bg)] hover:opacity-90 disabled:opacity-60">{buying === p.id ? "One moment..." : `Choose ${p.name}${y ? " yearly" : ""}`}</button>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
