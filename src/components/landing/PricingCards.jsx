import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { PUBLIC_PLANS, YEARLY_OFF } from "@/lib/publicPlans";

// Free / Pro / Team / Enterprise cards for the public pages. Paid plans are bought from the
// app's Shop, so new people sign up first and land there; Enterprise goes to the
// application page. Monthly or yearly (a small discount for paying a year at once).
export default function PricingCards() {
  const { isAuthenticated } = useAuth();
  const [yearlyOn, setYearlyOn] = useState(false);
  const shop = "/chat/shop" + (yearlyOn ? "?billing=yearly" : "");
  const go = (id) =>
    id === "enterprise"
      ? "/enterprise"
      : id === "free"
      ? isAuthenticated ? "/chat" : "/register?returnTo=" + encodeURIComponent("/chat")
      : isAuthenticated ? shop : "/register?returnTo=" + encodeURIComponent(shop);

  return (
    <>
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full bg-slate-900/70 border border-slate-700/60 p-1" role="group" aria-label="Billing">
          {[
            [false, "Monthly"],
            [true, `Yearly · save ${YEARLY_OFF}%`],
          ].map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setYearlyOn(v)}
              aria-pressed={yearlyOn === v}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${yearlyOn === v ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PUBLIC_PLANS.map((p) => {
          const y = yearlyOn && p.yearly;
          return (
            <div
              key={p.id}
              className={`relative rounded-3xl p-6 flex flex-col ${
                p.highlight ? "bg-gradient-to-b from-indigo-500/20 to-fuchsia-500/10 border-2 border-indigo-400/60" : "bg-slate-900/60 border border-slate-700/50"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-3 py-1 rounded-full bg-indigo-600 text-[#fff]">Most popular</span>
              )}
              <p className="text-lg font-semibold text-white">{p.name}</p>
              <p className="mt-2">
                <span className="text-4xl font-bold text-white">{y ? y.price : p.price}</span>
                <span className="text-slate-400">{y ? y.period : p.period}</span>
              </p>
              {y && <p className="mt-1 text-xs font-semibold text-emerald-300">{y.perMonth} a month, billed yearly · save {YEARLY_OFF}%</p>}
              <p className="mt-2 text-sm text-slate-400">{p.blurb}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={go(p.id)}
                className={`mt-6 py-3 rounded-full text-center font-semibold ${
                  p.highlight ? "bg-white text-slate-900 hover:bg-slate-200" : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
              >
                {p.id === "free" ? "Get started for free" : p.id === "enterprise" ? "Contact sales" : `Choose ${p.name}${y ? " yearly" : ""}`}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
