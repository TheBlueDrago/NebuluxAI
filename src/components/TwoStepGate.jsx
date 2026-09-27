import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { signOut } from "@/lib/signOut";

// After signing in: if the account has two-step verification on (TwoStepPanel), ask for a code
// from the authenticator app, unless this device was remembered. Passing once is enough for the
// rest of this visit (until the browser is closed).
const deviceKey = (id) => `nx-2fa-device:${id}`;
const sessionKey = (id) => `nx-2fa-ok:${id}`;

export default function TwoStepGate({ user, onDone }) {
  const [need, setNeed] = useState(null);
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        if (sessionStorage.getItem(sessionKey(user.id)) === "1") return setNeed(false);
      } catch {
        // Storage blocked.
      }
      let device = "";
      try {
        device = localStorage.getItem(deviceKey(user.id)) || "";
      } catch {
        // Storage blocked.
      }
      try {
        const r = await base44.functions.invoke("two-step", { action: device ? "device" : "status", device });
        if (!alive) return;
        setNeed(device ? !r.data?.ok : !!r.data?.enabled);
      } catch {
        if (alive) setNeed(false); // the check failed: don't lock people out of their account
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (need === false) onDone?.();
  }, [need, onDone]);

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || !need) return;
    root.inert = true;
    return () => {
      root.inert = false;
    };
  }, [need]);

  if (!need) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await base44.functions.invoke("two-step", { action: "check", code, remember });
      try {
        if (r.data?.device) localStorage.setItem(deviceKey(user.id), r.data.device);
        sessionStorage.setItem(sessionKey(user.id), "1");
      } catch {
        // Fine: asked again next visit.
      }
      setNeed(false);
    } catch (e2) {
      setErr(e2?.response?.data?.error || "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/85 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="twostep-title" className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center shadow-2xl">
        <ShieldCheck className="mx-auto w-10 h-10 text-emerald-400" />
        <h2 id="twostep-title" className="mt-2 text-lg font-semibold text-white">
          Two-step verification
        </h2>
        <p className="mt-1 text-sm text-slate-400">Type the 6-digit code from your authenticator app.</p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          aria-label="6-digit code"
          className="mt-4 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-center text-xl tracking-widest text-white outline-none focus:border-indigo-400"
        />
        <label className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
          Remember me on this device
        </label>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-[#fff] disabled:opacity-40">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify
        </button>
        <button type="button" onClick={() => signOut("/")} className="mt-3 text-xs text-slate-400 hover:text-white">
          Sign out
        </button>
        <p className="mt-3 text-[11px] text-slate-500">Lost your phone? Contact us at support@nebuluxai.com from your account's email.</p>
      </form>
    </div>,
    document.body
  );
}
