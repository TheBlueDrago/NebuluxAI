import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

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

  useEffect(() => {
    refresh();
    base44.functions
      .invoke("my-team")
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

  const tier = (k) => status?.tiers?.[k] || NONE;
  // Until the first load finishes, don't block sending — the server checks anyway.
  const remainingOf = (k) => (status ? tier(k).remaining : Infinity);

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
    aiExhausted: aiRemaining <= 0,
    aiCodeExhausted: aiCodeRemaining <= 0,
    galaxy5Exhausted: galaxy5Remaining <= 0,
    space5Exhausted: space5Remaining <= 0,
    plan: status?.plan || "free",
    // Where the plan comes from ("free", "paid", "trial", "grant", "member", "admin"), when it
    // ends, the new-account offer, and (Enterprise) the seats in the shared pool.
    planSource: status?.planSource || "free",
    planEndsAt: status?.planEndsAt || null,
    offer: status?.offer || null,
    seats: status?.seats || null,
    shared: !!status?.shared,
    tiers: status?.tiers || null,
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
