import React, { useEffect, useState } from "react";
import { Server, Copy, Check } from "lucide-react";
import { useMonitorTick } from "@/lib/monitorTick";
import { checkGameServer, watchLiveGames } from "@/lib/liveGames";

// Monitor → Game server: the live server behind real players in Nebula Royale, Nebula Brawl and the Arcade
// (nebula-royale/server, a Cloudflare Worker). Shows if it's up, if it has the latest deploy, and who is playing now.
const DEPLOY = "cd C:\bhai\nebula-royale\server; node C:\NebuluxSites\node_modules\wrangler\bin\wrangler.js deploy";
const nice = (k) => k.replace(/^nebula/, "Nebula ").replace(/(royale|brawl)$/, (m) => " " + m[0].toUpperCase() + m.slice(1)).replace(/\s+/g, " ").trim();

export default function GameServer() {
  const [st, setSt] = useState(null);
  const [live, setLive] = useState({});
  const [names, setNames] = useState({});
  const [copied, setCopied] = useState(false);
  const { live: tick } = useMonitorTick();
  useEffect(() => { let on = true; checkGameServer().then((r) => on && setSt(r)); return () => { on = false; }; }, [tick]);
  useEffect(() => watchLiveGames((c, n) => { setLive(c); setNames(n || {}); }), []);
  const rows = Object.entries(live).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0);
  const copy = () => { navigator.clipboard?.writeText(DEPLOY).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => {}); };
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-white font-semibold"><Server className="w-4 h-4 text-emerald-300" /> Game server · real players</p>
        <span className={`text-xs font-semibold ${!st ? "text-slate-400" : st.up ? "text-emerald-300" : "text-rose-300"}`}>{!st ? "Checking..." : st.up ? "Online" : "Can't be reached"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
        <div className="rounded-lg bg-slate-800/60 p-2"><p className="text-xs text-slate-400">Playing right now</p><p className="text-lg font-semibold text-white">{total.toLocaleString()}</p></div>
        <div className="rounded-lg bg-slate-800/60 p-2"><p className="text-xs text-slate-400">Version</p><p className={`text-lg font-semibold ${st && st.latest ? "text-emerald-300" : "text-amber-300"}`}>{!st || st.latest == null ? "-" : st.latest ? "Up to date" : "Needs a deploy"}</p></div>
      </div>
      {st && st.up && st.latest === false && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p>The server is running an older version: the account wipe and Nebula Brawl's online saves start after you deploy it. In PowerShell:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded bg-slate-950/70 px-2 py-1 text-xs text-slate-200">{DEPLOY}</code>
            <button onClick={copy} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
      {rows.length ? (
        <ul className="space-y-1 text-sm">{rows.slice(0, 10).map(([k, n]) => <li key={k} className="flex justify-between text-slate-300"><span>{names[k] || nice(k)}</span><span className="text-white font-medium">{n}</span></li>)}</ul>
      ) : <p className="text-sm text-slate-400">Nobody is playing right now.</p>}
    </div>
  );
}
