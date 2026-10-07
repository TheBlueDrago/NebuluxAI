import React, { useEffect, useState } from "react";
import { Bug, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Monitor → Errors: crashes in people's browsers, the server code and the site router
// (cloudflare-lib/errorlog.js). The same error is one row with a count. "Fixed" removes it;
// if it happens again it comes back.
const KIND = { client: ["Browser", "bg-sky-500/15 text-sky-300"], server: ["Server", "bg-amber-500/15 text-amber-300"], router: ["Router", "bg-red-500/15 text-red-300"] };
const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

export default function ErrorReports() {
  const [errors, setErrors] = useState(null);
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState("");
  const call = (body, tag) => {
    setBusy(tag || "");
    return base44.functions
      .invoke("client-error", body)
      .then((r) => setErrors(r.data?.errors || []))
      .catch(() => setErrors((e) => e || []))
      .finally(() => setBusy(""));
  };
  useEffect(() => {
    call({ action: "list" });
  }, []);
  if (errors === null) return null;
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-white font-semibold">
          <Bug className="w-4 h-4 text-red-300" /> Errors {errors.length > 0 && <span className="text-xs font-normal text-slate-400">· {errors.length}</span>}
        </p>
        {errors.length > 0 && (
          <button onClick={() => call({ action: "clear" }, "all")} disabled={!!busy} className="text-xs text-slate-400 hover:text-white">
            {busy === "all" ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Mark all fixed"}
          </button>
        )}
      </div>
      {errors.length === 0 ? (
        <p className="text-sm text-slate-400">No errors. When something crashes for someone, it shows up here.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {errors.map((e) => {
            const [label, cls] = KIND[e.kind] || [e.kind, "bg-slate-700 text-slate-300"];
            const isOpen = open === e.sig;
            return (
              <li key={e.sig} className="py-2">
                <div className="flex items-start gap-2">
                  <button onClick={() => setOpen(isOpen ? "" : e.sig)} className="mt-0.5 text-slate-400" aria-label={isOpen ? "Hide details" : "Show details"}>
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-100 break-words">{e.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                      <span className={`rounded px-1.5 ${cls}`}>{label}</span>
                      <span>{e.count}×</span>
                      <span>last {ago(e.last_at)}</span>
                      {e.path && <span className="truncate max-w-[14rem]">{e.path}</span>}
                    </p>
                  </div>
                  <button onClick={() => call({ action: "clear", sig: e.sig }, e.sig)} disabled={!!busy} title="Mark fixed" className="p-1 rounded text-slate-400 hover:text-emerald-300">
                    {busy === e.sig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-2 ml-6 text-xs text-slate-400 space-y-1">
                    <p>First seen {new Date(e.first_at).toLocaleString()} · {e.user_id ? `account ${e.user_id}` : "not signed in"}</p>
                    {e.ua && <p className="break-words">{e.ua}</p>}
                    {e.stack && <pre className="whitespace-pre-wrap break-words bg-slate-950/60 rounded p-2 max-h-48 overflow-auto">{e.stack}</pre>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
