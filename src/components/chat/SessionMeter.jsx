import React from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText } from "@/lib/creditRefresh";
import { estimateShare } from "@/lib/costEstimate";

// The note above the message box. It always says how much of the usage limit is left, so nobody
// is surprised: "88% of your 5-hour limit left · Resets in 1 hr 10 min". Once a limit is getting
// close (75% used) it turns amber, like Claude's: "You've used 82% of your 5-hour limit". The weekly
// limit is mentioned when it's the closer one. With `estimate` ({ text, tier, effort, kind, images }),
// it also says what the message being typed will probably use, before it's sent.
// Hidden while a limit is used up (SessionLimit shows instead) and for accounts without limits
// (cloudflare-lib/creditSession.js).
export const WARN_AT = 75;

export default function SessionMeter({ estimate }) {
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
  const weekly = s.week.pct >= s.session.pct && s.week.pct > 0;
  const w = weekly ? s.week : s.session;
  const warn = w.pct >= WARN_AT;
  const name = weekly ? "weekly" : `${limits.session.hours}-hour`;
  const est = estimate && (estimate.text || "").trim() ? estimateShare(limits, estimate) : null;
  const what = estimate && estimate.kind === "build" ? "build" : "message";
  const reset = resetsText(w.resetAt, Date.now(), weekly);
  return (
    <div
      className={`mb-2 flex items-center gap-2 px-1 text-xs min-h-[1.25rem] ${warn ? "text-amber-300" : "text-slate-400"}`}
      title="Every AI and chat shares your usage limits. Longer replies, more thinking and stronger AIs use more."
      data-usage-meter
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className="min-w-0">
        {warn ? `You've used ${w.pct}% of your ${name} limit` : `${100 - w.pct}% of your ${name} limit left`}
        {reset ? ` · ${reset}` : ""}
        {est && (
          <span className={est.enough ? "" : "text-amber-300"} data-cost-estimate>
            {" · "}This {what}: about {est.pct}%{est.enough ? "" : " (more than you have left, so it may stop early)"}
          </span>
        )}
      </span>
      <span className="ml-auto shrink-0 h-1 w-16 rounded-full bg-slate-800 overflow-hidden">
        <span className={`block h-full ${warn ? "bg-amber-400" : "bg-indigo-400"}`} style={{ width: `${w.pct}%` }} />
      </span>
    </div>
  );
}
