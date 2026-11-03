import React from "react";
import { Navigate } from "react-router-dom";
import { useAppShell } from "@/components/AppShellContext";
import Subscriptions from "@/components/Subscriptions";
import Monitor from "@/pages/Monitor";
import PromoManager from "@/pages/PromoManager";

// Thin route components so the secondary views live on real URLs and support swipe-back.
// The Shop tab (also at the old /chat/plans).
export function PlansView() {
  const shell = useAppShell();
  return (
    <Subscriptions
      onFree={shell.goBack}
      offer={shell.credits.offer}
      onPro={() => shell.goBilling("pro")}
      onTeam={() => shell.goBilling("team")}
    />
  );
}

// Admin pages: everything on them is checked on the server anyway, but other people are sent
// back to the chat instead of seeing an empty admin screen. Nothing shows until the account
// has loaded, so admins aren't bounced while it does.
function AdminOnly({ children }) {
  const { currentUser, isAdmin } = useAppShell();
  if (!currentUser) return null;
  return isAdmin ? children : <Navigate to="/chat" replace />;
}

export function MonitorView() {
  const shell = useAppShell();
  return (
    <AdminOnly>
      <Monitor onBack={shell.goBack} />
    </AdminOnly>
  );
}

export function PromosView() {
  const shell = useAppShell();
  return (
    <AdminOnly>
      <PromoManager onBack={shell.goBack} />
    </AdminOnly>
  );
}

// Old /chat/settings links: open the profile over the chat.
export function SettingsView() {
  return <Navigate to="/chat" replace state={{ profile: "main" }} />;
}