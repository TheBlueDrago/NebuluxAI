import React, { useState } from "react";
import { useAppShell } from "@/components/AppShellContext";
import { limitsState, resetsText } from "@/lib/creditRefresh";
import { openBuyUsage } from "@/lib/usageCredits";

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Usage, like Claude's (cloudflare-lib/creditSession.js): "Current session" (the 5-hour limit) and
// "Weekly limits · All AIs" (resets every Thursday at 8:00 AM Central, shown in your own time), each with
// how much is used and when it resets; then Extra usage: usage credits (they extend only the 5-hour
// limit) and how much of them may be spent a day. tone "cl" for Settings, "slate" for the Subscription panel.
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
          <p className={`mt-1 text-[12.5px] ${muted}`}>{w.resetAt ? resetsText(w.resetAt, Date.now(), weekly) : "Starts with your next message, then resets 5 hours later"}</p>
        </div>
      ))}
      <p className={`mt-1 text-[12.5px] ${muted}`}>Every AI and chat shares these limits. Longer replies and more thinking use more, and stronger AIs use more too: Galaxy 1.5 times as much as Nebulux AI, Space twice and Nebula three times.</p>
      <ExtraUsage credits={credits} text={text} muted={muted} cl={cl} />
    </div>
  );
}

// Extra usage: the usage credits balance (in dollars, like Claude), Buy usage credits, and the daily
// spending limit (cloudflare-lib/usageCredits.js), editable here.
function ExtraUsage({ credits, text, muted, cl }) {
  const uc = credits?.usageCredits || { balance: 0, dailyLimit: null, spentToday: 0 };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const box = cl ? "border-[var(--cl-border)]" : "border-slate-700";
  const btn = `rounded-lg px-3 py-1.5 text-[13px] font-medium border ${box} ${text} ${cl ? "hover:bg-[var(--cl-hover)]" : "hover:bg-slate-800"}`;
  const save = async (limit) => {
    setSaving(true);
    setErr("");
    try {
      await credits.saveDailyLimit(limit);
      setEditing(false);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={`mt-5 pt-4 border-t ${box}`}>
      <p className={`text-[14px] font-medium ${text}`}>Extra usage</p>
      <p className={`mt-1 text-[12.5px] ${muted}`}>Usage credits keep every AI going when you hit your 5-hour limit, until it resets. They can't extend your weekly limit, and what they pay for still counts toward it: when the week is used up, upgrade or use the API.</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[13px] ${muted}`}>Usage credits</p>
          <p className={`text-[20px] font-semibold ${text}`}>{money(uc.balance)}</p>
        </div>
        <button type="button" onClick={openBuyUsage} className={btn}>Buy usage credits</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[13px] ${muted}`}>Daily spending limit</p>
          <p className={`text-[14px] ${text}`}>{uc.dailyLimit == null ? "No limit" : `Up to $${uc.dailyLimit} a day`}{uc.spentToday > 0 ? ` · ${money(uc.spentToday)} spent today` : ""}</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => { setVal(uc.dailyLimit == null ? "" : String(uc.dailyLimit)); setErr(""); setEditing(true); }} className={btn}>Edit</button>
        )}
      </div>
      {editing && (
        <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(val.trim() === "" ? null : val); }}>
          <label className={`flex items-center gap-1 rounded-lg border ${box} px-2 py-1.5 focus-within:border-blue-500`}>
            <span className={muted}>$</span>
            <input autoFocus inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder="No limit" aria-label="Daily spending limit in dollars, $1 to $500" className={`w-24 bg-transparent text-[14px] outline-none ${text}`} />
            <span className={`text-[12.5px] ${muted}`}>a day</span>
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-[13px] font-medium text-[#fff] disabled:opacity-60">Save</button>
          <button type="button" disabled={saving} onClick={() => save(null)} className={btn}>No limit</button>
          <button type="button" disabled={saving} onClick={() => setEditing(false)} className={`text-[13px] ${muted} hover:underline`}>Cancel</button>
          <p className={`w-full text-[12.5px] ${err ? "text-amber-400" : muted}`}>{err || "A whole number of dollars from $1 to $500, or no limit."}</p>
        </form>
      )}
    </div>
  );
}
