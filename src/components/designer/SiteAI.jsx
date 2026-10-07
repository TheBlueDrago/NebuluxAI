import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { showNotice } from "@/lib/dialogs";

// Dashboard → AI: let visitors of your published site chat with Nebulux AI (window.NebuluxAI on
// the page), paid from your prepaid API balance. Server: functions/.../site-ai.js, v1/site-chat.js.
const MODELS = [["nebulux-ai", "Nebulux AI · cheapest"], ["galaxy", "Galaxy · 2x"], ["space", "Space · 3x"], ["nebula", "Nebula · strongest, 5x"]];

export default function SiteAI({ site }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    base44.functions.invoke("site-ai", { site }).then((r) => setCfg(r.data)).catch((e) => setErr(e?.response?.data?.error || "Couldn't load this."));
  }, [site]);
  const save = async (patch) => {
    const next = { ...cfg, ...patch };
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("site-ai", { site, action: "set", on: next.on, model: next.model, instructions: next.instructions });
      setCfg(r.data);
      if (patch.on === true) showNotice("AI for visitors is on. Every answer is paid from your API balance.");
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!cfg) return err ? <p className="text-[13px] text-amber-300">{err}</p> : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;
  const b = cfg.billing || {};
  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="text-[19px] font-semibold text-white">AI for visitors</h2>
        <p className="text-[13px] text-slate-400 mt-0.5">Let people on your website chat with Nebulux AI. To add a chat box, ask the AI in the designer: "add an AI assistant to my site".</p>
      </div>
      {err && <p className="text-[13px] text-amber-300">{err}</p>}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-white">{cfg.on ? "On: visitors can use the AI" : "Off"}</p>
          <p className="text-[12.5px] text-slate-400 mt-0.5">You pay for every answer from your API balance ({b.balanceText || "$0.00"} left). When it runs out, the AI stops answering until you add more.</p>
        </div>
        <button role="switch" aria-checked={!!cfg.on} aria-label="AI for visitors" disabled={busy} onClick={() => save({ on: !cfg.on })} className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${cfg.on ? "bg-blue-500" : "bg-slate-700"}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${cfg.on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      {(!b.agreed || !b.useApi) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[13px] text-amber-200">
          Before it can answer: {!b.agreed && <>agree to API billing and add funds on the <a href="/api" target="_blank" rel="noopener" className="underline">Nebulux Platform <ExternalLink className="inline w-3 h-3" /></a>{!b.useApi && ", then "}</>}
          {!b.useApi && <>turn on <b>Settings → Usage → Use API key credits</b>.</>}
        </div>
      )}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 grid gap-3">
        <label className="text-[13px] text-slate-300">Model
          <select value={cfg.model} onChange={(e) => save({ model: e.target.value })} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13.5px] text-white outline-none">
            {MODELS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <label className="text-[13px] text-slate-300">Instructions for your assistant
          <textarea defaultValue={cfg.instructions} onBlur={(e) => e.target.value !== cfg.instructions && save({ instructions: e.target.value })} rows={3} maxLength={2000} placeholder="e.g. You help customers of Sunny Crumb Bakery with our menu, prices and opening hours." className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13.5px] text-white outline-none focus:border-indigo-500 resize-none" />
        </label>
        <p className="text-[11.5px] text-slate-500">Each visitor can send up to 8 messages a minute, and your site up to 300 an hour, so a spammer can't drain your balance quickly.</p>
      </div>
    </div>
  );
}
