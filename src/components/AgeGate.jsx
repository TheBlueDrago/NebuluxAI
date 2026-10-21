import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import BlackholeIcon from "@/components/BlackholeIcon";

// The birthday, asked once after sign-in (functions/.../age.js, cloudflare-lib/agegate.js). It never
// says the age it's for. Accounts below the minimum age see a "not available yet" screen until then.
// Not on the public pages people open to play or view something.
const SKIP = /^\/(login|register|forgot-password|reset-password|site\/|play\/|connect\/|terms|privacy|report|safety)/;

export default function AgeGate() {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(null); // { needBirth, blocked }
  const [birth, setBirth] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || SKIP.test(window.location.pathname)) return;
    let alive = true;
    base44.functions.invoke("age", { action: "get" }).then((r) => alive && setState(r?.data || null)).catch(() => {});
    return () => { alive = false; };
  }, [isAuthenticated]);
  if (!state || (!state.needBirth && !state.blocked)) return null;

  const save = async () => {
    if (!birth) return setErr("Pick your birthday.");
    if (!window.confirm(`Is ${new Date(birth + "T12:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} right? You can't change it later.`)) return;
    setBusy(true);
    setErr("");
    try {
      const r = await base44.functions.invoke("age", { action: "set", birth });
      setState({ needBirth: false, blocked: !!r?.data?.blocked });
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't save it. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 p-6 text-center text-slate-100 shadow-2xl">
        <BlackholeIcon className="w-14 h-14 mx-auto mb-4" />
        {state.blocked ? (
          <>
            <h2 className="text-xl font-semibold">Your account isn't available yet</h2>
            <p className="mt-2 text-sm text-slate-400">Nebulux AI isn't available for your account right now. Check back later!</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">When's your birthday?</h2>
            <p className="mt-2 text-sm text-slate-400">This helps us set up your account. You can only enter it once, so make sure it's right.</p>
            <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} className="mt-5 w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2.5 text-center" />
            {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
            <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Continue"}</button>
          </>
        )}
      </div>
    </div>
  );
}
