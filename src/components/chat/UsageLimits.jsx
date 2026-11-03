import React from "react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText } from "@/lib/creditRefresh";

// Usage, like Claude's (cloudflare-lib/creditSession.js): "Current session" (the 5-hour limit) and
// "Weekly limits · All AIs", each with how much is used and when it resets. Every AI and chat shares
// them. tone "cl" for Settings (Claude-style colours), "slate" for the Subscription panel.
export default function UsageLimits({ tone = "cl" }) {
  const credits = useAppShell()?.credits;
  const limits = credits?.limits;
  const cl = tone === "cl";
  const text = cl ? "text-[var(--cl-text)]" : "text-slate-200";
  const muted = cl ? "text-[var(--cl-muted)]" : "text-slate-400";
  const track = cl ? "bg-[var(--cl-hover)]" : "bg-slate-800";
  if (limits === null) return <p className={`text-[14px] ${muted}`}>This account has no usage limits.</p>;
  if (!limits) return <p className={`text-[14px] ${muted}`}>Loading…</p>;
  const s = limitsState(limits);
  const rows = [
    ["Current session", `${limits.session.hours}-hour limit`, s.session, false],
    ["Weekly limits", "All AIs", s.week, true],
  ];
  return (
    <div>
      {rows.map(([title, sub, w, weekly]) => (
        <div key={title} className="py-3">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className={text}>
              {title} <span className={`text-[12.5px] ${muted}`}>· {sub}</span>
            </span>
            <span className={`shrink-0 ${muted}`}>{w.pct}% used</span>
          </div>
          <div className={`mt-1.5 h-2 rounded-full ${track} overflow-hidden`} role="progressbar" aria-label={`${title}: ${w.pct}% used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w.pct}>
            <div className={`h-full rounded-full ${w.pct >= 90 ? "bg-red-400" : w.pct >= 75 ? "bg-amber-400" : "bg-blue-500"}`} style={{ width: `${w.pct}%` }} />
          </div>
          <p className={`mt-1 text-[12.5px] ${muted}`}>{w.resetAt ? resetsText(w.resetAt, Date.now(), weekly) : weekly ? "Starts with your next message, then resets 7 days later" : "Starts with your next message, then resets 5 hours later"}</p>
        </div>
      ))}
      <p className={`mt-1 text-[12.5px] ${muted}`}>Every AI and chat shares these limits. Longer replies and more thinking use more, and stronger AIs use more too: Galaxy 1.5 times as much as Nebulux AI, Space twice and Nebula three times.</p>
    </div>
  );
}
