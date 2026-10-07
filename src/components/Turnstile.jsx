import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { getPublicSettings } from "@/api/base44Client";

// Cloudflare Turnstile, the "I'm not a robot" check (cloudflare-lib/turnstile.js). Shows nothing
// until the owner switches it on (the site key comes from the public settings); then it renders
// Cloudflare's widget, which most people pass without clicking anything.
// onToken(token) gets each fresh answer ("" when it expires). ref.reset() asks for a new one
// (each answer works once, so after every submit).
let siteKey; // undefined: not asked yet
let keyPromise;
const loadKey = () =>
  (keyPromise ||= getPublicSettings()
    .then((s) => (siteKey = s?.public_settings?.turnstile_site_key || null))
    .catch(() => (siteKey = null)));

let scriptPromise;
const loadScript = () =>
  (scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(s);
  }));

// Whether the check is switched on: null while finding out.
export function useTurnstileOn() {
  const [on, setOn] = useState(siteKey === undefined ? null : !!siteKey);
  useEffect(() => {
    if (on === null) loadKey().then((k) => setOn(!!k));
  }, [on]);
  return on;
}

const Turnstile = forwardRef(function Turnstile({ onToken, className = "" }, ref) {
  const box = useRef(null);
  const id = useRef(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const on = useTurnstileOn();

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current?.("");
      if (id.current != null && window.turnstile) window.turnstile.reset(id.current);
    },
  }));

  useEffect(() => {
    if (!on) return undefined;
    let gone = false;
    loadScript()
      .then((t) => {
        if (gone || !box.current) return;
        id.current = t.render(box.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (tok) => cb.current?.(tok),
          "expired-callback": () => cb.current?.(""),
          "error-callback": () => cb.current?.(""),
        });
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (id.current != null && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [on]);

  if (!on) return null;
  return <div ref={box} className={`min-h-[65px] ${className}`} />;
});

export default Turnstile;
