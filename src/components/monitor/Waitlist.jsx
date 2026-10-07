import React, { useEffect, useState } from "react";
import { Download, Mail, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Monitor → Waitlist: emails left on the maintenance page (cloudflare-lib/waitlist.js), to tell
// people when Nebulux AI opens. Download gives a CSV for any email tool.
export default function Waitlist() {
  const [people, setPeople] = useState(null);
  const [all, setAll] = useState(false);
  const call = (body) => base44.functions.invoke("waitlist", body).then((r) => setPeople(r.data?.people || [])).catch(() => setPeople((p) => p || []));
  useEffect(() => {
    call({ action: "list" });
  }, []);
  if (people === null) return null;
  const download = () => {
    const csv = "email,joined\n" + people.map((p) => `${p.email},${p.joined_at}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "nebulux-waitlist.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const shown = all ? people : people.slice(0, 8);
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-white font-semibold">
          <Mail className="w-4 h-4 text-emerald-300" /> Waitlist <span className="text-xs font-normal text-slate-400">· {people.length}</span>
        </p>
        {people.length > 0 && (
          <button onClick={download} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"><Download className="w-3.5 h-3.5" /> Download CSV</button>
        )}
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-slate-400">Nobody yet. Visitors can leave their email on the maintenance page.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-800 text-sm">
            {shown.map((p) => (
              <li key={p.email} className="flex items-center gap-2 py-1.5">
                <span className="truncate flex-1 text-slate-200">{p.email}</span>
                <span className="text-xs text-slate-500">{new Date(p.joined_at).toLocaleDateString()}</span>
                <button onClick={() => call({ action: "remove", email: p.email })} title="Remove" className="p-1 text-slate-500 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
              </li>
            ))}
          </ul>
          {people.length > 8 && <button onClick={() => setAll(!all)} className="mt-2 text-xs text-slate-400 hover:text-white">{all ? "Show less" : `Show all ${people.length}`}</button>}
        </>
      )}
    </div>
  );
}
