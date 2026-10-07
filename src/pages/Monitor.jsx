import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { askConfirm, showNotice } from "@/lib/dialogs";
import UserCard from "@/components/monitor/UserCard";
import UserDetail from "@/components/monitor/UserDetail";
import RevenueAnalytics from "@/components/monitor/RevenueAnalytics";
import ReportedSites from "@/components/monitor/ReportedSites";
import Messages from "@/components/monitor/Messages";
import EnterpriseApps from "@/components/monitor/EnterpriseApps";
import GrowthCard from "@/components/monitor/GrowthCard";
import PublishedContent from "@/components/monitor/PublishedContent";
import AdminLog from "@/components/monitor/AdminLog";
import SecurityGlance from "@/components/monitor/SecurityGlance";
import TermsOverdue from "@/components/monitor/TermsOverdue";
import AiHealth from "@/components/monitor/AiHealth";
import ErrorReports from "@/components/monitor/ErrorReports";
import Waitlist from "@/components/monitor/Waitlist";

export default function Monitor({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detailUser, setDetailUser] = useState(null);
  // Accounts an admin removed (banned forever, email blocked): hidden from the lists below.
  const [removed, setRemoved] = useState([]);
  // Accounts the accounts-per-network limit put on hold (Unblock lets them in).
  const [held, setHeld] = useState([]);
  const [showRemoved, setShowRemoved] = useState(false);
  // The first page (newest 200) loads right away; searching loads everyone else, 500 at a
  // time, so older accounts can be found too.
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.User.list("-created_date", 200);
      setUsers(list ?? []);
      setAllLoaded((list ?? []).length < 200);
    } catch (e) {
      console.error("Monitor load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    base44.functions
      .invoke("admin-grant", { action: "removed" })
      .then((r) => {
        setRemoved(r.data?.removed || []);
        setHeld(r.data?.held || []);
      })
      .catch(() => {});
  }, []);

  const apply = async (id, patch) => {
    // The server record first: it's what actually bans (the credit system doesn't trust
    // User.plan/banned, which people can edit on their own row). If it fails, the error shows
    // on the card instead of nothing happening.
    await base44.functions.invoke("admin-grant", { grants: [{ userId: id, ...patch }] });
    const { email, ...row } = patch;
    // Mirror it on the User row so it shows everywhere; the server record is enough if this fails.
    await base44.entities.User.update(id, row).catch((e) => console.warn("Monitor: User row not updated", e));
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...row } : u)));
    if ("plan" in patch) window.dispatchEvent(new Event("nx-plan-changed"));
    if (patch.banned === false) setHeld((list) => list.filter((r) => r.userId !== id));
    if ("removed" in patch) {
      setRemoved((list) => [
        ...(patch.removed ? [{ userId: id, email: email || "", at: new Date().toISOString() }] : []),
        ...list.filter((r) => r.userId !== id),
      ]);
    }
  };
  // One click: every account back to the Free plan (owner, 2026-10-06).
  const [freeing, setFreeing] = useState(false);
  const allFree = async () => {
    const paid = users.filter((u) => u.plan && u.plan !== "free");
    if (!(await askConfirm(`Put all ${paid.length} account${paid.length === 1 ? "" : "s"} with a plan on the Free plan? Purchases people paid for still count.`))) return;
    setFreeing(true);
    let failed = 0;
    for (const u of paid) await apply(u.id, { plan: "free", planExpiresAt: null }).catch(() => failed++);
    setFreeing(false);
    showNotice(failed ? `Done, but ${failed} couldn't be changed. Try again.` : "Everyone is on the Free plan now.");
  };
  const removedIds = new Set(removed.map((r) => r.userId));
  const heldIds = new Set(held.map((r) => r.userId));
  const withHold = (u) => (heldIds.has(u.id) ? { ...u, networkHold: true } : u);
  // Accounts that never confirmed their email and are over 3 days old (a made-up or someone
  // else's address): they can't use anything, so they're tucked away unless asked for.
  const [showStale, setShowStale] = useState(false);
  const stale = (u) => {
    if (u.is_verified !== false) return false;
    const raw = String(u.created_date || "");
    const t = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : raw + "Z");
    return Date.now() - t > 3 * 86400000;
  };
  const staleCount = users.filter((u) => !removedIds.has(u.id) && stale(u)).length;
  const visible = users.filter((u) => !removedIds.has(u.id) && u.removed !== true && (showStale || !stale(u)));

  const q = query.trim().toLowerCase();

  const [recentCount, setRecentCount] = useState(12);
  const searching = q.length > 0 || recentCount > 12; // showing more also loads every account
  useEffect(() => {
    if (!searching || allLoaded || loading) return;
    let alive = true;
    (async () => {
      setLoadingMore(true);
      try {
        let all = users;
        for (;;) {
          const page = (await base44.entities.User.list("-created_date", 500, all.length)) ?? [];
          const seen = new Set(all.map((u) => u.id));
          all = [...all, ...page.filter((u) => !seen.has(u.id))];
          if (!alive) return;
          setUsers(all);
          if (page.length < 500 || all.length >= 20000) break;
        }
        if (alive) setAllLoaded(true);
      } catch (e) {
        console.error("Monitor: loading more users failed", e);
      } finally {
        setLoadingMore(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, allLoaded, loading]);
  const filtered = q
    ? visible.filter(
        (u) =>
          `${u.full_name ?? ""}`.toLowerCase().includes(q) ||
          `${u.email ?? ""}`.toLowerCase().includes(q)
      )
    : [];
  const recent = visible.slice(0, recentCount);
  const removedUsers = removed.map((r) => users.find((u) => u.id === r.userId) || { id: r.userId, email: r.email });

  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      <div className="w-full max-w-3xl flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-sky-300" /> Monitor
        </h1>
        <div className="w-16" />
      </div>

      <SecurityGlance
        unconfirmed={users.filter((u) => u.is_verified === false && !removedIds.has(u.id)).length}
        removed={removed.length}
        held={held.length}
      />

      {!loading && <GrowthCard users={users} complete={allLoaded} />}
      <AiHealth />
      <ErrorReports />
      <Waitlist />

      {/* Published sites & games with safety flags, red first. */}
      <PublishedContent />

      {/* Inactive accounts: no user agreement accepted in 30 days. Clicking one searches for it below. */}
      <div className="w-full max-w-3xl mt-6">
        <TermsOverdue onOpenUser={(u) => setQuery(u.email || u.id)} />
      </div>

      <div className="w-full max-w-3xl mt-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-slate-800/70 border border-slate-700/50 focus:border-sky-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="mt-16 flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : q ? (
        <div className="w-full max-w-3xl mt-6 space-y-3">
          <p className="text-slate-400 text-sm inline-flex items-center gap-2">
            {filtered.length} result(s) · searched {users.length} users
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          </p>
          {filtered.map((u) => (
            <UserCard key={u.id} user={withHold(u)} onApply={apply} onOpenDetail={setDetailUser} />
          ))}
        </div>
      ) : (
        <div className="w-full max-w-3xl mt-6 space-y-3">
          <p className="text-slate-300 text-sm font-medium">Recently joined</p>
          {recent.length === 0 && <p className="text-slate-500 text-sm">No users yet.</p>}
          {recent.map((u) => (
            <UserCard key={u.id} user={withHold(u)} onApply={apply} onOpenDetail={setDetailUser} />
          ))}
          {(visible.length > recentCount || (!allLoaded && visible.length >= recentCount)) && (
            <button onClick={() => setRecentCount((n) => n + 50)} className="w-full rounded-lg bg-slate-800 border border-slate-700 py-2.5 text-sm text-slate-200 hover:bg-slate-700">
              {loadingMore ? "Loading…" : "Show me the rest of the accounts"}
            </button>
          )}
        </div>
      )}

      {!loading && (
        <div className="w-full max-w-3xl mt-6">
          <button onClick={allFree} disabled={freeing} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {freeing ? "Changing plans…" : "Make everyone Free"}
          </button>
        </div>
      )}
      {!loading && staleCount > 0 && (
        <div className="w-full max-w-3xl mt-6">
          <button onClick={() => setShowStale((v) => !v)} className="text-slate-400 text-sm hover:text-slate-200">
            {showStale ? "Hide" : "Show"} {staleCount} account{staleCount === 1 ? "" : "s"} that never confirmed their email (over 3 days old)
          </button>
        </div>
      )}

      {!loading && removed.length > 0 && (
        <div className="w-full max-w-3xl mt-6">
          <button onClick={() => setShowRemoved((v) => !v)} className="text-slate-400 text-sm hover:text-slate-200">
            {showRemoved ? "Hide" : "Show"} removed accounts ({removed.length})
          </button>
          {showRemoved && (
            <div className="mt-3 space-y-3">
              {removedUsers.map((u) => (
                <UserCard key={u.id} user={{ ...u, removed: true }} onApply={apply} onOpenDetail={setDetailUser} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !q && <ReportedSites />}
      {!loading && !q && <EnterpriseApps />}
      {!loading && !q && <Messages />}
      {!loading && !q && <RevenueAnalytics />}
      {!loading && !q && <AdminLog />}

      {detailUser && <UserDetail user={detailUser} onClose={() => setDetailUser(null)} />}
    </motion.div>
  );
}