import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useConversations } from "@/hooks/useConversations";
import { useCredits } from "@/hooks/useCredits";
import { claimPendingReferral, hasWelcomePending } from "@/lib/referral";
import WelcomeReward from "@/components/WelcomeReward";
import WelcomeTour from "@/components/WelcomeTour";
import TermsGate from "@/components/TermsGate";
import NamePrompt from "@/components/NamePrompt";
import TwoStepGate from "@/components/TwoStepGate";
import { applyThemeClass, readUserTheme, writeUserTheme } from "@/lib/theme";
import { restoreChats } from "@/lib/chatStash";

import CodeArt from "@/components/chat/CodeArt";

const CODE_PLANS = ["pro", "team", "enterprise", "max", "secret"];

const AppShellContext = createContext(null);

export const useAppShell = () => useContext(AppShellContext);

export function AppShellProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const conv = useConversations();
  const credits = useCredits();
  const [currentUser, setCurrentUser] = useState(null);
  const [lightMode, setLightMode] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("light"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // Signed in on this device: cover the app from the very first moment until the two-step code,
  // the user agreement and the name are done, so nothing behind them can be used meanwhile.
  const [hasSaved] = useState(() => {
    try {
      return !!localStorage.getItem("base44_access_token");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    base44.functions.invoke("record-email").catch(() => {});
    base44.auth
      .me()
      .then((u) => {
        setCurrentUser(u);
        restoreChats(u?.id); // chats this account put aside when it last signed out here
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // A new user who arrived through a friend's invite link: count the referral once,
  // then let them pick their own welcome bonus (until they do, it's offered on each visit).
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [twoStepOk, setTwoStepOk] = useState(false);
  const twoStepDone = useCallback(() => setTwoStepOk(true), []);
  const [termsOk, setTermsOk] = useState(false);
  const termsDone = useCallback(() => setTermsOk(true), []);
  const [nameOk, setNameOk] = useState(false);
  const nameDone = useCallback((newName) => {
    setNameOk(true);
    if (newName) setCurrentUser((u) => (u ? { ...u, full_name: newName, name_set: true } : u));
  }, []);
  useEffect(() => {
    if (!currentUser?.id) return;
    claimPendingReferral().then(() => {
      if (hasWelcomePending()) setWelcomeOpen(true);
    });
  }, [currentUser?.id]);

  // The theme index.html already applied (this device's last one, else the OS preference), then
  // refined per-user once we know who's logged in. Starting from what's on screen avoids a flip.
  useEffect(() => {
    if (!currentUser?.id) return;
    const t = readUserTheme(currentUser.id);
    if (t !== null) setLightMode(t);
  }, [currentUser?.id]);
  useEffect(() => {
    applyThemeClass(lightMode);
  }, [lightMode]);

  const toggleLight = useCallback(() => {
    setLightMode((prev) => {
      const next = !prev;
      writeUserTheme(currentUser?.id, next);
      return next;
    });
  }, [currentUser?.id]);

  const isAdmin = currentUser?.role === "admin";
  // Bans show from the User row and from the credit server, whose answer (from admin-only
  // records) clearing your own row can't change. A block with an end date is "blocked until".
  const untilRaw = currentUser?.blockedUntil || credits.blockedUntil;
  const blockedUntil = untilRaw ? new Date(untilRaw) : null;
  const isBlocked = !!(blockedUntil && blockedUntil > new Date());
  // Hasn't confirmed their email: the server refuses everything, and the app asks for the code.
  const isUnverified = credits.unverified === true || (currentUser?.is_verified === false && currentUser?.role !== "admin");
  const isBanned = currentUser?.banned === true || (credits.blocked === true && !isBlocked && !isUnverified);
  // Single source of truth for the effective plan (handles admin, secret, team membership and Pro expiry).
  const effPlan = credits.plan;
  const avatarInitial = (currentUser?.full_name || currentUser?.email || "U").trim().charAt(0).toUpperCase();

  const goHome = useCallback(() => { navigate("/chat"); setSidebarOpen(false); }, [navigate]);
  // Nebulux Code is for Pro and up, admins included: anyone else gets an upgrade popup instead.
  // Unknown until both the account and its plan have loaded (null): only a known "no" blocks it,
  // so an admin clicking Code a moment after the page opens isn't told to upgrade.
  const codeAllowed = !currentUser || !credits.plan ? null : CODE_PLANS.includes(credits.plan); // plan only: admins too (owner, 2026-10-05)
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const goCode = useCallback(() => {
    setSidebarOpen(false);
    if (codeAllowed === false) {
      setUpgradeOpen(true);
      return;
    }
    navigate("/chat/code");
  }, [navigate, codeAllowed]);
  const goDesigner = useCallback(() => { navigate("/chat/designer"); setSidebarOpen(false); }, [navigate]);
  const goGames = useCallback(() => { navigate("/chat/games"); setSidebarOpen(false); }, [navigate]);
  const goGameDesigner = useCallback(() => { navigate("/chat/game-designer", { state: { fresh: Date.now() } }); setSidebarOpen(false); }, [navigate]);
  const goPlans = useCallback(() => { navigate("/chat/shop"); setSidebarOpen(false); }, [navigate]);
  const goMonitor = useCallback(() => { navigate("/chat/monitor"); setSidebarOpen(false); }, [navigate]);
  const goPromos = useCallback(() => { navigate("/chat/promos"); setSidebarOpen(false); }, [navigate]);
  const newChat = useCallback(() => { conv.createConversation("New Chat"); navigate("/chat"); setSidebarOpen(false); }, [navigate, conv]);
  const goBilling = useCallback((productId = "pro") => navigate("/billing", { state: { productId } }), [navigate]);
  // Back within the app, or to the chat when there is nothing to go back to (a page opened from a link).
  const goBack = useCallback(() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/chat", { replace: true })), [navigate]);
  // The profile opens over the current page as a history entry of its own, so the page stays
  // behind it and the phone's back button (or a tap outside) closes it.
  const openProfile = useCallback((initialView = "main") => {
    const state = location.state || {};
    const alreadyOpen = !!state.profile;
    navigate(location.pathname + location.search, {
      replace: alreadyOpen,
      state: { ...state, profile: initialView, profileEntry: alreadyOpen ? !!state.profileEntry : true },
    });
  }, [navigate, location]);
  const closeProfile = useCallback(() => {
    const { profile, profileEntry, ...rest } = location.state || {};
    if (!profile) return;
    if (profileEntry && window.history.state?.idx > 0) navigate(-1);
    else navigate(location.pathname + location.search, { replace: true, state: rest });
  }, [navigate, location]);

  const value = {
    currentUser, conv, credits, lightMode, toggleLight,
    isAdmin, isBanned, isBlocked, isUnverified, blockedUntil, effPlan, avatarInitial,
    sidebarOpen, setSidebarOpen, codeAllowed, setUpgradeOpen,
    navigate, goHome, goCode, goDesigner, goGames, goGameDesigner, goPlans, goMonitor, goPromos, newChat, goBilling, openProfile, closeProfile, goBack,
  };

  return (
    <AppShellContext.Provider value={value}>
      {children}
      {/* The user agreement comes first; the invite reward and the tour wait for it. */}
      {((hasSaved && !authChecked) || (currentUser && !(twoStepOk && termsOk && nameOk))) && (
        <div className="fixed inset-0 z-[98] flex items-center justify-center bg-slate-950" aria-hidden="true">
          <span className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      )}
      {/* Two-step code first (if it's on), then the agreement, then the name. */}
      <TwoStepGate user={currentUser} onDone={twoStepDone} />
      <TermsGate user={twoStepOk ? currentUser : null} onDone={termsDone} />
      {/* Then, once per account: what should Nebulux AI call you (their username). */}
      <NamePrompt user={currentUser} ready={termsOk} onDone={nameDone} />
      <WelcomeReward open={welcomeOpen && termsOk && nameOk} onClose={() => setWelcomeOpen(false)} onClaimed={credits.sync} />
      {/* A new account's first visit: a short guided tour, or explore alone (after any invite reward). */}
      {upgradeOpen && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={() => setUpgradeOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="upgrade-title" className="w-full max-w-md rounded-2xl bg-[var(--cl-card)] border border-[var(--cl-border)] p-6 shadow-2xl text-[var(--cl-text)]">
            <CodeArt className="w-full h-auto rounded-xl mb-4" />
            <h2 id="upgrade-title" className="font-serif text-2xl">{upgradeOpen?.title || "Upgrade to use Nebulux Code"}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--cl-muted)]">{upgradeOpen?.text || "Nebulux Code is included with Pro and higher plans. Upgrade to build apps, websites and games with the coding AI."}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setUpgradeOpen(false)} className="rounded-lg border border-[var(--cl-border)] px-4 py-2 text-[14px] text-[var(--cl-muted)] hover:bg-[var(--cl-border)]/60">Not now</button>
              <button onClick={() => { setUpgradeOpen(false); goPlans(); }} className="rounded-lg bg-[var(--cl-text)] px-4 py-2 text-[14px] font-medium text-[var(--cl-bg)] hover:opacity-90">Upgrade</button>
            </div>
          </div>
        </div>
      )}
      <WelcomeTour user={currentUser} shell={value} blocked={!termsOk || !nameOk || welcomeOpen || isBanned || isBlocked || isUnverified} />
    </AppShellContext.Provider>
  );
}