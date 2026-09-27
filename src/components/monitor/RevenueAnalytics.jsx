import React, { useState, useEffect } from "react";
import { Loader2, TrendingUp, Globe, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { payoutWarnings, payoutSummary, HOLD_DAYS } from "@/lib/payoutChecks";

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

export default function RevenueAnalytics() {
  const [sales, setSales] = useState(null);
  // Sites an admin took down: their sales are held (see payoutWarnings).
  const [takenDown, setTakenDown] = useState(() => new Set());

  useEffect(() => {
    base44.entities.SiteSale.filter({ status: "paid" }, "-paidAt", 500)
      .then((rows) => setSales(rows || []))
      .catch(() => setSales([]));
    base44.functions
      .invoke("admin-reports", { action: "list" })
      .then((r) => setTakenDown(new Set((r.data?.hidden || []).filter((h) => h.kind === "site").map((h) => h.name))))
      .catch(() => {});
  }, []);

  if (!sales) {
    return (
      <div className="w-full max-w-3xl mt-6 flex justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const num = (v) => parseFloat(v || "0") || 0;
  const gross = sales.reduce((s, r) => s + num(r.gross), 0);
  const fees = sales.reduce((s, r) => s + num(r.platformFee), 0);
  const payouts = sales.reduce((s, r) => s + num(r.creatorPayout), 0);

  const bySite = {};
  sales.forEach((r) => {
    const k = r.siteName || "unknown";
    bySite[k] = bySite[k] || { gross: 0, payout: 0, count: 0 };
    bySite[k].gross += num(r.gross);
    bySite[k].payout += num(r.creatorPayout);
    bySite[k].count += 1;
  });
  const top = Object.entries(bySite).sort((a, b) => b[1].gross - a[1].gross);
  const max = top[0]?.[1].gross || 1;
  // Before paying creators by hand: what's fine to pay, what to hold, and why.
  const summary = payoutSummary(sales, Date.now(), takenDown);
  const flagged = sales.map((r) => ({ r, why: payoutWarnings(r, sales, Date.now(), takenDown).filter((w) => !w.startsWith("Paid less than")) })).filter((x) => x.why.length);

  return (
    <div className="w-full max-w-3xl mt-8">
      <p className="text-slate-300 text-sm font-medium inline-flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-300" /> Site sales analytics
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        {[
          ["Total revenue", money(gross)],
          ["Platform fees", money(fees)],
          ["Creator payouts", money(payouts)],
          ["Paid orders", String(sales.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <p className="text-slate-400 text-xs">{label}</p>
            <p className="text-white text-lg font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {summary.length > 0 && (
        <div className="mt-5">
          <p className="text-slate-300 text-sm font-medium inline-flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-300" /> Before you pay creators
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
            Hold payouts for sales from the last {HOLD_DAYS} days (card disputes come then) and for anything flagged below: buying from your own site with a
            stolen card is the usual way people try to cash out. Refunds and disputes aren't recorded here yet, so check each order in your Wix
            dashboard before paying for it.
          </p>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl divide-y divide-slate-700/50">
            {summary.map((c) => (
              <div key={c.creatorEmail} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-200 truncate">{c.creatorEmail}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  <span className="text-emerald-300 font-semibold">{money(c.ready)}</span> ready ·{" "}
                  <span className={c.hold ? "text-amber-300 font-semibold" : ""}>{money(c.hold)}</span> hold
                </span>
              </div>
            ))}
          </div>
          {flagged.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {flagged.slice(0, 20).map(({ r, why }) => (
                <div key={r.id || r.checkoutSessionId} className="bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 text-xs">
                  <p className="text-amber-100">
                    {r.siteName} · {money(num(r.gross))} · buyer {r.buyerEmail || "unknown"}
                  </p>
                  <p className="text-amber-300/90">{why.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-2">
        <p className="text-slate-300 text-sm font-medium">Top earning sites</p>
        {top.length === 0 && <p className="text-slate-500 text-sm">No paid sales yet.</p>}
        {top.map(([name, s]) => (
          <div key={name} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-200 text-sm inline-flex items-center gap-1.5 truncate">
                <Globe className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                {name}
                <span className="text-sky-300">.nebuluxai.com</span>
              </span>
              <span className="text-white text-sm font-semibold shrink-0">{money(s.gross)}</span>
            </div>
            <div className="h-1.5 mt-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${(s.gross / max) * 100}%` }} />
            </div>
            <p className="text-slate-500 text-xs mt-1.5">
              {s.count} order{s.count === 1 ? "" : "s"} · {money(s.payout)} creator payout
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}