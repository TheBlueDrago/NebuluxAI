import React, { useEffect, useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMonitorTick } from "@/lib/monitorTick";

// Monitor → comments people reported on games and gallery creations (functions/reviews.js). A comment
// three people reported is already hidden; Delete removes it, Keep clears its reports and shows it again.
export default function ReportedComments() {
  const [list, setList] = useState(null);
  const { slow } = useMonitorTick();
  const call = (body) => base44.functions.invoke("reviews", body).then((r) => setList((r.data && r.data.comments) || [])).catch(() => setList((l) => l));
  useEffect(() => { call({ action: "reported" }); }, [slow]);
  if (!list || list.length === 0) return null;
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageSquareWarning className="w-4 h-4 text-amber-300" /> Reported comments ({list.length})
      </h2>
      <div className="mt-3 space-y-3">
        {list.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white break-words">{c.text}</p>
              <p className="text-[11px] text-slate-400 break-words">
                {c.name || "Player"} on the {c.kind} "{c.item}" · {c.reports} report{c.reports === 1 ? "" : "s"}
                {c.hidden ? " · hidden" : ""}
              </p>
            </div>
            <button onClick={() => call({ action: "keep", id: c.id })} className="shrink-0 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700">Keep</button>
            <button onClick={() => call({ action: "delete", id: c.id, admin: true })} className="shrink-0 rounded-lg border border-red-500/50 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
