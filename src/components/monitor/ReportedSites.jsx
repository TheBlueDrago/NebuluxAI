import React, { useEffect, useState } from "react";
import { askConfirm } from "@/lib/dialogs";
import { Flag, Loader2, EyeOff, Eye, Check, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { siteUrl } from "@/lib/blackholeDomain";

const pageUrl = (p) =>
  p.kind === "site" ? siteUrl(p.name) || "#" : `/chat/game/${encodeURIComponent(p.name)}`;

// Monitor → pages visitors reported (from the Report link on published sites), with
// one-click take-down. Hidden pages show a "removed" notice and their owner can't
// re-publish them; see cloudflare-lib/reports.js and the admin-reports function.
export default function ReportedSites() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const [manual, setManual] = useState({ kind: "site", name: "" });

  const call = async (body, key) => {
    setBusy(key || "load");
    setError("");
    try {
      const r = await base44.functions.invoke("admin-reports", body);
      if (r.data?.error) throw new Error(r.data.error);
      setData({ reports: r.data?.reports || [], hidden: r.data?.hidden || [] });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not load reports.");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    call({ action: "list" });
  }, []);

  const act = async (action, p) => {
    const ask = {
      hide: `Take ${p.name} offline? Visitors will see "removed" and its owner can't publish it again (you can undo this).`,
      dismiss: `Clear the reports for ${p.name} and leave it online?`,
    }[action];
    if (ask && !await askConfirm(ask)) return;
    call({ action, kind: p.kind, name: p.name }, `${action}:${p.kind}:${p.name}`);
  };

  const btn = "inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border disabled:opacity-50";

  return (
    <div className="w-full max-w-3xl mt-10">
      <p className="text-slate-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
        <Flag className="w-4 h-4 text-red-400" /> Reported sites
        {data && data.reports.length > 0 && (
          <span className="text-[11px] bg-red-500/20 text-red-300 rounded-full px-2 py-0.5">{data.reports.length}</span>
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = manual.name.trim().toLowerCase().replace(/\.nebuluxai\.com.*$/, "").replace(/^https?:\/\//, "");
          if (name) act("hide", { kind: manual.kind, name });
        }}
        className="flex flex-wrap items-center gap-2 mb-3"
      >
        <select
          value={manual.kind}
          onChange={(e) => setManual((m) => ({ ...m, kind: e.target.value }))}
          aria-label="Site or game"
          className="bg-slate-800/70 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="site">Site</option>
          <option value="game">Game</option>
        </select>
        <input
          value={manual.name}
          onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
          placeholder="Name to take down (e.g. nova)"
          aria-label="Name to take down"
          className="flex-1 min-w-[140px] bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none"
        />
        <button type="submit" disabled={!!busy || !manual.name.trim()} className={`${btn} border-red-500/50 text-red-300`}>
          <EyeOff className="w-3 h-3" /> Take down
        </button>
      </form>
      {!data ? (
        error ? <p className="text-red-400 text-sm">{error}</p> : <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      ) : (
        <div className="space-y-2">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {data.reports.length === 0 && <p className="text-slate-500 text-sm">No open reports.</p>}
          {data.reports.map((p) => {
            const id = `${p.kind}:${p.name}`;
            return (
              <div key={id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={pageUrl(p)} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium inline-flex items-center gap-1 hover:underline break-all">
                    {p.name} <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <span className="text-[11px] text-slate-500">{p.kind} · {p.count} report{p.count === 1 ? "" : "s"}</span>
                  <div className="ml-auto flex gap-1.5">
                    <button disabled={!!busy} onClick={() => setOpen(open === id ? null : id)} className={`${btn} border-slate-600 text-slate-300`}>
                      {open === id ? "Hide details" : "Details"}
                    </button>
                    <button disabled={!!busy} onClick={() => act("dismiss", p)} className={`${btn} border-slate-600 text-slate-300`}>
                      <Check className="w-3 h-3" /> Dismiss
                    </button>
                    <button disabled={!!busy} onClick={() => act("hide", p)} className={`${btn} border-red-500/50 text-red-300`}>
                      {busy === `hide:${id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />} Hide site
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {[...new Set(p.reports.map((r) => r.label))].join(" · ")}
                </p>
                {open === id && (
                  <ul className="mt-2 space-y-1">
                    {p.reports.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300">
                        <span className="text-slate-500">{new Date(r.at).toLocaleString()} —</span> {r.label}
                        {r.details && <span className="text-slate-400">: “{r.details}”</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {data.hidden.length > 0 && (
            <>
              <p className="text-slate-400 text-xs font-medium pt-3">Taken down</p>
              {data.hidden.map((p) => (
                <div key={`${p.kind}:${p.name}`} className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="text-slate-300 text-sm break-all">{p.name}</span>
                  <span className="text-[11px] text-slate-500">{p.kind}</span>
                  <button disabled={!!busy} onClick={() => act("unhide", p)} className={`${btn} ml-auto border-slate-600 text-slate-300`}>
                    <Eye className="w-3 h-3" /> Put back online
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
