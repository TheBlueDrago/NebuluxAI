import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { limitsState } from "@/lib/creditRefresh";
import { myTeam } from "@/lib/myTeam";

// Credits are counted and enforced on the server (the Cloudflare "credits" and
// "chatCompletion" functions, see cloudflare-lib/credits.js). They used to live in
// localStorage, where anyone could reset them. This hook only shows the server's
// status: it loads it on start, and each AI reply hands back the updated status
// through the spend* callbacks.
const NONE = { total: 0, used: 0, remaining: 0 };

export function useCredits() {
  const [status, setStatus] = useState(null);
  const [team, setTeam] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await base44.functions.invoke("credits");
      if (r?.data?.tiers) setStatus(r.data);
    } catch {
      // Signed out or offline: keep what we have; the server still enforces limits.
    }
  }, []);

  // Plans change from outside (Monitor, a promo code, a payment): check again when the tab is back.
  useEffect(() => {
    const again = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("nx-plan-changed", refresh);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("nx-plan-changed", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
    myTeam()
      .then((r) => {
        const t = r?.data?.team;
        setTeam(t && t.active ? t : null);
      })
      .catch(() => setTeam(null));
  }, [refresh]);

  // Called after each AI reply with the status it returned, or with nothing to re-fetch.
  const sync = useCallback(
    (next) => {
      if (next && next.tiers) setStatus(next);
      else refresh();
    },
    [refresh]
  );

  // The usage limits, like Claude's (cloudflare-lib/creditSession.js): a 5-hour limit and a weekly limit
  // that every AI and chat shares. While one is used up, every AI waits; when it resets, the status is
  // read again so sending opens up by itself. The per-AI monthly credits no longer limit anything.
  const limits = status ? status.limits ?? null : undefined;
  const lim = limitsState(limits || null);
  useEffect(() => {
    if (!lim.resetAt) return undefined;
    const t = setTimeout(refresh, Math.min(2147483000, lim.resetAt - Date.now() + 1500));
    return () => clearTimeout(t);
  }, [lim.resetAt, refresh]);

  // Usage credits' daily spending limit (Settings → Usage): dollars a day, or null for no limit.
  // -> the saved { balance, dailyLimit, spentToday }; throws the server's message when it isn't valid.
  const saveDailyLimit = useCallback(async (limit) => {
    const r = await base44.functions.invoke("credits", { action: "set-daily-limit", limit });
    const uc = r?.data?.usageCredits;
    if (uc) setStatus((s) => (s ? { ...s, usageCredits: uc } : s));
    return uc;
  }, []);

  const tier = (k) => status?.tiers?.[k] || NONE;
  // Every AI can be used until a shared limit is used up, or, with the 5-hour one used up, while usage
  // credits can still pay (they never extend the week). Until the first load finishes nothing is
  // blocked: the server checks anyway.
  const onCredits = lim.out === "session" && (status?.usageCredits?.spendable || 0) > 0;
  const limitBlocked = !!lim.out && !onCredits;
  const remainingOf = () => (limitBlocked ? 0 : Infinity);

  const aiRemaining = remainingOf("ai");
  const aiCodeRemaining = remainingOf("aiCode");
  const galaxy5Remaining = remainingOf("galaxy5");
  const space5Remaining = remainingOf("space5");

  return {
    aiTotal: tier("ai").total,
    aiUsed: tier("ai").used,
    aiCodeTotal: tier("aiCode").total,
    aiCodeUsed: tier("aiCode").used,
    galaxy5Total: tier("galaxy5").total,
    galaxy5Used: tier("galaxy5").used,
    space5Total: tier("space5").total,
    space5Used: tier("space5").used,
    aiRemaining,
    aiCodeRemaining,
    galaxy5Remaining,
    space5Remaining,
    aiExhausted: limitBlocked,
    aiCodeExhausted: limitBlocked,
    galaxy5Exhausted: limitBlocked,
    space5Exhausted: limitBlocked,
    plan: status?.plan || "free",
    // Where the plan comes from ("free", "paid", "trial", "grant", "member", "admin"), when it
    // ends, the new-account offer, and (Enterprise) the seats in the shared pool.
    planSource: status?.planSource || "free",
    planEndsAt: status?.planEndsAt || null,
    offer: status?.offer || null,
    seats: status?.seats || null,
    shared: !!status?.shared,
    tiers: status?.tiers || null,
    // { session, week, out } (null for the owner's accounts: no limits; undefined until loaded), and
    // which one is used up ("session", "week" or null)
    limits,
    limitOut: limitBlocked ? lim.out : null,
    // the 5-hour limit is used up and usage credits are paying for messages now
    onUsageCredits: onCredits,
    // { balance, dailyLimit, spentToday } in dollars (cloudflare-lib/usageCredits.js), or null
    usageCredits: status?.usageCredits || null,
    saveDailyLimit,
    sessionOut: limitBlocked,
    // Banned or blocked by an admin, as the server sees it (the ban screen uses this too).
    blocked: status?.blocked === true,
    blockedUntil: status?.blockedUntil || null,
    // Signed up but hasn't entered the emailed code yet (Chat shows the confirm screen).
    unverified: status?.unverified === true,
    blockReason: status?.blockReason || null,
    team,
    refresh,
    sync,
    spendAI: sync,
    spendAICode: sync,
    spendGalaxy5: sync,
    spendSpace5: sync,
  };
}
