import React, { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMonitorTick } from "@/lib/monitorTick";
import { OFFER_START, TRIAL_DAYS, DISCOUNT_HOURS } from "../../../cloudflare-lib/offers.js";

const DAY = 86400000;
// Base44 dates can lack a time zone; they're UTC.
const when = (d) => Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(d || "")) ? d : `${d}Z`);

// Monitor → Growth: sign-ups today, this week and this month, and a bar per day for the last
// 14 days, from the accounts Monitor already loaded (newest 200; `complete` is false when
// there are more).
export default function GrowthCard({ users, complete }) {
  const now = Date.now();
  // AI messages across all accounts (functions/monitor-activity.js): per-day counts, and the
  // start of each account's latest questions.
  const [activity, setActivity] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  const { slow } = useMonitorTick();
  useEffect(() => {
    base44.functions
      .invoke("monitor-activity", {})
      .then((r) => setActivity(r.data || null))
      .catch(() => setActivity((a) => a));
  }, [slow]);
  const emailOf = (id) => users.find((u) => u.id === id)?.email || "an account";
  const msgsOn = (from) => (activity?.days || {})[new Date(from + DAY / 2).toISOString().slice(0, 10)] || 0;
  const times = users.map((u) => when(u.created_date)).filter(Number.isFinite);
  const since = (days) => times.filter((t) => now - t < days * DAY).length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const from = startOfToday.getTime() - (13 - i) * DAY;
    const joined = users.filter((u) => {
      const t = when(u.created_date);
      return t >= from && t < from + DAY;
    });
    const said = (activity?.recent || []).filter((r) => {
      const t = Date.parse(r.at);
      return t >= from && t < from + DAY;
    });
    return { from, count: joined.length, joined, msgs: msgsOn(from), said };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  const maxMsgs = Math.max(1, ...days.map((d) => d.msgs));
  const msgsToday = days[days.length - 1].msgs;
  const msgsWeek = days.slice(-7).reduce((n, d) => n + d.msgs, 0);
  // New-member offer (cloudflare-lib/offers.js): who is on the free Pro week, and who is in the
  // new-member discount (from sign-up until 48 hours after the free week).
  const offerFrom = Date.parse(OFFER_START);
  const onTrial = times.filter((t) => t >= offerFrom && now < t + TRIAL_DAYS * DAY).length;
  const inWindow = times.filter((t) => t >= offerFrom && now < t + TRIAL_DAYS * DAY + DISCOUNT_HOURS * 3600000).length;
  const stats = [
    ["Today", times.filter((t) => t >= startOfToday.getTime()).length],
    ["Last 7 days", since(7)],
    ["Last 30 days", since(30)],
    ["All accounts", complete ? times.length : `${times.length}+`],
  ];

  return (
    <div className="w-full max-w-3xl mt-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <p className="flex items-center gap-2 text-white font-semibold text-sm">
        <TrendingUp className="w-4 h-4 text-emerald-300" /> Growth
      </p>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        On their free Pro week: <b className="text-white">{onTrial}</b> · With the new-member discount: <b className="text-white">{inWindow}</b>
      </p>
      <p className="mt-2 text-xs text-slate-400">
        AI messages today: <b className="text-white">{activity ? msgsToday : "…"}</b> · Last 7 days: <b className="text-white">{activity ? msgsWeek : "…"}</b>
      </p>
      <p className="mt-4 text-[11px] text-slate-400 flex items-center gap-3">
        <span>Last 14 days (point at or tap a day for details)</span>
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-fuchsia-400 inline-block" /> new accounts</span>
        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> AI messages</span>
      </p>
      <div className="relative mt-2 flex items-end gap-1 h-24" role="img" aria-label={`New accounts per day: ${days.map((d) => d.count).join(", ")}. AI messages per day: ${days.map((d) => d.msgs).join(", ")}`} onMouseLeave={() => setOpenDay(null)}>
        {days.map((d, i) => (
          <button
            type="button"
            key={d.from}
            onMouseEnter={() => setOpenDay(i)}
            onFocus={() => setOpenDay(i)}
            onClick={() => setOpenDay((o) => (o === i ? null : i))}
            aria-label={`${new Date(d.from).toLocaleDateString()}: ${d.count} new accounts, ${d.msgs} AI messages`}
            className={`flex-1 flex items-end justify-center gap-px h-full rounded ${openDay === i ? "bg-slate-700/40" : ""}`}
          >
            <div className="w-1/2 rounded-t bg-gradient-to-t from-indigo-500 to-fuchsia-400" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
            <div className="w-1/2 rounded-t bg-gradient-to-t from-sky-600 to-sky-400" style={{ height: `${Math.max(d.msgs ? 6 : 2, (d.msgs / maxMsgs) * 100)}%`, opacity: d.msgs ? 1 : 0.25 }} />
          </button>
        ))}
        {openDay !== null && (
          <div
            className={`absolute bottom-full mb-2 z-20 w-72 max-w-[85vw] max-h-72 overflow-y-auto rounded-xl bg-slate-950 border border-slate-700 shadow-2xl p-3 text-left ${openDay > 6 ? "right-0" : "left-0"}`}
            onMouseEnter={() => setOpenDay(openDay)}
          >
            <p className="text-xs font-semibold text-white">{new Date(days[openDay].from).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
            <p className="mt-2 text-[11px] text-fuchsia-300">New accounts ({days[openDay].count})</p>
            {days[openDay].joined.length ? (
              days[openDay].joined.map((u) => (
                <p key={u.id} className="text-[11px] text-slate-300 truncate">{u.email || u.full_name || u.id}</p>
              ))
            ) : (
              <p className="text-[11px] text-slate-500">None</p>
            )}
            <p className="mt-2 text-[11px] text-sky-300">AI messages ({days[openDay].msgs})</p>
            {days[openDay].said.length ? (
              days[openDay].said.slice(0, 30).map((r, k) => (
                <p key={k} className="text-[11px] text-slate-300 mt-1 break-words">
                  <span className="text-slate-500">{emailOf(r.userId)}:</span> {r.prompt || "(picture or empty)"}
                </p>
              ))
            ) : (
              <p className="text-[11px] text-slate-500">{days[openDay].msgs ? "Only each account's 5 latest questions are kept." : "None"}</p>
            )}
            {days[openDay].said.length > 0 && days[openDay].msgs > days[openDay].said.length && (
              <p className="mt-1 text-[10px] text-slate-500">Showing the latest questions kept for each account (up to 5 each).</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{new Date(days[0].from).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
