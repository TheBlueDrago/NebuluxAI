import React, { useEffect, useState } from "react";
import { ScrollText, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TIER = { ai: "Nebulux AI", aiCode: "Galaxy", galaxy5: "Space", space5: "Nebula" };

// One line for each kind of admin action (cloudflare-lib/audit.js).
function describe({ what, details: d = {} }) {
  const who = d.email || d.userId || "";
  switch (what) {
    case "grant": {
      const parts = [];
      if ("plan" in d) parts.push(`plan → ${d.plan || "none"}${d.planExpiresAt ? ` until ${new Date(d.planExpiresAt).toLocaleDateString()}` : ""}`);
      if ("banned" in d) parts.push(d.banned ? "banned" : "unbanned");
      if ("blockedUntil" in d) parts.push(d.blockedUntil ? `blocked until ${new Date(d.blockedUntil).toLocaleString()}` : "unblocked");
      if ("seats" in d) parts.push(`${d.seats} seats`);
      if ("bonus" in d) parts.push("bonus credits set");
      return `Account ${who}: ${parts.join(", ") || "updated"}`;
    }
    case "credits":
      return `${d.delta > 0 ? "Gave" : "Took"} ${Math.abs(d.delta)} ${TIER[d.tier] || d.tier} credits ${d.delta > 0 ? "to" : "from"} ${who}`;
    case "referral-revoke":
      return `Revoked a referral reward from ${who}`;
    case "promo-create":
    case "promo-update":
      return `${what === "promo-create" ? "Created" : "Changed"} promo code ${d.code}: ${
        d.pct ? `${d.pct}% off ${d.target}${d.maxUses ? `, ${d.maxUses} uses` : ""}` : `${d.credits} ${TIER[d.aiModel] || d.aiModel} credits`
      }${d.active === false ? " (inactive)" : ""}`;
    case "promo-delete":
      return `Deleted promo code ${d.code}`;
    case "take-down":
      return `Took down ${d.kind} "${d.name}"`;
    case "take-down-all":
      return `Took down all ${d.count} page${d.count === 1 ? "" : "s"} of ${d.userId}`;
    case "restore":
      return `Put back ${d.kind} "${d.name}"`;
    case "enterprise-status":
      return `Enterprise application ${d.id}: ${d.status}`;
    case "enterprise-activate":
      return `Activated Enterprise for ${who} (${d.seats} seats)`;
    default:
      return what;
  }
}

// Monitor → Admin log: who changed plans, credits, bans, promo codes or take-downs, and when.
// Anything here you don't recognise means an admin account may be in the wrong hands.
export default function AdminLog() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setError("");
    try {
      const r = await base44.functions.invoke("admin-log", {});
      setEntries(r.data?.entries || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not load the admin log.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shown = entries ? (showAll ? entries : entries.slice(0, 10)) : [];
  return (
    <div className="w-full max-w-3xl mt-10">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-slate-300 text-sm font-medium inline-flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-amber-300" /> Admin log
        </p>
        <button onClick={load} className="ml-auto text-slate-400 hover:text-white" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        Every change to plans, credits, bans, promo codes and take-downs. If you see something you didn't do, change your password right away.
      </p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!entries ? (
        !error && <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      ) : entries.length === 0 ? (
        <p className="text-slate-500 text-sm">Nothing yet.</p>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl divide-y divide-slate-700/50">
          {shown.map((e, i) => (
            <div key={`${e.at}-${i}`} className="px-3 py-2 text-sm">
              <p className="text-slate-200 break-words">{describe(e)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 break-all">
                {new Date(e.at).toLocaleString()} · by {e.by}
                {e.from ? ` · from ${e.from}` : ""}
              </p>
            </div>
          ))}
          {entries.length > 10 && (
            <button onClick={() => setShowAll((s) => !s)} className="w-full px-3 py-2 text-xs text-sky-300 hover:text-sky-200 text-left">
              {showAll ? "Show fewer" : `Show all ${entries.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
