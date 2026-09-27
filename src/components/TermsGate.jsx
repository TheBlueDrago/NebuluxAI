import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BlackholeIcon from "@/components/BlackholeIcon";
import { signOut } from "@/lib/signOut";

// The user agreement: the first time an account opens the app (and again if the Terms change a
// lot), it must be accepted before going further. Recorded on the server
// (functions/.../accept-terms.js); remembered on this device so it isn't asked for every visit.
const monthName = (v) => new Date(`${v}-15T00:00:00Z`).toLocaleDateString([], { month: "long", year: "numeric" });
const dayName = (iso) => new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
const seenKey = (id, v) => `nx-terms:${id}:${v}`;
// The agreement's version when the server can't be asked (keep in step with accept-terms.js).
const FALLBACK_VERSION = "2026-09-27";

const POINTS = [
  "You're 13 or older. If you're under 18, a parent or guardian agrees to these terms with you.",
  "Be kind and safe: no bullying, hate, threats, adult content, scams or anything illegal, in chats or in websites and games you make.",
  "Never share passwords, card numbers or private details (your address, school or phone number) with the AI or on pages you publish.",
  "The AI can make mistakes. Check important answers, and don't rely on it for medical, legal or money decisions.",
  "Websites and games you publish are public. You're responsible for them, and we can take down anything that breaks the rules.",
  "We never store your password or card: Base44 keeps passwords scrambled, and our payment provider (Base44 Payments, run by Wix) keeps your card and charges it for renewals. We never sell your data. See the Privacy Policy for what we collect and why.",
];

export default function TermsGate({ user, onDone }) {
  const [need, setNeed] = useState(null); // null = checking, "" = fine, else the version to accept
  const [meta, setMeta] = useState({});
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    base44.functions
      .invoke("accept-terms", { action: "get" })
      .then((r) => {
        if (!alive) return;
        const { accepted, version, returning, deadline } = r.data || {};
        setMeta({ returning, deadline });
        let seen = false;
        try {
          seen = localStorage.getItem(seenKey(user.id, version)) === "1";
        } catch {
          // Storage blocked: the server's answer decides.
        }
        setNeed(accepted || seen ? "" : version);
      })
      .catch(() => {
        // The check didn't answer: accepted on this device before is enough; otherwise ask.
        if (!alive) return;
        let seen = false;
        try {
          seen = localStorage.getItem(seenKey(user.id, FALLBACK_VERSION)) === "1";
        } catch {
          // Storage blocked.
        }
        setNeed(seen ? "" : FALLBACK_VERSION);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (need === "") onDone?.();
  }, [need, onDone]);

  // While it's open, the app behind it can't be clicked, tabbed to or typed in: no agreeing, no app.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || !need) return;
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
    return () => {
      root.inert = false;
      root.removeAttribute("aria-hidden");
    };
  }, [need]);

  if (!need) return null;

  const accept = () => {
    setBusy(true);
    setErr("");
    base44.functions
      .invoke("accept-terms", { action: "accept", version: need })
      .then(() => {
        try {
          localStorage.setItem(seenKey(user.id, need), "1");
        } catch {
          // Fine: the server has it.
        }
        setNeed("");
      })
      .catch((e) => {
        // The agreement changed while it was open: read the new one.
        if (e?.response?.status === 409) {
          setErr(e.response.data?.error || "The terms were just updated. Reload the page and read them again.");
          return;
        }
        // They did agree; the server just didn't answer. Remember it here so they aren't stuck.
        try {
          localStorage.setItem(seenKey(user.id, need), "1");
        } catch {
          // Storage blocked.
        }
        setNeed("");
      })
      .finally(() => setBusy(false));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 p-6 text-slate-200 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
            <BlackholeIcon className="w-full h-full" />
          </span>
          <div>
            <h2 id="terms-title" className="text-lg font-semibold text-white">{meta.returning ? `New terms for ${monthName(need)}` : "Welcome to Nebulux AI"}</h2>
            <p className="text-sm text-slate-400">{meta.returning ? "Our user agreement is renewed every month. Please read it and accept it again to keep using Nebulux AI." : "Before you start, please read and accept our user agreement."}</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2.5 text-sm">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-2.5">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <label className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-800/70 border border-slate-700 p-3 text-sm cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-500" />
          <span>
            I have read and agree to the{" "}
            <Link to="/terms" target="_blank" className="text-indigo-300 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" className="text-indigo-300 underline">
              Privacy Policy
            </Link>
            , and I understand that I take full responsibility for how I use Nebulux AI and for everything I make, publish or share with it. I'm allowed to use it (if I'm under 18, a parent or guardian said yes).
          </span>
        </label>
        {meta.deadline && (
          <p className="mt-3 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-200">
            Please accept by <b>{dayName(meta.deadline)}</b>. Accounts that don't accept within 30 days are deleted as inactive.
          </p>
        )}
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => signOut("/")}
            className="px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800"
          >
            I don't agree (sign out)
          </button>
          <button
            type="button"
            disabled={!checked || busy}
            onClick={accept}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-[#fff] disabled:opacity-40"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Accept and continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
