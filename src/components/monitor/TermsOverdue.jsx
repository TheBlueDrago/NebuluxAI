import React, { useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Accounts that haven't accepted the monthly user agreement in 30 days (inactive). Listed here
// for an admin to review and delete with the usual account tools; nothing is deleted on its own.
export default function TermsOverdue({ onOpenUser }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shown, setShown] = useState(50); // long lists: 50 at a time
  const load = () => {
    setBusy(true);
    setErr("");
    base44.functions
      .invoke("accept-terms", { action: "overdue" })
      .then((r) => {
        setData(r.data);
        setShown(50);
      })
      .catch((e) => setErr(e?.response?.data?.error || "Couldn't load the list."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4">
      <div className="flex items-center gap-2">
        <FileWarning className="w-5 h-5 text-amber-300" />
        <h3 className="font-semibold text-white flex-1">Didn't accept the user agreement (30+ days)</h3>
        <button onClick={load} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {data ? "Check again" : "Check"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Everyone is asked to accept every month. Accounts on this list are inactive and can be deleted (open one to delete it). Nobody is listed until 30 days after the agreement started.</p>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      {data && (
        <div className="mt-3">
          <p className="text-sm text-slate-300">
            {data.users.length} of {data.checked} accounts
          </p>
          <ul className="mt-2 max-h-96 overflow-y-auto divide-y divide-slate-800 text-sm">
            {data.users.slice(0, shown).map((u) => (
              <li key={u.id} className="py-1.5 flex items-center gap-2">
                <button onClick={() => onOpenUser?.(u)} className="flex-1 min-w-0 text-left truncate text-slate-200 hover:text-white hover:underline">
                  {u.email || u.name || u.id}
                </button>
                <span className="text-xs text-slate-500 shrink-0">{u.lastAccepted ? `last accepted ${u.lastAccepted.slice(0, 10)}` : "never accepted"}</span>
              </li>
            ))}
          </ul>
          {data.users.length > shown && (
            <button onClick={() => setShown((n) => n + 50)} className="mt-2 w-full rounded-lg bg-slate-800 border border-slate-700 py-2 text-xs text-slate-200 hover:bg-slate-700">
              Show me the rest of the accounts ({data.users.length - shown} more)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
