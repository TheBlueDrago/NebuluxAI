import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { googleLogin } from "@/lib/googleLogin";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    if (g === "check")
      return "Almost done! We emailed you a link. 1) Open the link in the email. 2) Choose your password. 3) Come back to this page and refresh it. 4) Log in with your email and your new password.";
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

  // Same look as the sign-up page (AuthLayout), with everything the login page had.
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to Nebulux AI"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Create one
          </Link>
          <span className="block text-xs mt-3">
            <Link to="/showcase" className="hover:underline">See what people built</Link> ·{" "}
            <Link to="/terms" className="hover:underline">Terms</Link> ·{" "}
            <Link to="/privacy" className="hover:underline">Privacy</Link>
          </span>
          {/* A phishing page can copy this screen, but not the address bar. */}
          <span className="block text-xs mt-3 px-2">
            <Lock className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-emerald-400" />
            Only sign in at <span className="text-slate-300">nebuluxai.com</span>. We never ask for your password anywhere else.{" "}
            <Link to="/safety" className="hover:underline">Trust &amp; safety</Link>
          </span>
        </>
      }
    >
      {note && (
        <p role="status" className="mb-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-slate-300 text-sm text-center">
          {note}
        </p>
      )}

      <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6" onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...typo.fieldProps}
              className="pl-10 h-12"
              required
            />
          </div>
          <EmailTypoHint suggestion={typo.suggestion} onPick={setEmail} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              required
            />
            <ShowPasswordButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
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
          <p className="text-xs text-muted-foreground -mt-1">
            Shared computer? You'll be signed out when the browser closes, and your chats saved in it will be cleared.
          </p>
        )}
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
