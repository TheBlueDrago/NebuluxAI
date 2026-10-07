import React, { useMemo, useState } from "react";

// Your Nebulux Code activity on the new-chat screen (like Claude Code's): sessions, messages,
// tokens, active days, peak hour, favorite model, and a calendar of active days. Counted in this
// browser only, per account.
const KEY = (userId, kind = "code") => `nx-${kind}-stats:${userId || "anon"}`;
const MAX = 5000;
const DAY = 86400000;

export function readStats(userId, kind) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(userId, kind)) || "null");
    return s && Array.isArray(s.msgs) ? s : { sessions: [], msgs: [] };
  } catch {
    return { sessions: [], msgs: [] };
  }
}
const write = (userId, s, kind) => {
  try {
    localStorage.setItem(KEY(userId, kind), JSON.stringify({ sessions: s.sessions.slice(-MAX), msgs: s.msgs.slice(-MAX) }));
  } catch {
    // Storage full or blocked: the numbers just don't grow.
  }
};
export function recordSession(userId, kind) {
  const s = readStats(userId, kind);
  s.sessions.push(Date.now());
  write(userId, s, kind);
}
// chars: the message plus the reply; tokens are about a quarter of that.
export function recordMessage(userId, model, chars, kind) {
  const s = readStats(userId, kind);
  s.msgs.push([Date.now(), model, Math.max(0, chars | 0)]);
  write(userId, s, kind);
}

const short = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
const hourName = (h) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);
const dayKey = (t) => new Date(t).toDateString();

export default function CodeStats({ userId, names, kind }) {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("all");
  const data = useMemo(() => readStats(userId, kind), [userId, kind]);
  const since = range === "7d" ? Date.now() - 7 * DAY : range === "30d" ? Date.now() - 30 * DAY : 0;
  const msgs = data.msgs.filter((m) => m[0] >= since);
  const sessions = data.sessions.filter((t) => t >= since).length;

  const perDay = {};
  const perHour = Array(24).fill(0);
  const perModel = {};
  let chars = 0;
  for (const [t, model, c] of msgs) {
    perDay[dayKey(t)] = (perDay[dayKey(t)] || 0) + 1;
    perHour[new Date(t).getHours()]++;
    perModel[model] = (perModel[model] || 0) + 1;
    chars += c;
  }
  const peak = msgs.length ? perHour.indexOf(Math.max(...perHour)) : null;
  const fav = Object.entries(perModel).sort((a, b) => b[1] - a[1])[0];
  const tiles = [
    ["Sessions", sessions.toLocaleString()],
    ["Messages", msgs.length.toLocaleString()],
    ["Total tokens", short(Math.round(chars / 4))],
    ["Active days", Object.keys(perDay).length],
    ["Peak hour", peak == null ? "—" : hourName(peak)],
    ["Favorite model", fav ? names[fav[0]] || fav[0] : "—"],
  ];

  // The calendar: 26 weeks, a column per week, Sunday on top, today last.
  const weeks = 26;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (weeks * 7 - 1 - (6 - today.getDay())) * DAY);
  const max = Math.max(1, ...Object.values(perDay));
  const shade = (n) => (!n ? "bg-[var(--cl-hover)]" : n / max > 0.66 ? "bg-violet-400" : n / max > 0.33 ? "bg-violet-500" : "bg-violet-700");

  const Pill = ({ on, onClick, children }) => (
    <button onClick={onClick} className={`px-2.5 py-1.5 sm:py-0.5 rounded-md text-[13.5px] ${on ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:text-[var(--cl-text)]"}`}>{children}</button>
  );

  return (
    <div className="rounded-2xl bg-[var(--cl-card)] border border-[var(--cl-border)] p-4 font-sans">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <Pill on={tab === "overview"} onClick={() => setTab("overview")}>Overview</Pill>
          <Pill on={tab === "models"} onClick={() => setTab("models")}>Models</Pill>
        </div>
        <div className="flex gap-1">
          {[["all", "All"], ["30d", "30d"], ["7d", "7d"]].map(([k, l]) => (
            <Pill key={k} on={range === k} onClick={() => setRange(k)}>{l}</Pill>
          ))}
        </div>
      </div>
      {tab === "overview" ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {tiles.map(([l, v]) => (
              <div key={l} className="rounded-lg bg-[var(--cl-hover)]/60 px-2.5 py-1.5">
                <p className="text-[13px] text-[var(--cl-muted)]">{l}</p>
                <p className="text-[15px] font-semibold text-[var(--cl-text)] truncate">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-[3px] overflow-hidden" aria-label="Days you used Nebulux AI">
            {Array.from({ length: weeks }, (_, w) => (
              <div key={w} className="flex flex-col gap-[3px] flex-1 min-w-0">
                {Array.from({ length: 7 }, (_, d) => {
                  const day = new Date(start.getTime() + (w * 7 + d) * DAY);
                  if (day > today) return <div key={d} className="aspect-square" />;
                  const n = perDay[day.toDateString()] || 0;
                  return <div key={d} title={`${day.toLocaleDateString()}: ${n} message${n === 1 ? "" : "s"}`} className={`aspect-square rounded-[3px] ${shade(n)}`} />;
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          {Object.keys(perModel).length === 0 && <p className="text-[13.5px] text-[var(--cl-muted)] py-4 text-center">No messages yet.</p>}
          {Object.entries(perModel)
            .sort((a, b) => b[1] - a[1])
            .map(([m, n]) => (
              <div key={m}>
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="text-[var(--cl-text)]">{names[m] || m}</span>
                  <span className="text-[var(--cl-muted)]">{n.toLocaleString()} message{n === 1 ? "" : "s"}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--cl-hover)] overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round((n / msgs.length) * 100)}%` }} />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
