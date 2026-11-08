import { base44 } from "@/api/base44Client";
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Sparkles, Users, Clock, ArrowRight } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import PurchaseHistory from "@/components/profile/PurchaseHistory";
import UsageLimits from "@/components/chat/UsageLimits";

const PLAN = {
  free: { name: "Free", price: "$0" },
  pro: { name: "Pro", price: "$15 a month" },
  team: { name: "Team", price: "$20 a month" },
  secret: { name: "Secret", price: "$10 a month" },
  enterprise: { name: "Enterprise", price: "Per seat" },
  admin: { name: "Admin", price: "Free" },
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ending now";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h} hours left`;
  return `${Math.max(1, Math.floor(ms / 60000))} minutes left`;
}

// Profile → Settings → Subscriptions: the plan you're on, where it comes from, when it ends,
// its usage limits, and the new-member offer when you have it.
export default function SubscriptionPanel({ onBack, onManagePeople }) {
  const { credits } = useAppShell();
  const navigate = useNavigate();
  const plan = PLAN[credits.plan] || PLAN.free;
  const { planSource: source, planEndsAt: endsAt, offer, seats } = credits;
  // Stripe's own page for the card and canceling; plans from before Stripe still go through support.
  const manage = async () => {
    try {
      const r = await base44.functions.invoke("billing-portal", { from: window.location.pathname + window.location.search });
      if (!r.data?.url) throw new Error("no page");
      window.location.href = r.data.url;
    } catch {
      navigate("/contact?topic=billing");
    }
  };

  let status;
  if (source === "trial") status = `Free trial of Pro until ${fmtDate(endsAt)} (${timeLeft(endsAt)}). After that you're back on Free unless you choose a plan.`;
  else if (source === "paid") status = "Paid. You can change your card or cancel any time.";
  else if (source === "grant") status = endsAt ? `Given to you by Nebulux AI until ${fmtDate(endsAt)}.` : "Given to you by Nebulux AI, with no end date.";
  else if (source === "member") status = credits.plan === "enterprise" ? "Through your organization's Enterprise plan." : "Through your team's plan.";
  else if (source === "admin") status = "Admin account: every feature, free.";
  else status = "You're on the Free plan: up to 100,000 tokens every 5 hours and 1,000,000 a week, shared by every AI.";

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-indigo-300" />
        <h3 className="text-lg font-semibold text-white">Subscriptions</h3>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white font-semibold text-lg">
            {plan.name}
            {source === "trial" && (
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">Free trial</span>
            )}
          </p>
          <span className="text-sm text-slate-300">{credits.plan === "enterprise" && seats ? `${seats} seats` : plan.price}</span>
        </div>
        <p className="mt-2 text-sm text-slate-400 flex gap-1.5">
          {source === "trial" && <Clock className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />}
          {status}
        </p>
        {source === "paid" && (
          <button onClick={manage} className="mt-2 text-sm text-indigo-300 hover:text-indigo-200">
            Manage or cancel your subscription →
          </button>
        )}
      </div>

      {offer?.discountAvailable && (
        <div className="mt-3 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-fuchsia-500/10 p-4">
          <p className="flex items-center gap-1.5 text-amber-100 font-semibold">
            <Sparkles className="w-4 h-4" /> New-member offer: {offer.discountPct}% off any plan
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {timeLeft(offer.discountEndsAt)}. Keep the lower price for as long as you stay subscribed. One purchase only.
          </p>
        </div>
      )}

      {/* Usage limits, like Claude: the 5-hour and weekly limits every AI shares (cloudflare-lib/creditSession.js). */}
      <div className="mt-4">
        <p className="text-sm text-slate-300 font-medium">Usage limits</p>
        <UsageLimits tone="slate" />
      </div>

      <div className="mt-5 space-y-2">
        {source !== "admin" && source !== "member" && (
          <button
            onClick={() => navigate("/chat/shop")}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-medium hover:opacity-90"
          >
            {credits.plan === "free" || source === "trial" ? "Choose a plan" : "Change plan"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {["team", "enterprise", "secret"].includes(credits.plan) && source !== "member" && (
          <button onClick={onManagePeople} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700">
            <Users className="w-4 h-4" /> Manage people
          </button>
        )}
        {/* Settings has no Membership button any more: members see their team (and can leave it) here. */}
        {source === "member" && (
          <button onClick={onManagePeople} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700">
            <Users className="w-4 h-4" /> Your team
          </button>
        )}
      </div>
      <PurchaseHistory />
    </div>
  );
}
