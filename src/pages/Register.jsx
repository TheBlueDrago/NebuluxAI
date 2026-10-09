import { playSplashAfterLogin } from "@/components/Splash";
import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { googleLogin } from "@/lib/googleLogin";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { passwordProblem } from "@/lib/passwordCheck";
import PasswordHint from "@/components/PasswordHint";
import ShowPasswordButton from "@/components/ShowPasswordButton";
import { markSessionOnly } from "@/lib/sessionOnly";
import EmailTypoHint, { useEmailTypo } from "@/components/EmailTypoHint";
import usePageTitle from "@/hooks/usePageTitle";
import Turnstile, { useTurnstileOn } from "@/components/Turnstile";

export default function Register() {
  usePageTitle("Create your account");
  // ?verify=<email>: an account that signed up but never entered its code, sent here instead of
  // into the site (lib/AuthContext.jsx). It goes straight to the code screen.
  const [verifyOnly] = useState(() => new URLSearchParams(window.location.search).get("verify") || "");
  const [email, setEmail] = useState(verifyOnly);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(!!verifyOnly);
  const [otpCode, setOtpCode] = useState("");
  const typo = useEmailTypo(email);
  // The "I'm not a robot" check (components/Turnstile.jsx), once the owner switches it on.
  const robotCheck = useRef(null);
  const robotOn = useTurnstileOn();
  const [robotToken, setRobotToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const weak = passwordProblem(password, email);
    if (weak) {
      setError(weak);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (typo.pauseForTypo()) return; // the sign-up code would go to the misspelled address
    if (robotOn && !robotToken) {
      setError("Please finish the \"I'm not a robot\" check first.");
      return;
    }
    setLoading(true);
    try {
      // A failed check must never block sign-up (Base44's register refuses existing accounts anyway).
      const check = await base44.functions.invoke("check-email", { email }).catch(() => null);
      const status = check?.data?.status;
      if (status === "deleted") {
        setError("This AI email account has been deleted.");
        return;
      }
      if (status === "network-limit") {
        setError("Too many accounts have been made on this network recently. Try again later, or contact us if you need an account.");
        return;
      }
      if (status === "removed") {
        setError("This email can't be used to sign up for Nebulux AI.");
        return;
      }
      if (status === "exists") {
        setError("An account with this email already exists. Try logging in.");
        return;
      }
      await base44.auth.register({ email, password, ...(robotToken ? { turnstile_token: robotToken } : {}) });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
      robotCheck.current?.reset(); // each answer works once
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        markSessionOnly(false); // a new account stays signed in, like "Remember me"
      }
      playSplashAfterLogin();
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    googleLogin(safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={verifyOnly ? `Confirm ${email} to get in: tap Resend for a code, then enter it.` : `We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Free: all 4 AIs, 3 websites and unlimited games · No credit card needed"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (safeReturnTo() !== "/" ? "?returnTo=" + encodeURIComponent(safeReturnTo()) : "")}
            className="text-primary font-medium hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
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

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

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
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12"
              aria-describedby="password-hint"
              required
            />
            <ShowPasswordButton shown={showPw} onToggle={() => setShowPw((v) => !v)} />
          </div>
          <PasswordHint id="password-hint" password={password} email={email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Turnstile ref={robotCheck} onToken={setRobotToken} className="flex justify-center" />
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          By creating an account (with Google or email) you confirm you're 13 or older, with a parent or guardian's permission if you're under 18, and
          agree to the{" "}
          <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link> and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>. See how we keep you safe:{" "}
          <Link to="/safety" className="underline hover:text-foreground">Trust &amp; safety</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}