import React, { useEffect, useState } from "react";
import { Globe, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Monitor → Nebulux Sites orders (functions/site-orders.js). New ones from the last day are marked New.
const ADMIN = "https://nebuluxsites.thebluedragonstriker.workers.dev/admin.html";

export default function SiteOrders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    base44.functions.invoke("site-orders", {}).then((r) => setOrders(r.data?.orders || [])).catch(() => setOrders([]));
  }, []);
  if (orders === null) return null;
  const fresh = (o) => Date.now() - new Date(o.created_at) < 86400000;
  const newCount = orders.filter(fresh).length;
  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-white font-semibold">
          <Globe className="w-4 h-4 text-fuchsia-300" /> Nebulux Sites orders <span className="text-xs font-normal text-slate-400">· {orders.length}</span>
          {newCount > 0 && <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-200">{newCount} new</span>}
        </p>
        <a href={ADMIN} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">Manage <ExternalLink className="w-3.5 h-3.5" /></a>
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400">No website orders yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="py-2">
              <div className="flex items-center gap-2">
                {fresh(o) && <span className="h-2 w-2 rounded-full bg-fuchsia-400" />}
                <span className="font-medium text-slate-100">{o.id}</span>
                <span className="text-slate-300">{o.package}{o.price ? ` · $${o.price}` : " · quote"}</span>
                <span className="ml-auto text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 truncate">{o.name} · {o.email}{o.kind ? ` · ${o.kind}` : ""}</p>
              <p className="text-xs text-slate-500 line-clamp-2">{o.details}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
