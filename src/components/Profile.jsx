import React, { useState, useEffect } from "react";
import { askConfirm } from "@/lib/dialogs";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Upload, LogOut, Mail, Shield, KeyRound, ArrowLeft, Loader2, Crown, Settings, Users, Lock, ShieldCheck, Ticket, Trash2, Gamepad2, Pencil, Eye, EyeOff, Globe, Gift, Smartphone, Building2, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { signOut } from "@/lib/signOut";
import TeamMembership from "@/components/TeamMembership";
import SecurityPanel from "@/components/profile/SecurityPanel";
import TwoStepPanel from "@/components/profile/TwoStepPanel";
import PublishedSites from "@/components/profile/PublishedSites";
import ReferFriends from "@/components/profile/ReferFriends";
import SubscriptionPanel from "@/components/profile/SubscriptionPanel";
import { notifyGamesChanged } from "@/lib/gameEvents";
import { downloadChats, importChats } from "@/lib/chatBackup";
import { useInstallApp } from "@/lib/installPrompt";
import useEscape from "@/hooks/useEscape";
import useDialogFocus from "@/hooks/useDialogFocus";
import { markSessionOnly, noteSignedOut } from "@/lib/sessionOnly";
import { stashChats } from "@/lib/chatStash";
import { useAppShell } from "@/components/AppShellContext";
import { useAuth } from "@/lib/AuthContext";

