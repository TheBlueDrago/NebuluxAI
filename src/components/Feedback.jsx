import React, { useEffect, useState } from "react";
import { Bug, Lightbulb, Loader2, CheckCircle2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// "Report a bug / request a feature": one tap from anywhere (openFeedback()), then a short box.
// It goes to the owner the same way as the Contact page (functions/.../contact.js): the Monitor's
// Messages list and a copy by email. Signed-in people don't have to type an email address.
export const openFeedback = (kind) => window.dispatchEvent(new CustomEvent("nebulux-feedback", { detail: kind === "idea" ? "idea" : "bug" }));

export function FeedbackButton({ className = "", children }) {
  return (
    <button type="button" onClick={() => openFeedback("bug")} className={className} data-feedback-button>
      {children || "Report a bug / request a feature"}
    </button>
  );
}

export default function Feedback() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("bug");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // left empty by people (a trap for bots)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const on = (e) => { setKind(e.detail === "idea" ? "idea" : "bug"); setError(""); setSent(false); setOpen(true); };
    window.addEventListener("nebulux-feedback", on);
    return () => window.removeEventListener("nebulux-feedback", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;

  const send = async (e) => {
    e.preventDefault();
    if (text.trim().length < 5) return setError("Please write a little more.");
    setBusy(true);
    setError("");
    try {
      // where it happened helps find a bug; no private data, only the page's address
      const message = `${text.trim()}\n\n(Sent from ${window.location.pathname})`;
      const res = await base44.functions.invoke("contact", { action: "send", topic: kind, message, email: user?.email || email.trim(), website });
      if (res.data?.error) throw new Error(res.data.error);
      setSent(true);
      setText("");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Couldn't send it. Please try again.");
    }
    setBusy(false);
  };

  const tab = (id, Icon, label) => (
    <button
      type="button"
      onClick={() => setKind(id)}
      aria-pressed={kind === id}
      className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium ${kind === id ? "bg-white text-slate-900 border-white" : "bg-slate-800 text-slate-200 border-slate-600"}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Report a bug or request a feature" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <form onSubmit={send} className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-100">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-lg font-semibold">{sent ? "Thank you" : "Tell us"}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <p className="mt-3 text-slate-200">Sent. The owner reads every one.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-5 min-h-[44px] px-6 rounded-xl bg-white text-slate-900 font-semibold">Done</button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex gap-2">{tab("bug", Bug, "Report a bug")}{tab("idea", Lightbulb, "Request a feature")}</div>
            <textarea
              aria-label={kind === "bug" ? "What went wrong" : "The feature you'd like"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              rows={4}
              maxLength={1800}
              placeholder={kind === "bug" ? "What went wrong? What did you expect to happen?" : "What would you like Nebulux AI to do?"}
              className="mt-3 w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400"
            />
            {!user && (
              <input
                type="email"
                aria-label="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email, so we can reply"
                autoComplete="email"
                className="mt-2 w-full min-h-[44px] rounded-xl bg-slate-800 border border-slate-600 px-3 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400"
              />
            )}
            <input type="text" name="website" aria-label="Leave this empty" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {error && <p className="mt-2 text-sm text-red-400" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="mt-3 w-full min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send to the owner
            </button>
          </>
        )}
      </form>
    </div>
  );
}
