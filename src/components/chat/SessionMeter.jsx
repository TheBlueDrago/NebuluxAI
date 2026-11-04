import React from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText } from "@/lib/creditRefresh";

// Like Claude, a note above the message box only once a usage limit is getting close (75% used):
// "You've used 82% of your 5-hour limit · Resets in 1 hr 10 min". The weekly limit is mentioned
// when it's the closer one. Hidden while a limit is used up (SessionLimit shows instead) and for
// accounts without limits (cloudflare-lib/creditSession.js).
export const WARN_AT = 75;

export default function SessionMeter() {
  const shell = useAppShell();
  const limits = shell?.credits?.limits;
  const s = limitsState(limits || null);
  // 5-hour limit used up, usage credits paying for messages until it resets (they never extend the week)
  if (limits && shell?.credits?.onUsageCredits) {
    const left = shell.credits.usageCredits?.spendable || 0;
    return (
      <div className="mb-2 flex items-center gap-2 px-1 text-xs text-sky-300">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          Using usage credits until your {limits.session.hours}-hour limit resets · ${left.toFixed(2)} left today · {resetsText(s.session.resetAt, Date.now())}
        </span>
      </div>
    );
  }
  if (!limits || s.out) return null;
  const weekly = s.week.pct >= s.session.pct;
  const w = weekly ? s.week : s.session;
  if (w.pct < WARN_AT) return null;
  return (
    <div className="mb-2 flex items-center gap-2 px-1 text-xs text-amber-300" title="Every AI and chat shares your usage limits. Longer replies, more thinking and stronger AIs use more.">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>
        You've used {w.pct}% of your {weekly ? "weekly" : `${limits.session.hours}-hour`} limit · {resetsText(w.resetAt, Date.now(), weekly)}
      </span>
      <span className="ml-auto h-1 w-16 rounded-full bg-slate-800 overflow-hidden">
        <span className="block h-full bg-amber-400" style={{ width: `${w.pct}%` }} />
      </span>
    </div>
  );
}
