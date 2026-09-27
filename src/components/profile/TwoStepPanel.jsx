import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, Smartphone, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Account settings → Two-step verification: codes by email, or from an authenticator app. When
// it's on, signing in asks for a code unless "Remember me on this device" was ticked (TwoStepGate).
const call = (body) =>
  base44.functions.invoke("two-step", body).then(
    (r) => r.data,
    (e) => {
      throw new Error(e?.response?.data?.error || "Something went wrong. Try again.");
    }
  );

export default function TwoStepPanel({ onBack }) {
  const [st, setSt] = useState(null); // { enabled, method, email }
  const [mode, setMode] = useState(""); // "", "email" or "app" while turning it on
  const [setup, setSetup] = useState(null); // app: { secret, qr }
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    call({ action: "status" })
      .then(setSt)
      .catch((e) => setErr(e.message));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = () =>
    run(async () => {
      const r = await call({ action: "send" });
      setSentTo(r.email);
    });

  const startApp = () =>
    run(async () => {
      const r = await call({ action: "setup" });
      const QR = await import("qrcode");
      const qr = await QR.toDataURL(r.uri, { width: 360, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } });
      setSetup({ ...r, qr });
      setMode("app");
    });

  const finish = (action) =>
    run(async () => {
      const r = await call({ action, code });
      setSt((s) => ({ ...s, enabled: !!r.enabled, method: r.enabled ? (action === "enable-email" ? "email" : "app") : null }));
      setMode("");
      setSetup(null);
      setSentTo("");
      setCode("");
      setMsg(r.enabled ? "Two-step verification is on. You'll be asked for a code when you sign in." : "Two-step verification is off.");
    });

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
  const ready = code.replace(/\D/g, "").length === 6;
  const btn = "w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold disabled:opacity-40";

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-300" /> Two-step verification
      </h3>
      <p>Even if someone learns your password, they can't get in without a code only you can get.</p>
      {msg && <p className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2 text-emerald-200">{msg}</p>}

      {!st ? (
        <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
      ) : st.enabled ? (
        <div className="space-y-3">
          <p className="font-medium text-emerald-300">On ({st.method === "email" ? `codes are emailed to ${st.email}` : "codes come from your authenticator app"})</p>
          <p>To turn it off, enter a code{st.method === "email" ? " we email you" : " from your app, or one we email you"}:</p>
          <button type="button" disabled={busy} onClick={sendEmail} className="text-indigo-300 underline hover:text-indigo-200">
            {sentTo ? `Code sent to ${sentTo}. Send another` : "Email me a code"}
          </button>
          {codeBox}
          <button disabled={busy || !ready} onClick={() => finish("disable")} className={`${btn} bg-slate-700 hover:bg-slate-600 text-white`}>
            Turn off
          </button>
        </div>
      ) : mode === "" ? (
        <div className="space-y-3">
          <p className="font-medium text-slate-400">Off. How do you want to get your codes?</p>
          <button disabled={busy} onClick={() => { setMode("email"); sendEmail(); }} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-[#fff]`}>
            <Mail className="w-4 h-4" /> Email me a code ({st.email})
          </button>
          <button disabled={busy} onClick={startApp} className={`${btn} bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white`}>
            <Smartphone className="w-4 h-4" /> Use an authenticator app (safer)
          </button>
          <p className="text-xs text-slate-500">Authenticator apps: Google Authenticator, Microsoft Authenticator or Authy (all free).</p>
        </div>
      ) : mode === "email" ? (
        <div className="space-y-3">
          <p>{sentTo ? <>We emailed a code to <b>{sentTo}</b>. It works for 10 minutes. Check spam if you don't see it.</> : "Sending a code to your email…"}</p>
          {codeBox}
          <button disabled={busy || !ready} onClick={() => finish("enable-email")} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-[#fff]`}>
            Turn on email codes
          </button>
          <button type="button" disabled={busy} onClick={sendEmail} className="text-xs text-indigo-300 underline">
            Send a new code
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
          <button disabled={busy || !ready} onClick={() => finish("enable")} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-[#fff]`}>
            Turn on two-step verification
          </button>
        </div>
      )}
      {mode && !st?.enabled && (
        <button type="button" onClick={() => { setMode(""); setSetup(null); setCode(""); setErr(""); }} className="text-xs text-slate-400 hover:text-white">
          Choose the other way
        </button>
      )}
      {err && <p className="text-red-400">{err}</p>}
    </div>
  );
}
