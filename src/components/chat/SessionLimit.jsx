import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText } from "@/lib/creditRefresh";
import { openBuyUsage } from "@/lib/usageCredits";

// A small popup sitting on top of the message box once a usage limit is used up, like Claude's: which
// limit and when it resets (cloudflare-lib/creditSession.js), with what you can do about it.
// - the 5-hour limit: Buy usage credits (they extend only the 5-hour limit) or Upgrade
// - the weekly limit: Use the API or Upgrade (usage credits can't extend the week)
// When the time comes, the status is read again and sending opens up.
export default function SessionLimit() {
  const shell = useAppShell();
  const credits = shell?.credits;
  const limits = credits?.limits;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const s = limitsState(limits || null, now);
  useEffect(() => {
    if (limits && !s.out) credits?.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.out]);
  // (with the 5-hour limit used up but usage credits paying, sending goes on: SessionMeter says so)
  if (!limits || !s.out || credits?.onUsageCredits) return null;
  const weekly = s.out === "week";
  const btn = "rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap";
  return (
    // tucked behind the message box's top edge (it overlaps by 12px of bottom padding, no text there)
    <div role="status" className="-mb-3 mx-2 sm:mx-3 rounded-t-2xl rounded-b-lg border border-[var(--cl-border,#33333b)] bg-[var(--cl-card,#1e1e24)] px-3.5 pt-2.5 pb-5 shadow-lg flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="flex-1 min-w-[12rem] text-[13.5px] text-[var(--cl-text,#f4f4f5)] flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <span>
          <b className="font-semibold">You've hit your {weekly ? "weekly" : `${limits.session.hours}-hour`} limit</b>
          <span className="text-[var(--cl-muted,#a1a1aa)]"> · {resetsText(s.resetAt, now, weekly)}</span>
        </span>
      </p>
      <div className="flex gap-2">
        {weekly ? (
          <button type="button" onClick={() => window.open("/api", "_blank", "noopener")} className={`${btn} border border-[var(--cl-border,#33333b)] text-[var(--cl-text,#f4f4f5)] hover:bg-[var(--cl-hover)]`}>
            Use the API
          </button>
        ) : (
          <button type="button" onClick={openBuyUsage} className={`${btn} border border-[var(--cl-border,#33333b)] text-[var(--cl-text,#f4f4f5)] hover:bg-[var(--cl-hover)]`}>
            Buy usage credits
          </button>
        )}
        <button type="button" onClick={() => shell?.goPlans?.()} className={`${btn} bg-[var(--cl-text,#f4f4f5)] text-[var(--cl-bg,#18181b)] hover:opacity-90`}>
          Upgrade
        </button>
      </div>
    </div>
  );
}
