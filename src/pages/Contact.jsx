import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, Loader2, CheckCircle2, Briefcase, Handshake } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PublicLayout from "@/components/PublicLayout";
import Honeypot from "@/components/Honeypot";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_LINK } from "@/lib/company";
import EmailTypoHint, { useEmailTypo } from "@/components/EmailTypoHint";
import EmailText from "@/components/EmailText";

// Keys must match TOPICS in cloudflare-lib/contact.js.
const TOPICS = [
  ["account", "Account or sign-in"],
  ["billing", "Plans, credits or payments"],
  ["bug", "Something isn't working"],
  ["ai", "A problem with an AI reply"],
  ["security", "A security problem or scam"],
  ["parent", "I'm a parent or teacher"],
  ["idea", "Idea or feedback"],
  ["business", "Using Nebulux AI for my business"],
  ["partnership", "Partnership, investment or acquisition"],
  ["other", "Something else"],
];

// Public: people can write to the Nebulux AI team; messages show in Monitor →
// Messages (functions/contact.js). Signed-in users are replied to at their account email.
export default function Contact() {
  const [signedInEmail, setSignedInEmail] = useState("");
  // Links can pick the topic (/contact?topic=business from the For business page).
  const [topic, setTopic] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("topic");
    return TOPICS.some(([k]) => k === t) ? t : "other";
  });
  const [email, setEmail] = useState("");
  const [otherEmail, setOtherEmail] = useState(false); // signed in, but wants the reply somewhere else
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const typo = useEmailTypo(email);

  useEffect(() => {
    base44.auth.me().then((u) => setSignedInEmail(u?.email || "")).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Write a little more so we know how to help (at least 5 characters).");
      return;
    }
    const useTyped = !signedInEmail || otherEmail;
    if (useTyped && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address we should reply to.");
      return;
    }
    if (useTyped && typo.pauseForTypo()) return; // our reply would go to the misspelled address
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("contact", { action: "send", topic, message, email: signedInEmail && !otherEmail ? signedInEmail : email.trim(), website });
      if (res.data?.error) setError(res.data.error);
      else setSent(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Could not send the message. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-400";

  return (
    <PublicLayout title="Contact us">
      <section className="text-center pt-10 pb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-white">Contact us</h1>
        <p className="mt-3 text-slate-400 text-lg max-w-xl mx-auto">Questions, ideas, help with your account, or business: we'd love to hear from you.</p>
      </section>
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-4 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 hover:border-indigo-500/50">
            <span className="w-12 h-12 shrink-0 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center"><Mail className="w-6 h-6 text-indigo-300" /></span>
            <span className="min-w-0">
              <span className="block text-sm text-slate-400">Email us</span>
              <EmailText email={CONTACT_EMAIL} className="block text-white text-sm sm:text-base font-medium" />
            </span>
          </a>
          <a href={CONTACT_PHONE_LINK} className="flex items-center gap-4 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 hover:border-indigo-500/50">
            <span className="w-12 h-12 shrink-0 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center"><Phone className="w-6 h-6 text-indigo-300" /></span>
            <span>
              <span className="block text-sm text-slate-400">Call or text</span>
              <span className="block text-white font-medium">{CONTACT_PHONE}</span>
            </span>
          </a>
          <button type="button" onClick={() => setTopic("business")} className="w-full text-left flex items-center gap-4 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 hover:border-indigo-500/50">
            <span className="w-12 h-12 shrink-0 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center"><Briefcase className="w-6 h-6 text-sky-300" /></span>
            <span>
              <span className="block text-white font-medium">For your business</span>
              <span className="block text-sm text-slate-400">Websites, selling online, teams</span>
            </span>
          </button>
          <button type="button" onClick={() => setTopic("partnership")} className="w-full text-left flex items-center gap-4 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 hover:border-indigo-500/50">
            <span className="w-12 h-12 shrink-0 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center"><Handshake className="w-6 h-6 text-fuchsia-300" /></span>
            <span>
              <span className="block text-white font-medium">Partners, investors and acquirers</span>
              <span className="block text-sm text-slate-400">Let's talk</span>
            </span>
          </button>
        </div>
        <div className="lg:col-span-3 bg-slate-900/80 border border-slate-700/60 rounded-3xl p-6 sm:p-8">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h2 className="text-xl font-semibold text-white">Message sent</h2>
              <p className="text-sm text-slate-400">Thanks — we'll reply to {signedInEmail || email}.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="relative space-y-4">
              <Honeypot value={website} onChange={setWebsite} />
              <h2 className="text-xl font-semibold text-white">Send us a message</h2>
              <label className="block text-sm">
                <span className="text-slate-400">What's it about?</span>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
                  {TOPICS.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>
              {signedInEmail && !otherEmail ? (
                <p className="text-sm text-slate-400">
                  We'll reply to <span className="text-slate-200">{signedInEmail}</span>.{" "}
                  <button type="button" onClick={() => setOtherEmail(true)} className="text-indigo-300 underline hover:text-indigo-200">
                    Use a different email
                  </button>
                </p>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="text-slate-400">Your email (so we can reply)</span>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} {...typo.fieldProps} autoComplete="email" className={field} />
                  </label>
                  <EmailTypoHint suggestion={typo.suggestion} onPick={setEmail} className="-mt-3 text-xs text-slate-400" linkClassName="text-slate-200" />
                </>
              )}
              <label className="block text-sm">
                <span className="text-slate-400">Message</span>
                <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} className={`${field} resize-none`} />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                We'll never ask for your password or card number. To report a published site or game, use the Report link on it. See our{" "}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
