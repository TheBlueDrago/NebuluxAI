import React, { useEffect, useState } from "react";
import { askConfirm, askText } from "@/lib/dialogs";
import { Building2, Loader2, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS = {
  new: { label: "New", cls: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  approved: { label: "Approved", cls: "bg-sky-500/20 text-sky-200 border-sky-400/40" },
  active: { label: "Active", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40" },
  rejected: { label: "Rejected", cls: "bg-red-600/20 text-red-200 border-red-500/40" },
};
const ORDER = { new: 0, approved: 1, active: 2, rejected: 3 };

// Monitor → Enterprise applications from the /enterprise page (functions/enterprise.js).
// Check the organization is real (the search links help), approve it, send the quote,
// and once they've paid, activate: their account gets Enterprise with that many seats.
export default function EnterpriseApps() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const call = async (body) => {
    setError("");
    try {
      const r = await base44.functions.invoke("enterprise", body);
      setApps(r.data?.applications || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not load Enterprise applications.");
      setApps((a) => a || []);
    }
  };

  useEffect(() => {
    call({ action: "list" });
  }, []);

  const act = async (a, body, confirmText) => {
    if (confirmText && !await askConfirm(confirmText)) return;
    setBusy(a.id);
    await call({ ...body, id: a.id });
    setBusy("");
  };

  const sorted = [...(apps || [])].sort((x, y) => ORDER[x.status] - ORDER[y.status] || String(y.updatedAt).localeCompare(String(x.updatedAt)));
  const waiting = (apps || []).filter((a) => a.status === "new").length;

  return (
    <div className="w-full max-w-3xl mt-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-white font-semibold text-sm">
          <Building2 className="w-4 h-4 text-violet-300" /> Enterprise applications
        </span>
        {waiting > 0 && <span className="text-[11px] bg-amber-500 text-slate-950 font-semibold rounded-full px-2 py-0.5">{waiting} waiting</span>}
      </div>
      {!apps && (
        <div className="flex justify-center py-6 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      )}
      {apps && apps.length === 0 && !error && <p className="mt-2 text-slate-500 text-sm">No applications yet. They come from the Enterprise page.</p>}
      <div className="mt-3 space-y-3">
        {sorted.map((a) => {
          const s = STATUS[a.status] || STATUS.new;
          const q = a.quote || {};
          const lookup = encodeURIComponent(`${a.orgName} ${a.region}`);
          return (
            <div key={a.id} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold">{a.orgName}</p>
                  <p className="text-xs text-slate-400">
                    {a.entityLabel} · {a.region} · #{a.regNumber}
                    {a.website && (
                      <>
                        {" · "}
                        <a href={/^https?:/i.test(a.website) ? a.website : `https://${a.website}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-200">
                          {a.website}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>{s.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {a.contactName} ({a.role}) · {a.workEmail}
                {a.phone ? ` · ${a.phone}` : ""} · account: {a.accountEmail}
              </p>
              {a.useCase && <p className="mt-1 text-xs text-slate-400">“{a.useCase}”</p>}
              <div className="mt-3 rounded-lg bg-slate-900/60 border border-slate-700/50 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <span className="text-slate-400">Seats <b className="block text-white text-base">{a.seats}</b></span>
                <span className="text-slate-400">
                  Quote <b className="block text-white text-base">${q.monthly}/month</b>
                  {q.discountPct > 0 && <span className="text-emerald-300">new-member {q.discountPct}% off (${q.pricePerSeat}/seat)</span>}
                </span>
                <span className="text-slate-400 col-span-2 sm:col-span-1">
                  Shared credits a month
                  <b className="block text-slate-200 font-medium">
                    {q.credits?.ai} AI · {q.credits?.aiCode} Code · {q.credits?.galaxy5} Galaxy · {q.credits?.space5} Space
                  </b>
                </span>
              </div>
              {a.warnings?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-amber-200">
                  {a.warnings.map((w) => (
                    <li key={w} className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {w}</li>
                  ))}
                </ul>
              )}
              {a.note && <p className="mt-2 text-xs text-slate-400">Note: {a.note}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <a
                  href={`https://opencorporates.com/companies?q=${encodeURIComponent(a.orgName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
                >
                  <Search className="w-3 h-3" /> Business registry
                </a>
                <a
                  href={`https://www.google.com/search?q=${lookup}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
                >
                  <ExternalLink className="w-3 h-3" /> Search the web
                </a>
                {a.status !== "approved" && a.status !== "active" && (
                  <button onClick={() => act(a, { action: "set-status", status: "approved" })} disabled={!!busy} className="px-2.5 py-1 rounded-lg bg-sky-600/80 text-white text-xs hover:bg-sky-500 disabled:opacity-50">
                    Approve
                  </button>
                )}
                {a.status === "approved" && (
                  <button
                    onClick={() => act(a, { action: "activate" }, `Turn on Enterprise with ${a.seats} seats for ${a.accountEmail}? Only do this once they've paid.`)}
                    disabled={!!busy}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/80 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Activate (after payment)
                  </button>
                )}
                {a.status !== "rejected" && a.status !== "active" && (
                  <button
                    onClick={async () => {
                      const note = await askText("Reason (optional, only you see it):");
                      if (note !== null) act(a, { action: "set-status", status: "rejected", note });
                    }}
                    disabled={!!busy}
                    className="px-2.5 py-1 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {busy === a.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Enterprise is $30 a seat a month, $25 from 10 seats and $20 from 25. To end or change it later, use Set membership on the person's account above.
      </p>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
