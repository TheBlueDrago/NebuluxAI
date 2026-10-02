import React from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Globe, Gamepad2, Zap, Clock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { useAiActivity, useNow, liveCost, elapsedText, markSeen, tokenText } from "@/lib/aiActivity";
import { TOKENS_PER_CREDIT } from "../../../cloudflare-lib/planTotals.js";
import { waitText } from "@/lib/creditRefresh";
import StatusMark from "@/components/chat/StatusMark";

const PLACES = {
  chat: { name: "Chat", Icon: MessageSquare, color: "text-indigo-300" },
  website: { name: "Website Designer", Icon: Globe, color: "text-sky-300" },
  game: { name: "Game Designer", Icon: Gamepad2, color: "text-fuchsia-300" },
};

function Meter({ label, used, limit, resetsAt, now, off }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-slate-100">{label}</span>
        <span className="text-slate-400">{off ? "not counted" : `${pct}% used`}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-700/70 overflow-hidden">
        <div className={`h-full ${off ? "opacity-30" : ""} ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-gradient-to-r from-indigo-500 to-fuchsia-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {off
          ? "Lifted in the last week of the month, so you can use the rest of your month"
          : `${tokenText((limit - Math.min(used, limit)) * TOKENS_PER_CREDIT)} tokens left · refreshes in ${waitText(Date.parse(resetsAt) - now)}`}
      </p>
    </div>
  );
}

// The first page after signing in: what the AI is working on everywhere, and the credits left.
export default function Dashboard() {
  const shell = useAppShell();
  const navigate = useNavigate();
  const activity = useAiActivity();
  const now = useNow(1000);
  const pool = shell?.credits?.pool;
  const name = String(shell?.currentUser?.full_name || "").trim().split(/\s+/)[0];
  const items = Object.values(activity).sort((a, b) => (a.status === "working" ? -1 : 0) - (b.status === "working" ? -1 : 0) || (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt));

  const open = (e) => {
    if (e.key.startsWith("chat:")) {
      shell?.conv?.selectConversation?.(e.key.slice(5));
      navigate("/chat");
    } else navigate(e.key === "website" ? "/chat/designer/build" : "/chat/game-designer");
    markSeen(e.key);
  };

  return (
    <div className="w-full max-w-3xl px-3 sm:px-4">
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-3xl shadow-2xl p-5 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
        <p className="text-sm text-slate-400 mt-1">Pick up where you left off, or start something new.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.1fr]">
          {/* Left: what the AI is doing */}
          <section className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-300" /> AI activity
            </h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing running right now. Answers the AI is writing show up here, wherever you asked.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {items.map((e) => {
                  const P = PLACES[e.where] || PLACES.chat;
                  const cost = e.status === "working" ? liveCost(e) : e.charged;
                  return (
                    <li key={e.key}>
                      <button type="button" onClick={() => open(e)} className="w-full text-left rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 px-3 py-2.5 transition-colors">
                        <div className="flex items-center gap-2 text-xs">
                          <StatusMark status={e.status} />
                          <P.Icon className={`w-3.5 h-3.5 ${P.color}`} />
                          <span className="text-slate-300 font-medium">{e.ai || "Nebulux AI"}</span>
                          <span className="text-slate-500">· {P.name}{e.where === "chat" && e.label ? `: ${e.label}` : ""}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-100 line-clamp-2">
                          {e.status === "working" ? "Still working on: " : e.status === "out" ? "Stopped, out of tokens: " : "Answer ready: "}
                          <span className="text-slate-300">{e.question || "your question"}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {e.status === "working"
                            ? `${elapsedText(now - e.startedAt)}${cost != null ? ` · ≈ ${tokenText(cost)} tokens so far` : ""}`
                            : e.status === "out"
                              ? e.resetsAt
                                ? `Tokens come back in ${waitText(Date.parse(e.resetsAt) - now)}`
                                : "Tokens come back soon"
                              : `Took ${elapsedText(e.took || 0)}${cost != null ? ` · ${tokenText(cost * TOKENS_PER_CREDIT)} tokens` : ""}`}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Middle: credits */}
          <section className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-300" /> Your tokens
            </h2>
            {pool ? (
              <>
                <p className="mt-2 text-3xl font-bold text-white">
                  {tokenText(pool.remaining * TOKENS_PER_CREDIT)} <span className="text-base font-medium text-slate-400">tokens to use now</span>
                </p>
                <p className="text-[12px] text-slate-500">One pool for every AI. Each answer uses the tokens the AI reads (the whole chat so far) and writes; stronger AIs and higher strength use more.</p>
                <div className="mt-4 space-y-4">
                  <Meter label="2 hour limit" used={pool.window.used} limit={pool.window.limit} resetsAt={pool.window.resetsAt} now={now} />
                  <Meter label="Weekly limit" used={pool.week.used} limit={pool.week.limit} resetsAt={pool.week.resetsAt} now={now} off={pool.week.off} />
                  {pool.month && <Meter label="Monthly limit" used={pool.month.used} limit={pool.month.limit} resetsAt={pool.month.resetsAt} now={now} />}
                  {pool.bonus > 0 && (
                    <p className="text-sm text-slate-300">
                      + <b>{tokenText(pool.bonus * TOKENS_PER_CREDIT)}</b> bonus tokens, used once a limit is reached.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Loading your tokens…</p>
            )}
          </section>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => shell?.newChat?.()} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[#fff] text-sm font-semibold py-2.5">New chat</button>
          <button type="button" onClick={() => shell?.goDesigner?.()} className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold py-2.5">Make a website</button>
          <button type="button" onClick={() => shell?.goGames?.()} className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold py-2.5">Make a game</button>
        </div>
      </div>
    </div>
  );
}
