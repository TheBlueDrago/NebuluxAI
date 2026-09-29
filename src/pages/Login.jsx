import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { googleLogin } from "@/lib/googleLogin";
import BlackholeIcon from "@/components/BlackholeIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import ShowPasswordButton from "@/components/ShowPasswordButton";
import EmailTypoHint, { useEmailTypo } from "@/components/EmailTypoHint";
import { markSessionOnly, signedOutNote, forgetSignedOutNote } from "@/lib/sessionOnly";
import usePageTitle from "@/hooks/usePageTitle";

// Why you were just signed out (set by the sign-out buttons and at start-up).
const SIGNED_OUT_NOTES = {
  "signed-out": "You're signed out. Your chats come back when you sign in here again.",
  cleared: "You're signed out, and your chats, projects and settings were removed from this browser.",
  closed: "You were signed out because the browser was closed and \"Remember me\" was off. Chats saved on this computer were cleared.",
};

export default function Login() {
  usePageTitle("Sign in");
  const [email, setEmail] = useState("");
  const typo = useEmailTypo(email);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Back from "Continue with Google" while the new sign-in doesn't have it yet (functions/api/[[path]].js).
  const [error, setError] = useState(() => {
    const g = new URLSearchParams(window.location.search).get("google");
    if (g === "soon") return "Signing in with Google is coming back soon. For now, log in with your email and password (or tap Forgot password to set one).";
    if (g === "failed") return "Signing in with Google didn't work. Please try again, or log in with your email and password.";
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem("infinity-ai-remember") !== "0");
  const [note] = useState(() => SIGNED_OUT_NOTES[signedOutNote()] || "");
  useEffect(forgetSignedOutNote, []);
  // Post-login destination (same-origin paths only).
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      markSessionOnly(!remember);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // Set before leaving for Google: the session cookie lasts through the round trip.
    markSessionOnly(!remember);
    googleLogin(returnTo);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BlackholeIcon className="w-full h-full" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center">Sign in to Nebulux AI</h1>
          <p className="text-slate-400 text-sm text-center mt-1.5">Welcome back</p>
          {note && (
            <p role="status" className="mt-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-slate-300 text-sm text-center">
              {note}
            </p>
          )}

          <button
            onClick={handleGoogle}
            className="w-full mt-6 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-800 border border-slate-700/50 text-slate-200 text-sm font-medium hover:bg-slate-700/70 transition-colors"
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-400">or</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-slate-300 text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...typo.fieldProps}
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-800/70 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500/60 text-sm"
                  required
                />
              </div>
              <EmailTypoHint suggestion={typo.suggestion} onPick={setEmail} className="text-xs text-slate-400" linkClassName="text-slate-200" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-xs text-indigo-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-800/70 border border-slate-700/50 text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500/60 text-sm"
                  required
                />
                <ShowPasswordButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  localStorage.setItem("infinity-ai-remember", e.target.checked ? "1" : "0");
                }}
                className="w-4 h-4 accent-indigo-500"
              />
              Remember me
            </label>
            {!remember && (
              <p className="text-xs text-slate-400 -mt-1">
                Shared computer? You'll be signed out when the browser closes, and your chats saved in it will be cleared.
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-indigo-400 font-medium hover:underline"
          >
            Create one
          </Link>
        </p>
        <p className="text-center text-slate-400 text-xs mt-3">
          <Link to="/showcase" className="hover:underline">See what people built</Link> ·{" "}
          <Link to="/terms" className="hover:underline">Terms</Link> ·{" "}
          <Link to="/privacy" className="hover:underline">Privacy</Link>
        </p>
        {/* A phishing page can copy this screen, but not the address bar. */}
        <p className="text-center text-slate-400 text-xs mt-3 px-2">
          <Lock className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-emerald-400" />
          Only sign in at <span className="text-slate-300">nebuluxai.com</span>. We never ask for your password anywhere else.{" "}
          <Link to="/safety" className="hover:underline">Trust &amp; safety</Link>
        </p>
      </div>
    </div>
  );
}