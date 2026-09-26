import React, { useEffect, useState } from "react";
import { ArrowLeft, Gift, Copy, Check, Share2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppShell } from "@/components/AppShellContext";
import RewardPicker, { REWARD_INFO, REWARD_LABEL as LABEL } from "@/components/profile/RewardPicker";
import { clearWelcomePending } from "@/lib/referral";

// Account → Refer friends: the user's invite link, and one reward to pick for every
// friend who signs up with it (credits for any AI — no plan needed to use them).
export default function ReferFriends({ onBack }) {
  const shell = useAppShell();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    base44.functions
      .invoke("referrals", { action: "get" })
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error || "Could not load your referral link."));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  const share = () => navigator.share?.({ title: "Nebulux AI", text: "Join me on Nebulux AI:", url: data.link }).catch(() => {});

  const claim = async (referredId, tier) => {
    setBusy(referredId);
    setError("");
    try {
      const r = await base44.functions.invoke("referrals", { action: "claim", referredId, tier });
      setData((d) => ({ ...d, referrals: r.data.referrals }));
      shell?.credits?.sync?.(r.data.credits);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not claim that reward.");
    } finally {
      setBusy("");
    }
  };

  const claimWelcome = async (tier) => {
    setBusy("welcome");
    setError("");
    try {
      const r = await base44.functions.invoke("referrals", { action: "claim-welcome", tier });
      clearWelcomePending();
      setData((d) => ({ ...d, welcome: r.data.welcome }));
      shell?.credits?.sync?.(r.data.credits);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not claim your welcome bonus.");
    } finally {
      setBusy("");
    }
  };

  const active = (data?.referrals || []).filter((r) => !r.revoked);
  const welcome = data?.welcome;

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-5 h-5 text-amber-300" />
        <h3 className="text-lg font-semibold text-white">Refer friends</h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Share your link — <span className="text-amber-200">you both get free credits.</span> Every friend who signs up with it picks a welcome bonus, and you pick a reward for each one. Credits work even without a plan. <span className="text-amber-200">If a friend later upgrades, you get more: 25 credits of every AI for Pro, 50 for Team, 5 per seat for Enterprise.</span>
      </p>

      {welcome && !welcome.reward && !welcome.revoked && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 mb-4">
          <p className="text-sm text-amber-100 mb-2">🎁 A friend invited you — pick your welcome bonus:</p>
          <RewardPicker rewards={data.rewards} onPick={claimWelcome} disabled={busy === "welcome"} />
        </div>
      )}
      {welcome?.reward && (
        <p className="text-xs text-emerald-300 mb-4">
          ✓ Welcome bonus claimed: {welcome.reward.amount} {LABEL[welcome.reward.tier]} credits
        </p>
      )}

      {!data && !error && (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-2">
            <input readOnly value={data.link} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 outline-none px-1" />
            <button onClick={copy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-[#fff] text-xs font-medium hover:bg-indigo-700">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {typeof navigator !== "undefined" && navigator.share && (
              <button onClick={share} title="Share" className="p-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600">
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4 mb-2">Each friend = one reward of your choice (and they pick one too):</p>
          <div className="grid grid-cols-2 gap-2">
            {REWARD_INFO.map((r) => (
              <div key={r.tier} className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                <r.icon className={`w-4 h-4 ${r.color}`} />
                <span className="text-sm text-slate-200">
                  <b>{data.rewards?.[r.tier]}</b> {r.label}
                </span>
              </div>
            ))}
          </div>

          <p className="text-sm font-medium text-slate-300 mt-5 mb-2">
            Your referrals {active.length ? `(${active.length})` : ""}
          </p>
          {data.referrals?.length ? (
            <div className="space-y-2 max-h-72 overflow-y-auto sidebar-scroll pr-1">
              {data.referrals.map((r) => (
                <div key={r.id} className="rounded-xl bg-slate-800 border border-slate-700/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-100 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-500 shrink-0">{new Date(r.at).toLocaleDateString()}</p>
                  </div>
                  {r.revoked ? (
                    <p className="text-xs text-red-300 mt-1">Removed by an admin</p>
                  ) : r.reward ? (
                    <p className="text-xs text-emerald-300 mt-1">
                      ✓ Claimed {r.reward.amount} {LABEL[r.reward.tier]} credits
                    </p>
                  ) : (
                    <div className="mt-2">
                      <p className="text-xs text-amber-200 mb-1.5">Pick your reward:</p>
                      <RewardPicker rewards={data.rewards} onPick={(tier) => claim(r.id, tier)} disabled={busy === r.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No one has signed up with your link yet.</p>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </div>
  );
}
