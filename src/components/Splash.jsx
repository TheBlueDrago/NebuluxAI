import React, { useEffect, useState } from "react";
import Intro from "@/components/Intro";

const SEEN_KEY = "bh-splash-seen";
// Set just before a sign-in finishes (Login, Register, Continue with Google): the intro plays
// on the page they land on. Visitors who aren't signed in never see it.
export const SPLASH_AFTER_LOGIN = "bh-splash-login";
export const playSplashAfterLogin = () => { try { sessionStorage.setItem(SPLASH_AFTER_LOGIN, "1"); } catch { /* storage blocked */ } };
const signedIn = () => { try { return !!JSON.parse(localStorage.getItem("bh-me") || "null")?.id; } catch { return false; } };
// No intro on pages people open to get one thing done (often from a published site or
// game), or on the public info pages, which should show up right away. The home page does get it.
const SKIP = /^\/(buy|report|site\/|play\/|terms|privacy|contact|ThankYou|promo-success|arcade|templates|pricing|business|about|showcase|enterprise|guides|safety|whats-new|ideas)/;

// The intro plays right after signing in, and when someone who's signed in opens the site in a
// new tab (once per tab, not on every reload). Not for visitors who aren't signed in.
function shouldShow() {
  // Not on the sign-in pages themselves (like coming back from a cancelled Google sign-in).
  if (/^\/(login|register|forgot-password|reset-password)/.test(window.location.pathname)) return false;
  let justLoggedIn = false;
  try { justLoggedIn = !!sessionStorage.getItem(SPLASH_AFTER_LOGIN); sessionStorage.removeItem(SPLASH_AFTER_LOGIN); } catch { /* storage blocked */ }
  if (!justLoggedIn && !signedIn()) return false;
  if (SKIP.test(window.location.pathname)) return false;
  // Not in the installed app (home screen): the phone starts it fresh on almost every launch,
  // so it would play the 4.7-second intro every time someone opens it.
  if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true) return false;
  // Devices set to reduce motion skip the animated intro altogether.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    if (!justLoggedIn && sessionStorage.getItem(SEEN_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked: show it, as before.
  }
  return true;
}

// Shows for about 4 seconds, then fades out over 0.6s (a CSS transition, no animation library).
export default function Splash() {
  const [phase, setPhase] = useState(() => (shouldShow() ? "show" : "gone"));
  // Both timers start once, on mount (re-running on each phase change would cancel the second).
  useEffect(() => {
    if (phase !== "show") return;
    const fade = setTimeout(() => setPhase("leaving"), 4100);
    const done = setTimeout(() => setPhase("gone"), 4700);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === "gone") return null;
  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-[600ms] ease-in-out ${phase === "leaving" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <Intro />
    </div>
  );
}
