import React, { useEffect } from "react";
import { Check, X } from "lucide-react";
import { PUBLIC_PLANS } from "@/lib/publicPlans";

// "Upgrade plan" (account menu, and every Upgrade button): the four plans in a popup.
// No promo codes here: those only go on the Billing page. Pro and Team can't be bought yet
// (payments aren't set up), so their buttons say so; Enterprise goes to its application page.
const CODE_NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };
const ACTIVE = { pro: ["pro"], team: ["team"], enterprise: ["enterprise"], free: ["free"] };

export default function PlansDialog({ open, onClose, plan, onEnterprise }) {
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
        <p className="mt-1 text-center text-[14px] text-[var(--cl-muted)]">You're on {CODE_NAMES[current]}. Pick what fits you.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_PLANS.map((p) => {
            const mine = p.id === current;
            return (
              <div key={p.id} className={`flex flex-col rounded-xl border p-4 ${p.highlight ? "border-[var(--cl-accent)] bg-[var(--cl-card)]" : "border-[var(--cl-border)] bg-[var(--cl-card)]/60"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">{p.name}</p>
                  {p.highlight && <span className="rounded-full bg-[var(--cl-accent)]/20 px-2 py-0.5 text-[11px] font-medium text-[var(--cl-accent)]">Popular</span>}
                </div>
                <p className="mt-2"><span className="text-3xl font-bold">{p.price}</span><span className="text-[13px] text-[var(--cl-muted)]">{p.period}</span></p>
                <p className="mt-2 text-[13px] text-[var(--cl-muted)]">{p.blurb.replace(" Coming soon in a later update.", "")}</p>
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
                  <button disabled title="Paid plans aren't open yet" className="mt-4 rounded-lg bg-[var(--cl-text)] py-2 text-[14px] font-medium text-[var(--cl-bg)] opacity-50 cursor-not-allowed">Coming soon</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
