import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Monitor → AI health: replies that worked vs. hit "busy" or failed, per day, from the free
// Gemini tier (functions/.../ai-health.js). Lots of "busy" means the free limits are being
// reached: add another free API key (GEMINI_API_KEY_2..4) or expect slower answers.
export default function AiHealth() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    base44.functions.invoke("ai-health", {}).then((r) => setData(r.data)).catch(() => setErr("Couldn't load AI health."));
  }, []);
  if (err) return <p className="w-full max-w-3xl mt-6 text-sm text-slate-400">{err}</p>;
  if (!data) return null;
  const days = data.days || [];
  const total = days.reduce((a, d) => a + d.ok + d.busy + d.fail, 0);
  const busy = days.reduce((a, d) => a + d.busy, 0);
  const fail = days.reduce((a, d) => a + d.fail, 0);
  const rate = total ? Math.round(((busy + fail) / total) * 100) : 0;
  const max = Math.max(1, ...days.map((d) => d.ok + d.busy + d.fail));
  const models = {};
  for (const d of days) for (const [m, n] of Object.entries(d.models || {})) models[m] = (models[m] || 0) + n;
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-white font-semibold"><Activity className="w-4 h-4 text-indigo-300" /> AI health · last 14 days</p>
        <span className="text-xs text-slate-400">{data.keys} free API key{data.keys === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="rounded-lg bg-slate-800/60 p-2"><p className="text-xs text-slate-400">Replies</p><p className="text-lg font-semibold text-white">{total.toLocaleString()}</p></div>
        <div className="rounded-lg bg-slate-800/60 p-2"><p className="text-xs text-slate-400">Busy</p><p className="text-lg font-semibold text-amber-300">{busy.toLocaleString()}</p></div>
        <div className="rounded-lg bg-slate-800/60 p-2"><p className="text-xs text-slate-400">Failed</p><p className="text-lg font-semibold text-red-300">{fail.toLocaleString()}</p></div>
      </div>
      {total === 0 ? (
        <p className="text-sm text-slate-400">No AI replies counted yet (counting started 2026-10-06).</p>
      ) : (
        <div className="flex items-end gap-1 h-24" aria-label="Replies per day">
          {days.map((d) => {
            const all = d.ok + d.busy + d.fail;
            return (
              <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.ok} ok, ${d.busy} busy, ${d.fail} failed`}>
                <div className="bg-red-400/80" style={{ height: `${(d.fail / max) * 100}%` }} />
                <div className="bg-amber-400/80" style={{ height: `${(d.busy / max) * 100}%` }} />
                <div className="bg-indigo-400/80 rounded-t-sm" style={{ height: `${(d.ok / max) * 100}%` }} />
                <span className="sr-only">{d.day}: {all} replies</span>
              </div>
            );
          })}
        </div>
      )}
      {rate >= 10 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {rate}% of replies hit a limit. Adding another free Gemini API key (GEMINI_API_KEY_2 to _4 in Cloudflare) spreads the load.
        </p>
      )}
      {Object.keys(models).length > 0 && (
        <p className="mt-3 text-xs text-slate-400">Answered by: {Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`).join(", ")}</p>
      )}
    </div>
  );
}
