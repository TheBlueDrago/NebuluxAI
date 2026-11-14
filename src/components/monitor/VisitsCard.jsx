import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMonitorTick } from "@/lib/monitorTick";

const SITE_NAMES = { ai: "Nebulux AI", orbit: "Nebulux Orbit" };

// Monitor → Visitors: how many people visit, which pages and games are used most, and where people stop
// (functions/visit.js). Counts only: nothing here is about one person.
export default function VisitsCard() {
  const [data, setData] = useState(null);
  const [plays, setPlays] = useState(null);
  const [site, setSite] = useState("ai");
  const { slow } = useMonitorTick();
  useEffect(() => {
    base44.functions.invoke("visit", { action: "stats" }).then((r) => setData(r.data || null)).catch(() => setData((d) => d));
  }, [slow]);
  useEffect(() => {
    base44.functions.invoke("game-plays").then((r) => setPlays((r.data && r.data.totals) || {})).catch(() => setPlays({}));
  }, []);
  if (!data || !data[site]) return null;
  const s = data[site];
  const today = s.days[s.days.length - 1] || { views: 0, visitors: 0 };
  const week = s.days.slice(-7).reduce((a, d) => a + d.visitors, 0);
  const all = s.days.reduce((a, d) => a + d.visitors, 0);
  const max = Math.max(1, ...s.days.map((d) => d.visitors));
  const topGames = Object.entries(plays || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const first = (s.funnel[0] && s.funnel[0].n) || 0;
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="w-4 h-4 text-sky-300" /> Visitors
        </h2>
        <div className="flex gap-1" role="group" aria-label="Which site">
          {Object.keys(SITE_NAMES).map((k) => (
            <button key={k} onClick={() => setSite(k)} aria-pressed={site === k} className={`px-2.5 py-1 rounded-lg text-xs ${site === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              {SITE_NAMES[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[["Today", today.visitors], ["Last 7 days", week], ["Last 14 days", all]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-1 h-16" aria-label="Visitors a day, last 14 days">
        {s.days.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.visitors} visitors, ${d.views} pages opened`} className="flex-1 rounded-t bg-sky-400/70" style={{ height: `${Math.max(3, (d.visitors / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-1">Most opened pages</p>
          {s.pages.length === 0 && <p className="text-xs text-slate-500">No visits counted yet.</p>}
          {s.pages.slice(0, 8).map((p) => (
            <p key={p.path} className="flex justify-between gap-3 text-xs text-slate-400">
              <span className="truncate">{p.path}</span>
              <b className="text-white">{p.views}</b>
            </p>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-1">Where people stop</p>
          {s.funnel.map((f, i) => (
            <div key={f.label} className="mb-1">
              <p className="flex justify-between gap-3 text-xs text-slate-400">
                <span>{f.label}</span>
                <span>
                  <b className="text-white">{f.n}</b>
                  {i > 0 && first > 0 ? ` (${Math.round((f.n / first) * 100)}%)` : ""}
                </span>
              </p>
              <div className="h-1 rounded bg-slate-800 overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${first > 0 ? Math.max(1, Math.min(100, (f.n / first) * 100)) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {site === "ai" && topGames.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-300 mb-1">Most played games (all time)</p>
          <p className="text-xs text-slate-400">{topGames.map(([name, n]) => `${name} (${n})`).join(", ")}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">Counts only. No cookies, no internet addresses, nothing about one person. Browsers asking not to be tracked aren't counted.</p>
    </div>
  );
}
