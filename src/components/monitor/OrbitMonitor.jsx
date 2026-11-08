import React, { useEffect, useState } from "react";
import { Orbit, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMonitorTick } from "@/lib/monitorTick";

const ORBIT = "https://nebuluxorbit.thebluedragonstriker.workers.dev/";
const AI_NAMES = { galaxy: "Galaxy", space: "Space", nebula: "Nebula", gemini: "Gemini", "workers-ai": "Workers AI (free backup)" };
const whenText = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const credits = (n) => (Math.round(n * 10) / 10).toString();

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hr ago`;
  return `${Math.round(m / 1440)} days ago`;
}

// Monitor → Nebulux Orbit: everyone using Orbit, their session credits and what they've connected
// (functions/monitor-orbit.js). Orbit's own Monitor has the buttons that change things.
export default function OrbitMonitor({ users }) {
  const { live } = useMonitorTick();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    base44.functions
      .invoke("monitor-orbit", {})
      .then((r) => {
        setData(r.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [live]);
  if (failed && !data) return <p className="w-full max-w-3xl mt-6 text-sm text-slate-400">Couldn't load Nebulux Orbit.</p>;
  if (!data) return null;
  const t = data.totals;
  const stats = [
    ["People", t.people],
    ["In a session now", t.activeNow],
    ["Signed-in devices", t.devices],
    ["Credits used now", credits(t.creditsNow)],
  ];
  const emailOf = (id) => (users.find((u) => u.id === id) || {}).email || "";
  const needle = q.trim().toLowerCase();
  const found = data.people.filter((p) => !needle || p.name.toLowerCase().includes(needle) || emailOf(p.id).toLowerCase().includes(needle));
  const shown = showAll || needle ? found : found.slice(0, 8);
  const aiBad = data.nebula && data.nebula.v !== "ok";
  const apps = Object.entries(data.apps);
  return (
    <div className="w-full max-w-3xl mt-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-white font-semibold text-sm">
          <Orbit className="w-4 h-4 text-sky-300" /> Nebulux Orbit
        </p>
        <a href={ORBIT} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
          Open Orbit <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2">
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Accepted terms: <b className="text-white">{t.accepted}</b> · Declined: <b className="text-white">{t.declined}</b> · Under 13: <b className="text-white">{t.under13}</b> · Last answer by:{" "}
        <b className="text-white">{data.answered ? `${AI_NAMES[data.answered.v] || data.answered.v}, ${whenText(data.answered.at)}` : "no answers yet"}</b>
      </p>
      {aiBad && (
        <p className="mt-2 flex items-start gap-2 text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{data.nebula.v === "no key" ? "Orbit's Nebulux AI key isn't set" : `Nebulux AI isn't answering Orbit: ${data.nebula.v}`} ({whenText(data.nebula.at)}). Orbit is using Workers AI.</span>
        </p>
      )}
      {apps.length > 0 && <p className="mt-2 text-xs text-slate-400">Connected apps: {apps.map(([k, n]) => `${k} (${n})`).join(", ")}</p>}
      {data.people.length > 8 && (
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input aria-label="Search Orbit people by name or email" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none" />
        </div>
      )}
      {found.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{needle ? "Nobody matches that." : "Nobody has used Orbit yet."}</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-800">
          {shown.map((p) => (
            <div key={p.id} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-white truncate">{p.name || emailOf(p.id) || "Signed out"}</p>
                <p className="text-xs text-slate-400 shrink-0">{p.resetAt ? `${credits(p.used)} of ${p.limit || data.sessionLimit} credits` : "No session running"}</p>
              </div>
              <p className="text-xs text-slate-400 break-words">
                {emailOf(p.id) && p.name ? `${emailOf(p.id)} · ` : ""}
                {p.plan && p.plan !== "free" ? `${p.plan} plan · ` : ""}{p.lastSignIn ? `signed in ${ago(p.lastSignIn)}` : "not signed in"} · terms {p.terms}
                {p.termsVersion ? ` (${p.termsVersion})` : ""} · age {p.age}
                {p.apps.length ? ` · ${p.apps.join(", ")}` : ""}
              </p>
              {p.resetAt > 0 && (
                <div className="mt-1 h-1 rounded bg-slate-800 overflow-hidden">
                  <div className="h-full bg-sky-400" style={{ width: `${Math.max(1, Math.min(100, (p.used / (p.limit || data.sessionLimit)) * 100))}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!needle && data.people.length > 8 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm text-slate-400 hover:text-slate-200">
          {showAll ? "Show fewer" : `Show all ${data.people.length}`}
        </button>
      )}
      <p className="mt-3 text-[11px] text-slate-500">To sign someone out, reset a session or unblock someone: Orbit, Settings, Monitor.</p>
    </div>
  );
}
