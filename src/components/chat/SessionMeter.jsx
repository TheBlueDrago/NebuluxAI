import React from "react";
import { Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { sessionState, resetTimeText, creditText } from "@/lib/creditRefresh";

// "34.5 of 50 credits left this session · resets 3:42 PM" above the message box, once a session is
// running (cloudflare-lib/creditSession.js: 50 credits per 5-hour session, used by how much work each
// reply takes, shared by every AI and chat). Hidden while it's used up (SessionLimit shows instead) and for accounts
// without a session limit.
export default function SessionMeter() {
  const shell = useAppShell();
  const session = shell?.credits?.session;
  const s = sessionState(session);
  if (!session || !s.running || s.out) return null;
  const pct = Math.round((s.left / session.limit) * 100);
  const low = s.left <= Math.ceil(session.limit / 5);
  return (
    <div className="mb-2 flex items-center gap-2 px-1 text-xs text-slate-400" title={`Replies use credits by how much work they take: a quick answer costs a fraction of one, a long or hard one costs more. You get ${session.limit} per ${session.hours}-hour session (every AI and chat shares them), starting from your first message.`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className={low ? "text-amber-300" : ""}>
        {creditText(s.left)} of {session.limit} credits left this session · resets {resetTimeText(s.resetAt)}
      </span>
      <span className="ml-auto h-1 w-16 rounded-full bg-slate-800 overflow-hidden">
        <span className={`block h-full ${low ? "bg-amber-400" : "bg-gradient-to-r from-indigo-400 to-fuchsia-400"}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
