import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText, waitText } from "@/lib/creditRefresh";

// Shown above the message box once a usage limit is used up, like Claude's "You've hit your limit":
// which one (the 5-hour or the weekly limit, shared by every AI and chat) and when it resets, with a
// live countdown (cloudflare-lib/creditSession.js). When the time comes, the status is read again and
// sending opens up.
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
  if (!limits || !s.out) return null;
  const weekly = s.out === "week";
  return (
    <div className="mb-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-slate-100">You've hit your {weekly ? "weekly" : `${limits.session.hours}-hour`} limit</p>
      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          {weekly ? `${resetsText(s.resetAt, now, true)}, in ${waitText(s.resetAt - now)}` : resetsText(s.resetAt, now)}. Every AI and chat shares this limit.
        </span>
      </p>
    </div>
  );
}
