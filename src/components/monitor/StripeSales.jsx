import React, { useState } from "react";
import { CreditCard } from "lucide-react";

const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;
const STATUS = {
  paid: ["Paid", "text-emerald-300"],
  processing: ["Bank payment clearing", "text-amber-300"],
  unpaid: ["Payment failed", "text-red-300"],
  failed: ["Payment failed", "text-red-300"],
  canceled: ["Canceled", "text-slate-400"],
};
const whenText = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Monitor → Plans, usage credits and API funds: what people bought through Stripe, from the rows the signed
// webhook writes (cloudflare-lib/monitorLive.js).
export default function StripeSales({ data, users }) {
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;
  const { sales = [], stripe = {} } = data;
  // Sandbox and real money never add up together: while the sandbox keys are in, only test payments
  // count, and once real keys are in, only real ones.
  const counted = sales.filter((s) => s.live === !!stripe.live);
  const tookMoney = counted.filter((s) => s.status === "paid" || s.status === "canceled");
  const active = counted.filter((s) => s.kind === "plan" && s.status === "paid");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const sum = (list) => list.reduce((n, s) => n + s.cents, 0);
  const perMonth = active.reduce((n, s) => n + (s.billing === "yearly" ? s.cents / 12 : s.cents), 0);
  const count = (plan) => active.filter((s) => s.plan === plan).length;
  const stats = [
    ["Paying now", active.length],
    ["Each month", money(perMonth)],
    ["Sold this month", money(sum(tookMoney.filter((s) => Date.parse(s.at) >= startOfMonth.getTime())))],
    ["Sold in all", money(sum(tookMoney))],
  ];
  const emailOf = (id) => (users.find((u) => u.id === id) || {}).email || "an account";
  const shown = showAll ? sales : sales.slice(0, 8);
  return (
    <div className="w-full max-w-3xl mt-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="flex items-center gap-2 text-white font-semibold text-sm">
          <CreditCard className="w-4 h-4 text-emerald-300" /> Plans, usage credits and API funds
        </p>
        {stripe.ready && !stripe.live && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40">Test payments, no real money</span>}
      </div>
      {!stripe.ready && <p className="mt-2 text-sm text-slate-400">Stripe isn't connected, so nothing can be bought yet.</p>}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Pro: <b className="text-white">{count("pro")}</b> · Team: <b className="text-white">{count("team")}</b> · Orbit Starter: <b className="text-white">{count("orbit-starter")}</b> · Orbit Expert: <b className="text-white">{count("orbit-expert")}</b> · Usage credits sold: <b className="text-white">{money(sum(tookMoney.filter((s) => s.kind === "usage")))}</b> · API funds sold: <b className="text-white">{money(sum(tookMoney.filter((s) => s.kind === "api")))}</b>
      </p>
      <p className="mt-1 text-[11px] text-slate-500">Counts each first payment. Renewals are in your Stripe dashboard.</p>
      {sales.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nothing bought yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-800">
          {shown.map((s) => {
            const [label, cls] = STATUS[s.status] || [s.status, "text-slate-400"];
            return (
              <div key={s.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {s.name}
                    {!s.live && <span className="ml-2 text-[11px] text-amber-300">Test</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{emailOf(s.userId)} · {whenText(s.at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-white">{money(s.cents)}</p>
                  <p className={`text-xs ${cls}`}>{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {sales.length > 8 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm text-slate-400 hover:text-slate-200">
          {showAll ? "Show fewer" : `Show all ${sales.length}`}
        </button>
      )}
    </div>
  );
}
