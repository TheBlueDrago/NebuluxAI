import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { sessionState, resetTimeText, waitText } from "@/lib/creditRefresh";

// Shown above the message box once this session's credits are used (1 per message, 50 per 5-hour
// session, cloudflare-lib/creditSession.js): when the next session starts, with a live countdown. When the time
// comes, credits are read again and sending opens up.
export default function SessionLimit() {
  const shell = useAppShell();
  const credits = shell?.credits;
  const session = credits?.session;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const s = sessionState(session, now);
  useEffect(() => {
    if (session && !s.out) credits?.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.out]);
  if (!session || !s.out) return null;
  return (
    <div className="mb-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-slate-100">You've used all {session.limit} credits for this session</p>
      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          Each message uses 1 credit. Your next {session.hours}-hour session starts at {resetTimeText(s.resetAt, now)} — in {waitText(s.resetAt - now)}.
        </span>
      </p>
    </div>
  );
}