export default function Profile({ open, onClose, initialView = "main", onMonitor, onPromos }) {
  const [user, setUser] = useState(null);
  const shell = useAppShell();
  const auth = useAuth();
  useEscape(open, onClose);
  const dialogRef = useDialogFocus(open);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("main"); // main | settings | membership | games
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesErr, setGamesErr] = useState("");

  // Password reset flow: idle -> sent
  const [pwStep, setPwStep] = useState("idle");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  // Account deletion confirmation
  const [delText, setDelText] = useState("");
  const [delAck, setDelAck] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");
  const [backupNote, setBackupNote] = useState("");
  const installApp = useInstallApp();
  const [iosHelp, setIosHelp] = useState(false);

  // Admins: reported sites, contact messages and Enterprise applications waiting (badge on the Monitor button).
  const [openReports, setOpenReports] = useState({ reports: 0, messages: 0, enterprise: 0 });
  useEffect(() => {
    if (!open || user?.role !== "admin") return;
    Promise.all(
      ["admin-reports", "contact", "enterprise"].map((fn) =>
        base44.functions.invoke(fn, { action: "count" }).then((r) => r.data?.open || 0).catch(() => 0)
      )
    ).then(([reports, messages, enterprise]) => setOpenReports({ reports, messages, enterprise }));
  }, [open, user?.role]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setView(initialView);
      setPwStep("idle");
      setPwError("");
      setDelText("");
      setDelAck(false);
      setDelError("");
      base44.auth
        .me()
        .then((u) => setUser(u))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    }
  }, [open, initialView]);

  const resetPwState = () => {
    setPwStep("idle");
    setPwError("");
  };

  const handleLogout = () => {
    markSessionOnly(false); // the next person to sign in here chooses for themselves
    // and doesn't see your chats (they come back when you sign in). The app already knows who's
    // signed in if this window hasn't finished loading yet.
    stashChats(user?.id || shell?.currentUser?.id || auth?.user?.id);
    noteSignedOut("signed-out");
    signOut();
  };

  const startReset = async () => {
    setPwError("");
    setPwBusy(true);
    try {
      await base44.auth.resetPasswordRequest(user?.email || "");
      setPwStep("sent");
    } catch (e) {
      setPwError(e.message || "Could not send reset email");
    } finally {
      setPwBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDelError("");
    setDelBusy(true);
    try {
      // Sites, games and drafts first (they live outside the User record); if that
      // fails, stop so nothing is left behind without an account to manage it.
      await base44.functions.invoke("delete-my-content");
      await base44.functions.invoke("delete-account");
      // Chats, designer projects and images are kept in this browser; clear them too.
      try {
        localStorage.clear();
        indexedDB.deleteDatabase("blackhole-designer");
      } catch {
        // Storage blocked: nothing saved to clear.
      }
      signOut("/");
    } catch (e) {
      setDelError(e?.response?.data?.error || e?.message || "Could not delete account");
      setDelBusy(false);
    }
  };

  // Games an admin took down (functions/page-status.js), so owners can tell.
  const [takenDownGames, setTakenDownGames] = useState(() => new Set());
  useEffect(() => {
    if (!games.length) return;
    let alive = true;
    Promise.all(
      games.map((g) =>
        base44.functions
          .invoke("page-status", { kind: "game", name: g.name })
          .then((r) => (r.data?.blocked ? g.name : null))
          .catch(() => null)
      )
    ).then((names) => alive && setTakenDownGames(new Set(names.filter(Boolean))));
    return () => {
      alive = false;
    };
  }, [games]);

  const loadGames = async () => {
    setGamesLoading(true);
    setGamesErr("");
    try {
      const list = await base44.entities.PublishedGame.list("-updated_date", 200);
      setGames((list || []).filter((g) => user?.role === "admin" || g.created_by_id === user?.id));
    } catch (e) {
      setGamesErr(e?.message || "Could not load games");
    } finally {
      setGamesLoading(false);
    }
  };
  const editGame = async (g) => {
    setGamesErr("");
    try {
      const res = await base44.functions.invoke("get-game-html", { name: g.name });
      const d = res.data || {};
      const html = d.html || "";
      localStorage.setItem("infinity-ai-game-designer", JSON.stringify({
        gameName: g.name,
        title: d.title || g.title || "",
        genre: d.genre || g.genre || "io",
        messages: html ? [{ role: "ai", content: html }] : [],
        projectId: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now())
      }));
      navigate("/chat/game-designer", { replace: true });
    } catch (e) {
      setGamesErr(e?.message || "Could not open game");
    }
  };
  const toggleHidden = async (g) => {
    try {
      await base44.entities.PublishedGame.update(g.id, { hidden: !g.hidden });
      loadGames();
      notifyGamesChanged();
    } catch (e) {
      setGamesErr(e?.message);
    }
  };
  const deleteGame = async (g) => {
    if (!await askConfirm(`Delete "${g.title || g.name}"? This cannot be undone.`)) return;
    try {
      await base44.entities.PublishedGame.delete(g.id);
      loadGames();
      notifyGamesChanged();
    } catch (e) {
      setGamesErr(e?.message);
    }
  };
  const [deletingAll, setDeletingAll] = useState(false);
  const deleteAllGames = async () => {
    if (!games.length) return;
    if (!await askConfirm(`Delete all ${games.length} game${games.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeletingAll(true);
    setGamesErr("");
    try {
      for (const g of games) {
        await base44.entities.PublishedGame.delete(g.id);
      }
      await loadGames();
      notifyGamesChanged();
    } catch (e) {
      setGamesErr(e?.message || "Could not delete all games");
    } finally {
      setDeletingAll(false);
    }
  };

  const initials = (user?.full_name || user?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isPro = user?.plan === "pro" && (!user?.planExpiresAt || new Date(user.planExpiresAt) > new Date());
  const isTeam = user?.plan === "team" && (!user?.planExpiresAt || new Date(user.planExpiresAt) > new Date());
  // Secret can't be bought any more; accounts that already have it still show it.
  const isSecret = user?.plan === "secret" && (!user?.planExpiresAt || new Date(user.planExpiresAt) > new Date());
  const isEnterprise = user?.plan === "enterprise" && (!user?.planExpiresAt || new Date(user.planExpiresAt) > new Date());
  const effPlan = user?.role === "admin" ? "admin" : isEnterprise ? "enterprise" : isSecret ? "secret" : isTeam ? "team" : isPro ? "pro" : "free";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            // Never taller than the screen: on small phones the longer views (Security,
            // Subscriptions) scroll inside the window instead of being cut off.
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Account and settings"
            className="w-full max-w-sm max-h-[calc(100dvh-2rem)] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-y-auto overscroll-contain"
          >
            {pwStep === "sent" ? (
              <div className="p-6">
                <button
                  onClick={resetPwState}
                  className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-slate-200 text-base font-semibold">
                    Look at your AI account email for the password reset link
                  </p>
                  <p className="text-slate-500 text-xs mt-2">We sent a reset link to {user?.email}.</p>
                </div>
              </div>
            ) : view === "membership" ? (
              <TeamMembership onBack={() => setView("subscription")} />
            ) : view === "delete" ? (
              <div className="p-6">
                <button
                  onClick={() => setView("settings")}
                  className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-semibold text-white">Delete Account</h3>
                </div>
                <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                  This permanently deletes your account, your published websites and games, your saved game draft, and the chats and projects saved in this browser. This action cannot be undone.
                </p>
                <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 mb-4 leading-relaxed">
                  Paying for a plan? Deleting your account doesn't cancel the payment by itself.{" "}
                  <a href="/contact?topic=billing" className="underline hover:text-white">Contact us</a> to cancel it first.
                </p>
                <label className="text-xs text-slate-400">
                  Type <span className="font-semibold text-red-400">DELETE</span> to confirm
                </label>
                <input
                  value={delText}
                  onChange={(e) => setDelText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full mt-1 mb-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-red-500 transition-colors uppercase tracking-wide"
                />
                <label className="flex items-start gap-2 text-xs text-slate-300 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={delAck}
                    onChange={(e) => setDelAck(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-red-500 shrink-0"
                  />
                  <span>I understand this is permanent and cannot be undone.</span>
                </label>
                {delError && <p className="text-sm text-red-400 mb-2">{delError}</p>}
                <button
                  onClick={handleDeleteAccount}
                  // The box shows capitals whatever's typed, so "delete" has to count too.
                  disabled={delBusy || !delAck || delText.trim().toUpperCase() !== "DELETE"}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-700 text-[#fff] font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {delBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete account
                </button>
              </div>
            ) : view === "twostep" ? (
              <TwoStepPanel onBack={() => setView("settings")} />
            ) : view === "security" ? (
              <SecurityPanel user={user} email={user?.email} onBack={() => setView("settings")} onChangePassword={startReset} busy={pwBusy} />
            ) : view === "subscription" ? (
              <SubscriptionPanel onBack={() => setView("settings")} onManagePeople={() => setView("membership")} />
            ) : view === "refer" ? (
              <ReferFriends onBack={() => setView("main")} />
            ) : view === "sites" ? (
              <PublishedSites user={user} plan={effPlan} onBack={() => setView("settings")} />
            ) : view === "games" ? (
              <div className="p-6">
                <button
                  onClick={() => setView("settings")}
                  className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-fuchsia-300" />
                    <h3 className="text-lg font-semibold text-white">Published Games</h3>
                  </div>
                  {games.length > 0 && (
                    <button
                      onClick={deleteAllGames}
                      disabled={deletingAll}
                      className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {deletingAll ? "Deleting…" : "Delete all"}
                    </button>
                  )}
                </div>
                {gamesLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : games.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">You haven't published any games yet.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto sidebar-scroll pr-1">
                    {games.map((g) => (
                      <div key={g.id} className="rounded-xl bg-slate-800 border border-slate-700/50 p-3">
                        <p className="text-sm font-medium text-slate-100 truncate">{g.title || g.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{g.name} · {g.plays || 0} plays{g.hidden ? " · hidden" : ""}{g.featured ? " · featured" : ""}</p>
                        {takenDownGames.has(g.name) && (
                          <p className="text-[11px] text-red-400">Taken down by an admin for breaking the rules — players see a "removed" message.</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <button onClick={() => editGame(g)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => toggleHidden(g)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors ${g.hidden ? "bg-emerald-600/80 text-white hover:bg-emerald-500" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`}>
                            {g.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {g.hidden ? "Republish" : "Unpublish"}
                          </button>
                          <button onClick={() => deleteGame(g)} className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-red-900/50 text-red-300 text-xs hover:bg-red-900/70 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {gamesErr && <p className="text-sm text-red-400 mt-3">{gamesErr}</p>}
              </div>
            ) : view === "settings" ? (
              <div className="p-6">
                <button
                  onClick={() => setView("main")}
                  className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-slate-300" />
                  <h3 className="text-lg font-semibold text-white">Settings</h3>
                </div>
                <button
                  onClick={() => setView("subscription")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <CreditCard className="w-4 h-4 text-indigo-300" />
                    Subscriptions
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                </button>
                <button
                  onClick={() => { setView("games"); loadGames(); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Gamepad2 className="w-4 h-4 text-fuchsia-300" />
                    Published Games
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                </button>
                <button
                  onClick={() => setView("sites")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Globe className="w-4 h-4 text-sky-300" />
                    Published Websites
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                </button>
                <button
                  onClick={() => setView("twostep")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-indigo-300" />
                    Two-step verification
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                </button>
                <button
                  onClick={() => setView("security")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    Security
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-slate-500" />
                </button>
                <div className="mt-4 mb-4 pt-4 border-t border-slate-700/50">
                  <p className="text-slate-300 text-sm font-medium">Chat backup</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
                    Your chats are saved in this browser only. Download them to keep a copy or move them to another device.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const n = downloadChats();
                        setBackupNote(n ? `Downloaded ${n} chat${n === 1 ? "" : "s"}.` : "There are no chats to download yet.");
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors cursor-pointer">
                      <Upload className="w-4 h-4" /> Import
                      <input
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          try {
                            const n = await importChats(f);
                            setBackupNote(n ? `Imported ${n} chat${n === 1 ? "" : "s"}.` : "Those chats are already here.");
                          } catch (err) {
                            setBackupNote(err.message);
                          }
                        }}
                      />
                    </label>
                  </div>
                  {backupNote && <p className="text-[11px] text-slate-400 mt-2">{backupNote}</p>}
                </div>
                  <button
                  onClick={() => setView("delete")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors border border-red-500/30"
                  >
                  <span className="flex items-center gap-2 font-medium">
                    <Trash2 className="w-4 h-4" />
                    Delete account
                  </span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-red-500" />
                  </button>
                  </div>
            ) : (
              <>
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-500/20">
                    {loading ? "?" : initials}
                  </div>
                  {loading ? (
                    <div className="mt-4 w-32 h-4 rounded bg-slate-700/50 animate-pulse" />
                  ) : user ? (
                    <>
                      <h3 className="mt-4 text-lg font-semibold text-white">
                        {user.full_name || "Nebulux User"}
                      </h3>
                      {isEnterprise ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/25 to-indigo-500/25 text-violet-200 border border-violet-400/50">
                          <Building2 className="w-3 h-3" />
                          Enterprise
                        </span>
                      ) : isSecret ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-black text-slate-100 border border-slate-700">
                          <Lock className="w-3 h-3" />
                          Secret
                        </span>
                      ) : isTeam ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-500/25 to-indigo-500/25 text-sky-200 border border-sky-400/50">
                          <Users className="w-3 h-3" />
                          Team
                        </span>
                      ) : isPro ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-200 border border-amber-400/50">
                          <Crown className="w-3 h-3" />
                          Pro
                        </span>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1.5 text-slate-400 text-sm">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{user.email}</span>
                      </div>
                      {user.role && (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          <Shield className="w-3 h-3" />
                          {user.role}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="mt-4 text-slate-400 text-sm">Not signed in</p>
                  )}
                </div>

                <div className="h-px bg-slate-700/50" />

                <div className="p-4 space-y-2.5">
                  {user?.role === "admin" && (
                    <button
                      onClick={onMonitor}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Monitor
                      {openReports.reports + openReports.messages + openReports.enterprise > 0 && (
                        <span
                          className="text-[11px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none"
                          title={`${openReports.reports} reported site(s), ${openReports.messages} message(s), ${openReports.enterprise} Enterprise application(s) waiting`}
                        >
                          {openReports.reports + openReports.messages + openReports.enterprise}
                        </span>
                      )}
                    </button>
                  )}
                  {user?.role === "admin" && (
                    <button
                      onClick={onPromos}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                    >
                      <Ticket className="w-4 h-4" />
                      Promo Code
                    </button>
                  )}
                  <button
                    onClick={() => setView("refer")}
                    disabled={!user}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-fuchsia-500/25 border border-amber-400/40 text-amber-100 font-medium hover:from-amber-500/35 hover:to-fuchsia-500/35 transition-colors disabled:opacity-60"
                  >
                    <Gift className="w-4 h-4" />
                    Refer friends · get free credits
                  </button>
                  {/* The installed app was removed (owner, 2026-09-27): no Install button. */}
                  {false && (installApp.canPrompt || installApp.ios) && (
                    <button
                      onClick={() => (installApp.canPrompt ? installApp.install() : setIosHelp((v) => !v))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                    >
                      <Smartphone className="w-4 h-4" />
                      Install app
                    </button>
                  )}
                  {iosHelp && installApp.ios && (
                    <p className="text-xs text-slate-400 text-center px-2">
                      In Safari, tap the Share button, then <span className="text-slate-200">Add to Home Screen</span>.
                    </p>
                  )}
                  <button
                    onClick={startReset}
                    disabled={pwBusy || !user}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
                  >
                    {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Forgot password
                  </button>
                  <button
                    onClick={() => setView("settings")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-700 text-[#fff] font-medium hover:bg-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                  <p className="pt-1 text-center text-[11px] text-slate-500 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    <Link to="/whats-new" target="_blank" className="hover:text-slate-300">What's new</Link>
                    <Link to="/guides" target="_blank" className="hover:text-slate-300">Guides</Link>
                    <Link to="/showcase" target="_blank" className="hover:text-slate-300">Gallery</Link>
                    <Link to="/terms" target="_blank" className="hover:text-slate-300">Terms</Link>
                    <Link to="/privacy" target="_blank" className="hover:text-slate-300">Privacy</Link>
                    <Link to="/contact" target="_blank" className="hover:text-slate-300">Contact</Link>
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}