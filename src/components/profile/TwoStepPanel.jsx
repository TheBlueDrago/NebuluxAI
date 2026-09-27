import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Account settings → Two-step verification: turn on codes from an authenticator app. When it's
// on, signing in asks for a code unless "Remember me on this device" was ticked (TwoStepGate).
const call = (body) =>
  base44.functions.invoke("two-step", body).then(
    (r) => r.data,
    (e) => {
      throw new Error(e?.response?.data?.error || "Something went wrong. Try again.");
    }
  );

export default function TwoStepPanel({ onBack }) {
  const [enabled, setEnabled] = useState(null);
  const [setup, setSetup] = useState(null); // { secret, uri, qr }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    call({ action: "status" })
      .then((r) => setEnabled(!!r.enabled))
      .catch((e) => setErr(e.message));
  }, []);

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await call({ action: "setup" });
      const QR = await import("qrcode");
      const qr = await QR.toDataURL(r.uri, { width: 360, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
      setSetup({ ...r, qr });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action) => {
    setBusy(true);
    setErr("");
    try {
      const r = await call({ action, code });
      setEnabled(!!r.enabled);
      setSetup(null);
      setCode("");
      setMsg(r.enabled ? "Two-step verification is on. You'll be asked for a code when you sign in." : "Two-step verification is off.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const codeBox = (
    <input
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="6-digit code"
      aria-label="6-digit code"
      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-center text-lg tracking-widest text-white outline-none focus:border-indigo-400"
    />
  );

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-300" /> Two-step verification
      </h3>
      <p>Even if someone learns your password, they can't get in without a code from your phone.</p>
      {msg && <p className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2 text-emerald-200">{msg}</p>}
      {enabled === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
      ) : enabled ? (
        <div className="space-y-3">
          <p className="font-medium text-emerald-300">On</p>
          <p>To turn it off, type a code from your authenticator app:</p>
          {codeBox}
          <button disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={() => confirm("disable")} className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 py-2.5 font-semibold text-white disabled:opacity-40">
            Turn off
          </button>
        </div>
      ) : !setup ? (
        <div className="space-y-3">
          <p className="font-medium text-slate-400">Off</p>
          <p className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 mt-0.5 shrink-0 text-indigo-300" /> You need a free authenticator app on your phone, like Google Authenticator, Microsoft Authenticator or Authy.
          </p>
          <button disabled={busy} onClick={start} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 font-semibold text-[#fff] disabled:opacity-40">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Turn on
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p>1. In your authenticator app, tap <b>+</b> and scan this code:</p>
          <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto w-44 h-44 rounded-xl bg-white" />
          <p className="text-xs text-slate-400">
            Can't scan it? Type this key instead: <span className="font-mono text-slate-200 break-all select-all">{setup.secret}</span>
          </p>
          <p>2. Type the 6-digit code the app shows:</p>
          {codeBox}
          <button disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={() => confirm("enable")} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 font-semibold text-[#fff] disabled:opacity-40">
            Turn on two-step verification
          </button>
        </div>
      )}
      {err && <p className="text-red-400">{err}</p>}
    </div>
  );
}
