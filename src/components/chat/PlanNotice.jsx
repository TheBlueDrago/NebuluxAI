import React, { useState } from "react";
import { Sparkles, Clock, X } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";

const HOUR = 3600000;
const seen = (key) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const remember = (key) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: it just shows again next time.
  }
};
function left(iso) {
  const h = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / HOUR));
  return h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} hour${h === 1 ? "" : "s"}` : "less than an hour";
}

// A short note above the chat about the new-member offer: the free Pro week starting, its last
// day, and the 48 hours of 30% off after it. Each can be closed and stays closed.
export default function PlanNotice() {
  const { credits, goPlans } = useAppShell();
  const [, rerender] = useState(0);
  const { planSource, planEndsAt, offer } = credits;
  if (!offer) return null;

  let note = null;
  if (planSource === "trial" && planEndsAt) {
    const lastDay = new Date(planEndsAt).getTime() - Date.now() <= 24 * HOUR;
    note = lastDay
      ? {
          key: `bh-note-trial-ending:${planEndsAt}`,
          icon: Clock,
          text: `Your free week of Pro ends in ${left(planEndsAt)}. Your new-member discount, ${offer.discountPct}% off any plan, lasts until 48 hours after that.`,
          action: "Keep Pro",
        }
      : {
          key: `bh-note-trial-start:${planEndsAt}`,
          icon: Sparkles,
          text: `Your free week of Pro has started: all 4 AIs, for ${left(planEndsAt)}. ZIP downloads and connecting a GitHub repo aren't included in the free week; they come with a paid plan. As a new member you also get ${offer.discountPct}% off any plan, once.`,
        };
  } else if (offer.discountAvailable) {
    note = {
      key: `bh-note-offer:${offer.discountEndsAt}`,
      icon: Sparkles,
      text: `New-member offer: ${offer.discountPct}% off any plan (kept as long as you stay subscribed), for ${left(offer.discountEndsAt)}. One purchase only.`,
      action: "See plans",
    };
  }
  if (!note || seen(note.key)) return null;

  const close = () => {
    remember(note.key);
    rerender((n) => n + 1);
  };
  const Icon = note.icon;
  return (
    // Top margin on phones clears the menu and account buttons fixed at the top of the screen.
    <div className="w-full max-w-3xl px-3 sm:px-4 mb-3 mt-14 sm:mt-0">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10 px-4 py-3">
        <Icon className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <p className="flex-1 text-sm text-slate-200">{note.text}</p>
        {note.action && (
          <button onClick={goPlans} className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold hover:bg-slate-200">
            {note.action}
          </button>
        )}
        <button onClick={close} className="shrink-0 p-1 text-slate-400 hover:text-white" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
