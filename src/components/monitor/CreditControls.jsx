import React, { useEffect, useState } from "react";
import { askConfirm } from "@/lib/dialogs";
import { Loader2, Plus, Minus, Undo2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const LABELS = { ai: "Nebulux AI", aiCode: "Galaxy", galaxy5: "Space", space5: "Nebula" };

// Monitor → user detail: the user's live (server-side) credits for every AI, buttons to
// add or remove credits, and the people they referred (with a way to take one back).
export default function CreditControls({ userId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [amounts, setAmounts] = useState({ ai: 10, aiCode: 10, galaxy5: 10, space5: 10 });
  const [busy, setBusy] = useState("");

  const call = async (body, key) => {
    setBusy(key || "load");
    setError("");
    try {
      const r = await base44.functions.invoke("admin-credits", { userId, ...body });
      setData(r.data);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not update credits.");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    call({ action: "get" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Big changes are confirmed first, so an extra zero typed by mistake doesn't go through.
  const adjust = async (tier, sign) => {
    const n = Number(amounts[tier]) || 0;
    if (n >= 100 && !await askConfirm(`${sign > 0 ? "Add" : "Remove"} ${n} ${LABELS[tier]} credits ${sign > 0 ? "to" : "from"} this account?`)) return;
    call({ action: "adjust", tier, delta: sign * n }, `${tier}${sign}`);
  };
  const revoke = async (referredId) => {
    if (await askConfirm("Take this referral back? Both rewards — this user's and their friend's welcome bonus — will be removed.")) call({ action: "revoke", referredId }, referredId);
  };

  if (!data) {
    return error ? (
      <p className="text-red-400 text-sm mt-5">{error}</p>
    ) : (
      <div className="flex justify-center py-6 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
    );
  }

  const fmt = (n) => (n > 1e9 ? "∞" : n);
  // Referrals that signed up from the same network (IP) as another of this user's
  // referrals — a sign of one person making several "friends".
  const netCount = {};
  for (const r of data.referrals) if (r.net) netCount[r.net] = (netCount[r.net] || 0) + 1;
  const suspicious = data.referrals.filter((r) => r.net && netCount[r.net] > 1).length;

  return (
    <>
      <p className="text-slate-300 text-sm font-medium mt-5 mb-2">
        Credits <span className="text-slate-500 font-normal capitalize">· {data.credits.plan} plan</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.keys(LABELS).map((k) => {
          const c = data.credits.tiers[k];
          return (
            <div key={k} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
              <p className="text-[11px] text-slate-400">{LABELS[k]}</p>
              <p className="text-white text-sm font-semibold">{fmt(c.remaining)} left</p>
              <p className="text-[11px] text-slate-500">{c.used} used of {fmt(c.total)}</p>
              <div className="flex items-center gap-1 mt-2">
                <input
                  type="number"
                  min={1}
                  value={amounts[k]}
                  aria-label={`${LABELS[k]} credits to add or remove`}
                  onChange={(e) => setAmounts((a) => ({ ...a, [k]: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-16 bg-slate-900 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-white outline-none"
                />
                <button
                  onClick={() => adjust(k, 1)}
                  disabled={!!busy}
                  title="Give credits"
                  className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-600/90 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === `${k}1` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                </button>
                <button
                  onClick={() => adjust(k, -1)}
                  disabled={!!busy}
                  title="Take credits away"
                  className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500 disabled:opacity-50"
                >
                  {busy === `${k}-1` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />} Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">
        Added credits work for that AI even without a plan. Removing only takes away extra (bonus) credits, not the plan's monthly allowance.
      </p>

      <p className="text-slate-300 text-sm font-medium mt-5 mb-2">
        Referrals {data.referrals.length ? `(${data.referrals.filter((r) => !r.revoked).length})` : ""}
      </p>
      {suspicious > 0 && (
        <p className="text-[11px] text-amber-300 mb-2">
          {suspicious} of these signed up from a network shared with another referral. That can mean one person made several accounts — check before leaving the rewards.
        </p>
      )}
      {data.referrals.length ? (
        <div className="space-y-2">
          {data.referrals.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-slate-100 text-sm truncate">{r.name}</p>
                {r.net && netCount[r.net] > 1 && (
                  <p className="text-[11px] text-amber-300">Same network as {netCount[r.net] - 1} other referral{netCount[r.net] > 2 ? "s" : ""}</p>
                )}
                <p className="text-[11px] text-slate-500">
                  {new Date(r.at).toLocaleDateString()} ·{" "}
                  {r.revoked ? "taken back" : r.reward ? `+${r.reward.amount} ${LABELS[r.reward.tier]}` : "reward not claimed yet"}
                </p>
              </div>
              {!r.revoked && (
                <button
                  onClick={() => revoke(r.id)}
                  disabled={!!busy}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700 text-red-300 text-xs hover:bg-slate-600 disabled:opacity-50 shrink-0"
                >
                  {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Take back
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm">No referrals yet.</p>
      )}
      {data.referredBy && <p className="text-[11px] text-slate-500 mt-2">This user joined through someone else's invite link.</p>}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </>
  );
}
