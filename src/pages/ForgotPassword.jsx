import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import EmailTypoHint, { useEmailTypo } from "@/components/EmailTypoHint";
import usePageTitle from "@/hooks/usePageTitle";
import Turnstile, { useTurnstileOn } from "@/components/Turnstile";

export default function ForgotPassword() {
  usePageTitle("Forgot password");
  const [email, setEmail] = useState("");
  const typo = useEmailTypo(email);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const robotCheck = useRef(null);
  const robotOn = useTurnstileOn();
  const [robotToken, setRobotToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (typo.pauseForTypo()) return; // a reset link sent to gmial.com never arrives
    if (robotOn && !robotToken) {
      setError("Please finish the \"I'm not a robot\" check first.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email, robotToken);
      setSent(true);
    } catch (err) {
      // Too many reset emails asked for (cloudflare-lib/authlimit.js): say so rather than
      // promise an email that won't come. That limit applies whether or not the account
      // exists, so it gives nothing away. Any other error still shows the usual message.
      if (err?.status === 429) setError(err.message || "Too many tries. Please wait up to an hour and try again.");
      else if (err?.code === "turnstile") {
        setError(err.message);
        robotCheck.current?.reset();
      }
      else setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send you a link to reset it"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center">
          If an account exists with that email, you'll receive a password reset link shortly.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
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
          <Turnstile ref={robotCheck} onToken={setRobotToken} className="flex justify-center" />
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
