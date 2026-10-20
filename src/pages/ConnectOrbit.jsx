import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldCheck, Orbit } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { appParams } from "@/lib/app-params";
import AuthLayout from "@/components/AuthLayout";

// "Sign in with Nebulux" for Nebulux Orbit (functions/v1/orbit.js). The Orbit site sends people here
// with ?return=<its address>. After they press Allow, a one-time code goes back to Orbit, which trades
// it for its own sign-in. Orbit gets the person's name only: no chats, files, payments or password.
const ORBIT_SITES = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev(\/|$)/,/^https:\/\/([a-z0-9-]+\.)?nebulux-orbit\.pages\.dev(\/|$)/, /^https:\/\/orbit\.nebuluxai\.com(\/|$)/, /^http:\/\/localhost(:\d+)?(\/|$)/];

export default function ConnectOrbit() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const back = new URLSearchParams(window.location.search).get("return") || "";
  const okReturn = ORBIT_SITES.some((r) => r.test(back));

  if (isLoadingAuth) return <AuthLayout><div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div></AuthLayout>;
  if (!isAuthenticated) return <Navigate to={"/login?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search)} replace />;

  const allow = async () => {
    setBusy(true);
    setError("");
    try {
      const token = appParams.token || localStorage.getItem("base44_access_token") || "";
      const r = await fetch("/v1/orbit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ action: "link" }) });
      const d = await r.json();
      if (!r.ok || !d.code) throw new Error(d.error || "Couldn't connect.");
      const u = new URL(back);
      u.searchParams.set("code", d.code);
      window.location.href = u.toString();
    } catch (e) {
      setError(e.message || "Couldn't connect.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
          <Orbit className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-semibold">Sign in to Nebulux Orbit</h1>
        {!okReturn ? (
          <p className="mt-3 text-sm text-red-300">This sign-in link isn't from Nebulux Orbit, so it was stopped.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-400">Signed in as <b>{user?.full_name || user?.email}</b></p>
            <ul className="mt-5 space-y-2 text-left text-sm text-slate-300">
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> Orbit gets your name to sign you in.</li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> It can't see your chats, files, payments or password.</li>
              <li className="flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> Orbit has its own free credits, separate from Nebulux AI's.</li>
            </ul>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={() => (window.location.href = back)} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm hover:bg-white/5">Cancel</button>
              <button onClick={allow} disabled={busy} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Connecting…" : "Allow"}
              </button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
