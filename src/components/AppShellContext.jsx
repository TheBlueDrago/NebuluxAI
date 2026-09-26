import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useConversations } from "@/hooks/useConversations";
import { useCredits } from "@/hooks/useCredits";
import { claimPendingReferral, hasWelcomePending } from "@/lib/referral";
import WelcomeReward from "@/components/WelcomeReward";
import WelcomeTour from "@/components/WelcomeTour";
import { applyThemeClass, readUserTheme, writeUserTheme } from "@/lib/theme";
import { restoreChats } from "@/lib/chatStash";

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

  useEffect(() => {
    base44.functions.invoke("record-email").catch(() => {});
    base44.auth
      .me()
      .then((u) => {
        setCurrentUser(u);
        restoreChats(u?.id); // chats this account put aside when it last signed out here
      })
      .catch(() => setCurrentUser(null));
  }, []);

  // A new user who arrived through a friend's invite link: count the referral once,
  // then let them pick their own welcome bonus (until they do, it's offered on each visit).
  const [welcomeOpen, setWelcomeOpen] = useState(false);
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
  const goCode = useCallback(() => {
    // Access follows credits: anyone with Nebulux Code credits can use it, and anyone without
    // gets the page's out-of-credits card, where they can buy some whatever their plan.
    navigate("/chat/code");
    setSidebarOpen(false);
  }, [navigate]);
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
    sidebarOpen, setSidebarOpen,
    navigate, goHome, goCode, goDesigner, goGames, goGameDesigner, goPlans, goMonitor, goPromos, newChat, goBilling, openProfile, closeProfile, goBack,
  };

  return (
    <AppShellContext.Provider value={value}>
      {children}
      <WelcomeReward open={welcomeOpen} onClose={() => setWelcomeOpen(false)} onClaimed={credits.sync} />
      {/* A new account's first visit: a short guided tour, or explore alone (after any invite reward). */}
      <WelcomeTour user={currentUser} shell={value} blocked={welcomeOpen || isBanned || isBlocked || isUnverified} />
    </AppShellContext.Provider>
  );
}