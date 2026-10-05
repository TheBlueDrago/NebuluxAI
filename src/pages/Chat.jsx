import React, { Suspense, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { showNotice } from "@/lib/dialogs";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShellProvider, useAppShell } from "@/components/AppShellContext";
import Profile from "@/components/Profile";
import PromoExpiredPopup from "@/components/PromoExpiredPopup";
import TeamWelcomePopup from "@/components/TeamWelcomePopup";
import BanScreen from "@/components/BanScreen";
import VerifyEmailScreen from "@/components/VerifyEmailScreen";
import MobileTabBar from "@/components/MobileTabBar";
import MotionPrefs from "@/components/MotionPrefs";
import usePageTitle, { appTitleFor } from "@/hooks/usePageTitle";

const PageSpinner = () => (
  <div className="relative z-10 min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin"></div>
  </div>
);

function ChatLayout() {
  const shell = useAppShell();
  const { isBanned, isBlocked, isUnverified, blockedUntil, openProfile, closeProfile } = shell;
  const loc = useLocation();
  const navigate = useNavigate();
  usePageTitle(appTitleFor(loc.pathname));

  // Back from "Set up automatically" (Domain Connect, see designer/CustomDomain.jsx): the domain
  // company added the records, so check them now and say how it went.
  useEffect(() => {
    const site = new URLSearchParams(loc.search).get("domainconnect");
    if (!site || !/^[a-z0-9-]{1,63}$/.test(site)) return;
    navigate(loc.pathname, { replace: true });
    const error = new URLSearchParams(loc.search).get("error");
    if (error) {
      showNotice("The domain wasn't set up (it was cancelled or failed). You can try again, or add the records yourself.");
      return;
    }
    base44.functions
      .invoke("custom-domain", { action: "verify", site })
      .then((r) => {
        const d = r.data || {};
        showNotice(
          d.live
            ? `Your website is live at https://${d.domain}`
            : d.error
              ? `Records added! It can take a few minutes for them to show up. Open your site's domain window and press Verify or Check again in a little while.`
              : `Records added for ${d.domain || "your domain"}. It's getting its secure connection now; it'll be live within minutes.`
        );
      })
      .catch(() => showNotice("Records added! Open your site's domain window and press Verify in a few minutes."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The profile opens over whatever page is showing (see openProfile), so that page stays put behind it.
  const profileView = loc.state?.profile;
  const profileOpen = !!profileView;
  const showTabbar = ["/chat/designer", "/chat/designer/build"].includes(loc.pathname) && !isBanned && !isBlocked && !isUnverified;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Pages load on demand. Waiting for one here, instead of at the app's top level, keeps the
          profile popup below mounted, so it can close when a button in it opens a page. */}
      {isBanned || isBlocked ? (
        <BanScreen banned={isBanned} until={blockedUntil} reason={shell.credits?.blockReason} />
      ) : isUnverified ? (
        <VerifyEmailScreen email={shell.currentUser?.email || ""} />
      ) : (
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      )}

      <Profile
        open={profileOpen}
        initialView={profileView || "main"}
        onClose={closeProfile}
        onMonitor={() => navigate("/chat/monitor", { replace: true })}
        onPromos={() => navigate("/chat/promos", { replace: true })}
      />
      <TeamWelcomePopup onAddPeople={() => openProfile("membership")} />
      <PromoExpiredPopup />
      {showTabbar && (
        <MobileTabBar
          active={loc.pathname}
          onChat={shell.goHome}
          onCode={shell.goCode}
          onDesigner={shell.goDesigner}
          onSettings={() => openProfile("main")}
          profileOpen={profileOpen}
        />
      )}
    </div>
  );
}

export default function Chat() {
  return (
    <AppShellProvider>
      <MotionPrefs>
        <ChatLayout />
      </MotionPrefs>
    </AppShellProvider>
  );
}
