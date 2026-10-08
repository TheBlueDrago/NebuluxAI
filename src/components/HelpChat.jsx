import React, { useEffect, useRef, useState } from "react";
import { HelpCircle, Loader2, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Markdown from "@/components/chat/Markdown";

// Help (account menu → Get help): a small chat that only answers questions about using
// Nebulux AI. Free, no credits (functions/.../chatCompletion.js "help", guide in
// cloudflare-lib/helpguide.js). A person is always one click away on the contact page.
const STARTERS = ["How do I publish a website?", "Why can't I open Nebulux Code?", "How do credits work?", "How do I play Bedwars with friends?"];

export default function HelpChat({ open, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef(null);
  const field = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => field.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const ask = async (text) => {
    const q = String(text || input).trim().slice(0, 600);
    if (!q || busy) return;
    setInput("");
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await base44.functions.invoke("chatCompletion", { help: true, prompt: q, history });
      const a = String(r.data?.content || r.data?.text || "").trim() || "Sorry, I couldn't answer that. Try asking another way, or use the contact form.";
      setMsgs((m) => [...m, { role: "assistant", content: a }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e?.response?.data?.error || "Sorry, I couldn't reach the AI. Please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-end sm:items-center justify-center sm:justify-end bg-black/40 sm:bg-transparent sm:pointer-events-none" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="help-title" className="pointer-events-auto flex h-[80dvh] sm:h-[560px] w-full sm:w-[380px] sm:mr-5 flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-bg)] text-[var(--cl-text)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--cl-border)] px-4 py-3">
          <HelpCircle className="h-5 w-5 text-[var(--cl-accent)]" />
          <h2 id="help-title" className="flex-1 font-semibold">Help</h2>
          <button onClick={onClose} aria-label="Close help" className="rounded-lg p-1.5 text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]"><X className="h-4 w-4" /></button>
        </div>
        <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[14px]">
          {msgs.length === 0 && (
            <div>
              <p className="text-[var(--cl-muted)]">Hi! Ask me anything about using Nebulux AI.</p>
              <div className="mt-3 flex flex-col gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-xl border border-[var(--cl-border)] px-3 py-2 text-left text-[13.5px] hover:bg-[var(--cl-hover)]">{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[var(--cl-card)] px-3 py-2">{m.content}</div></div>
            ) : (
              <div key={i} className="leading-relaxed"><Markdown text={m.content} untrusted /></div>
            )
          )}
          {busy && <Loader2 className="h-4 w-4 animate-spin text-[var(--cl-muted)]" />}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-end gap-2 border-t border-[var(--cl-border)] p-3">
          <textarea
            ref={field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
            rows={1}
            maxLength={600}
            placeholder="Ask about Nebulux AI…"
            className="max-h-28 flex-1 resize-none rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] px-3 py-2 text-[16px] sm:text-[14px] outline-none focus:border-[var(--cl-accent)]"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-xl bg-[var(--cl-text)] p-2.5 text-[var(--cl-bg)] disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
        <p className="px-4 pb-3 text-[12px] text-[var(--cl-faint)]">Need a person? <a href="/contact" target="_blank" rel="noopener noreferrer" className="underline">Contact us</a></p>
      </div>
    </div>
  );
}
