import React, { useEffect, useState } from "react";
import Intro from "@/components/Intro";

const SEEN_KEY = "bh-splash-seen";
// No intro on pages people open to get one thing done (often from a published site or
// game), or on the public info pages, which should show up right away. The home page does get it.
const SKIP = /^\/(buy|report|site\/|play\/|terms|privacy|contact|ThankYou|promo-success|arcade|templates|pricing|business|about|showcase|enterprise|guides|safety|whats-new|ideas)/;

// The intro plays once per browser tab, not again on every reload.
function shouldShow() {
  if (SKIP.test(window.location.pathname)) return false;
  // Not in the installed app (home screen): the phone starts it fresh on almost every launch,
  // so it would play the 4.7-second intro every time someone opens it.
  if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true) return false;
  // Devices set to reduce motion skip the animated intro altogether.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return false;
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
